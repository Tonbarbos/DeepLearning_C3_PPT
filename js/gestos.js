/**
 * Classificação de pedra, papel e tesoura a partir dos 21 landmarks da mão.
 *
 * Esta é a regra de interação própria do projeto: o MediaPipe entrega apenas as
 * coordenadas dos pontos, e toda a decisão sobre qual gesto está sendo feito
 * acontece aqui. Não usamos o Gesture Recognizer pronto de propósito.
 *
 * Módulo puro (sem MediaPipe, sem DOM): é testado no Node por `testes.js`.
 */
import { dist, tamanhoMao, PULSO, POLEGAR, MINIMO, DEDOS_LONGOS } from "./pontos.js";

export const PEDRA = "pedra";
export const PAPEL = "papel";
export const TESOURA = "tesoura";
export const INDEFINIDO = "indefinido";

export const JOGADAS = [PEDRA, PAPEL, TESOURA];

/**
 * Parâmetros ajustáveis da classificação.
 *
 * Altere um por vez e observe o efeito (tecla `d` liga o painel de depuração):
 *  - margemDedo baixo demais: dedos dobrados contam como estendidos;
 *  - margemDedo alto demais: tesoura deixa de ser reconhecida.
 */
export const PARAMETROS = {
  margemDedo: 1.08,    // quanto a ponta precisa superar a junta do meio
  limiarPolegar: 1.30, // distância ponta-do-polegar → base-do-mínimo, em tamanhos de mão
};

/**
 * Um dedo longo está estendido se a ponta estiver mais longe do pulso do que a
 * sua junta do meio.
 *
 * Comparar distâncias ao pulso — e não as coordenadas `y` — mantém o teste
 * válido com a mão inclinada ou de cabeça para baixo, porque a medida não
 * depende da orientação da imagem.
 */
export function dedoEstendido(mao, dedo, margem = PARAMETROS.margemDedo) {
  const pulso = mao[PULSO];
  return dist(mao[dedo.ponta], pulso) > dist(mao[dedo.meio], pulso) * margem;
}

/**
 * O polegar dobra de lado, não em direção à palma, por isso não serve o mesmo
 * teste dos outros dedos. Medimos a abertura até a base do dedo mínimo,
 * normalizada pelo tamanho da mão.
 *
 * O resultado é informativo (aparece na depuração e ficará útil na C3), mas
 * NÃO entra na decisão do gesto: o polegar é o ponto mais instável dos 21.
 */
export function polegarEstendido(mao, limiar = PARAMETROS.limiarPolegar) {
  return dist(mao[POLEGAR.ponta], mao[MINIMO.base]) / tamanhoMao(mao) > limiar;
}

/** Estado dos quatro dedos longos, na ordem indicador, médio, anelar, mínimo. */
export function padraoDedos(mao, margem = PARAMETROS.margemDedo) {
  return DEDOS_LONGOS.map((dedo) => dedoEstendido(mao, dedo, margem));
}

/**
 * Traduz o padrão dos quatro dedos em um gesto.
 *
 * Apenas três padrões são aceitos; qualquer outro vira INDEFINIDO, que é o que
 * alimenta o caminho de rodada inválida em `logica.js`. Ser rigoroso aqui é
 * melhor do que adivinhar: um palpite errado rouba a rodada do jogador.
 */
export function gestoDoPadrao(padrao) {
  const [indicador, medio, anelar, minimo] = padrao;
  const quantos = padrao.filter(Boolean).length;

  if (quantos === 0) return PEDRA;                                  // punho fechado
  if (quantos === 4) return PAPEL;                                  // mão aberta
  if (indicador && medio && !anelar && !minimo) return TESOURA;     // V
  return INDEFINIDO;
}

/**
 * Classifica a mão inteira. Devolve também os sinais intermediários, para que a
 * tela possa mostrar ao jogador o que a aplicação entendeu.
 */
export function classificar(mao) {
  if (!mao || mao.length < 21) {
    return { gesto: INDEFINIDO, padrao: [false, false, false, false], polegar: false };
  }
  const padrao = padraoDedos(mao);
  return { gesto: gestoDoPadrao(padrao), padrao, polegar: polegarEstendido(mao) };
}

/**
 * Exige que o mesmo gesto apareça em N quadros seguidos antes de aceitá-lo.
 *
 * Sem isso a leitura pisca: a classificação de um único quadro ruim bastaria
 * para a tela mudar. É a mesma ideia do debounce do gatilho da pinça da Aula 12.
 */
export class Estabilizador {
  constructor({ quadros = 5 } = {}) {
    this.quadros = quadros;
    this._candidato = INDEFINIDO;
    this._seguidos = 0;
    this.gesto = INDEFINIDO;
  }

  atualizar(gesto) {
    if (gesto === this._candidato) {
      this._seguidos += 1;
    } else {
      this._candidato = gesto;
      this._seguidos = 1;
    }
    if (this._seguidos >= this.quadros) this.gesto = this._candidato;
    return this.gesto;
  }

  limpar() {
    this._candidato = INDEFINIDO;
    this._seguidos = 0;
    this.gesto = INDEFINIDO;
  }
}

/**
 * Guarda as leituras dos últimos `duracao` segundos para travar a jogada.
 *
 * Ler o gesto só no instante em que a contagem zera é frágil: um quadro ruim
 * decide a partida. Em vez disso, tiramos a moda de uma janela curta e
 * exigimos um mínimo de leituras válidas — se não houver, a rodada não vale.
 */
export class JanelaDeGestos {
  constructor({ duracao = 0.5, minAmostras = 4 } = {}) {
    this.duracao = duracao;
    this.minAmostras = minAmostras;
    this._amostras = [];
  }

  registrar(gesto, t) {
    this._amostras.push({ gesto, t });
    this._expirar(t);
  }

  _expirar(t) {
    const corte = t - this.duracao;
    while (this._amostras.length && this._amostras[0].t < corte) this._amostras.shift();
  }

  /**
   * Gesto mais frequente da janela, ignorando leituras indefinidas.
   * Devolve null quando não houve leituras válidas suficientes.
   */
  decidir(t) {
    this._expirar(t);
    const contagem = new Map();
    for (const { gesto } of this._amostras) {
      if (gesto === INDEFINIDO) continue;
      contagem.set(gesto, (contagem.get(gesto) || 0) + 1);
    }
    let melhor = null;
    let votos = 0;
    for (const [gesto, n] of contagem) {
      if (n > votos) {
        melhor = gesto;
        votos = n;
      }
    }
    if (votos < this.minAmostras) return null;
    return { gesto: melhor, votos, total: this._amostras.length };
  }

  limpar() {
    this._amostras = [];
  }
}
