/**
 * Regras do jogo: máquina de estados, contagem regressiva, sorteio da máquina,
 * placar e partida em melhor de N.
 *
 * Módulo puro: não importa MediaPipe, não toca no DOM e não desenha nada. Por
 * isso a partida inteira pode ser simulada no Node (ver `testes.js`), sem
 * webcam — a mesma separação que a Aula 12 usa em `logica.py`.
 */
import { PEDRA, PAPEL, TESOURA, INDEFINIDO, JOGADAS, JanelaDeGestos } from "./gestos.js";

export const AGUARDANDO = "aguardando";
export const CONTAGEM = "contagem";
export const RESULTADO = "resultado";
export const FIM_PARTIDA = "fim_partida";

export const VITORIA = "vitoria";
export const DERROTA = "derrota";
export const EMPATE = "empate";
export const ANULADA = "anulada";

/** Quem vence quem. `VENCE[a] === b` significa "a ganha de b". */
export const VENCE = { [PEDRA]: TESOURA, [TESOURA]: PAPEL, [PAPEL]: PEDRA };

/**
 * Gerador pseudoaleatório com semente (mulberry32).
 *
 * Com semente fixa a sequência de jogadas da máquina é reproduzível, o que
 * torna os testes determinísticos.
 */
export function criarRng(semente = 2026) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Compara duas jogadas válidas. */
export function decidirRodada(jogador, computador) {
  if (jogador === computador) return EMPATE;
  return VENCE[jogador] === computador ? VITORIA : DERROTA;
}

export class Jogo {
  constructor({
    vitoriasParaVencer = 3,   // melhor de 5
    duracaoContagem = 3.0,    // segundos de "3, 2, 1"
    duracaoResultado = 2.2,   // quanto tempo o resultado fica na tela
    esperaParaIniciar = 0.8,  // mão precisa ficar visível por este tempo
    toleranciaPerda = 1.0,    // sumiço maior que isso anula a rodada
    janela = {},              // opções da JanelaDeGestos
    rng = Math.random,
  } = {}) {
    Object.assign(this, {
      vitoriasParaVencer, duracaoContagem, duracaoResultado,
      esperaParaIniciar, toleranciaPerda, rng,
    });
    this.janela = new JanelaDeGestos(janela);
    this.reiniciarPartida(0);
  }

  reiniciarPartida(t = 0) {
    this.estado = AGUARDANDO;
    this.placar = { jogador: 0, computador: 0 };
    this.rodada = 0;
    this.historico = [];      // guardado desde já: é o que a C3 vai usar
    this.ultimaRodada = null;
    this.jogadaJogador = null;
    this.jogadaComputador = null;
    this._desde = t;
    this._vistoEm = t;
    this._maoDesde = null;
    this.janela.limpar();
  }

  /** Segundos restantes da contagem (0 fora do estado CONTAGEM). */
  restante(t) {
    if (this.estado !== CONTAGEM) return 0;
    return Math.max(0, this.duracaoContagem - (t - this._desde));
  }

  _ir(estado, t) {
    this.estado = estado;
    this._desde = t;
  }

  /**
   * Avança um quadro.
   *
   * @param {string} gesto  classificação já estabilizada (pode ser INDEFINIDO)
   * @param {boolean} maoPresente  houve mão detectada neste quadro
   * @param {number} t  tempo em segundos
   */
  atualizar(gesto, maoPresente, t) {
    if (maoPresente) this._vistoEm = t;
    const perdidaHa = t - this._vistoEm;

    switch (this.estado) {
      case AGUARDANDO: {
        // Começa sozinho quando a mão fica visível por um instante. Assim o
        // jogador não precisa de nenhum comando além de aparecer na câmera.
        if (!maoPresente) {
          this._maoDesde = null;
          break;
        }
        if (this._maoDesde === null) this._maoDesde = t;
        if (t - this._maoDesde >= this.esperaParaIniciar) this._iniciarRodada(t);
        break;
      }

      case CONTAGEM: {
        // A jogada da máquina já foi sorteada no início da contagem; por isso
        // o jogador não consegue reagir a ela, mesmo trocando de gesto agora.
        this.janela.registrar(gesto, t);

        if (perdidaHa > this.toleranciaPerda) {
          this._anular("mao_perdida", t);
          break;
        }
        if (this.restante(t) <= 0) this._revelar(t);
        break;
      }

      case RESULTADO: {
        if (t - this._desde >= this.duracaoResultado) {
          if (this._alguemVenceu()) this._ir(FIM_PARTIDA, t);
          else {
            this._maoDesde = maoPresente ? t : null;
            this._ir(AGUARDANDO, t);
          }
        }
        break;
      }

      case FIM_PARTIDA:
        // Sai daqui apenas por reiniciarPartida(), acionada pelo botão/tecla.
        break;
    }
  }

  _iniciarRodada(t) {
    this.rodada += 1;
    this.janela.limpar();
    this.jogadaJogador = null;
    // Sorteio antes de ler o gesto do jogador: o resultado não pode depender
    // do que a máquina tirou.
    this.jogadaComputador = JOGADAS[Math.floor(this.rng() * JOGADAS.length)];
    this._ir(CONTAGEM, t);
  }

  _revelar(t) {
    const decisao = this.janela.decidir(t);
    if (!decisao) {
      this._anular("gesto_indefinido", t);
      return;
    }
    this.jogadaJogador = decisao.gesto;
    const resultado = decidirRodada(this.jogadaJogador, this.jogadaComputador);
    if (resultado === VITORIA) this.placar.jogador += 1;
    if (resultado === DERROTA) this.placar.computador += 1;
    this._registrar(resultado, null, decisao.votos, t);
    this._ir(RESULTADO, t);
  }

  _anular(motivo, t) {
    this.jogadaJogador = null;
    this._registrar(ANULADA, motivo, 0, t);
    this._ir(RESULTADO, t);
  }

  _registrar(resultado, motivo, votos, t) {
    this.ultimaRodada = {
      rodada: this.rodada,
      jogador: this.jogadaJogador,
      computador: this.jogadaComputador,
      resultado,
      motivo,
      votos,
      t,
    };
    this.historico.push(this.ultimaRodada);
  }

  _alguemVenceu() {
    return (
      this.placar.jogador >= this.vitoriasParaVencer ||
      this.placar.computador >= this.vitoriasParaVencer
    );
  }

  /** "jogador", "computador" ou null enquanto a partida não terminou. */
  vencedorDaPartida() {
    if (this.placar.jogador >= this.vitoriasParaVencer) return "jogador";
    if (this.placar.computador >= this.vitoriasParaVencer) return "computador";
    return null;
  }
}
