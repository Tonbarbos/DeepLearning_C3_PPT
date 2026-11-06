/**
 * Mão sintética: gera os 21 pontos sem câmera e sem MediaPipe.
 *
 * Serve a dois propósitos:
 *  - os testes de `gestos.js` e `logica.js` rodam no Node com estas mãos;
 *  - o modo de teste da página (`index.html?teste=1`) usa a `MaoSimulada` para
 *    exercitar o jogo inteiro sem webcam, incluindo o sumiço da mão.
 *
 * É o equivalente ao `--video` do Fruit Ninja da Aula 12: um jeito de verificar
 * o programa quando não há câmera disponível.
 *
 * Módulo puro: não importa MediaPipe nem toca no DOM.
 */
import { PULSO, POLEGAR, INDICADOR, MEDIO, ANELAR, MINIMO } from "./pontos.js";
import { PEDRA, PAPEL, TESOURA } from "./gestos.js";

/**
 * Monta uma mão de 21 pontos a partir de quais dedos estão estendidos.
 *
 * O pulso fica na origem e a base do médio a 100 px, então `tamanhoMao` vale
 * 100 e os limiares de `gestos.js` ficam fáceis de conferir à mão.
 */
export function maoSintetica({
  indicador = false, medio = false, anelar = false, minimo = false, polegar = false,
} = {}) {
  const mao = new Array(21);
  mao[PULSO] = { x: 0, y: 0 };

  const bases = [
    [INDICADOR, { x: -30, y: -95 }, indicador],
    [MEDIO, { x: -5, y: -100 }, medio],
    [ANELAR, { x: 20, y: -97 }, anelar],
    [MINIMO, { x: 42, y: -88 }, minimo],
  ];
  for (const [dedo, base, estendido] of bases) {
    const norma = Math.hypot(base.x, base.y);
    const ux = base.x / norma;
    const uy = base.y / norma;
    const passo = (d) => ({ x: base.x + ux * d, y: base.y + uy * d });
    mao[dedo.base] = base;
    mao[dedo.meio] = passo(35);
    mao[dedo.dip] = passo(estendido ? 55 : 20);
    // Dobrado: a ponta se recolhe e fica mais perto do pulso do que a junta do meio.
    mao[dedo.ponta] = passo(estendido ? 75 : 10);
  }

  mao[POLEGAR.base] = { x: -20, y: -25 };
  mao[POLEGAR.meio] = { x: -45, y: -40 };
  mao[POLEGAR.ip] = polegar ? { x: -85, y: -50 } : { x: -5, y: -55 };
  mao[POLEGAR.ponta] = polegar ? { x: -120, y: -60 } : { x: 10, y: -70 };
  return mao;
}

/** Combinações de dedos de cada jogada. */
export const DEDOS_DA_JOGADA = {
  [PEDRA]: {},
  [PAPEL]: { indicador: true, medio: true, anelar: true, minimo: true, polegar: true },
  [TESOURA]: { indicador: true, medio: true },
};

export function maoDaJogada(jogada) {
  return maoSintetica(DEDOS_DA_JOGADA[jogada] ?? {});
}

/** Posiciona e redimensiona uma mão para caber na tela. */
export function colocar(mao, { cx, cy, escala = 1.6 }) {
  return mao.map((p) => ({ x: cx + p.x * escala, y: cy + p.y * escala }));
}

/**
 * Mão animada para o modo de teste da página.
 *
 * O ciclo troca de jogada a cada `periodo` segundos e, a cada quatro ciclos,
 * some por um tempo — assim o comportamento de perda de detecção, que a
 * especificação exige, aparece sozinho na demonstração.
 */
export class MaoSimulada {
  constructor({ periodo = 2.5, sumicoCada = 4, duracaoSumico = 1.6 } = {}) {
    Object.assign(this, { periodo, sumicoCada, duracaoSumico });
    this.jogadas = [PEDRA, PAPEL, TESOURA];
  }

  /** Jogada que está sendo mostrada no instante `t`. */
  jogadaEm(t) {
    const i = Math.floor(t / this.periodo) % this.jogadas.length;
    return this.jogadas[i];
  }

  /** True quando a mão está "fora do quadro". */
  sumindoEm(t) {
    const ciclo = Math.floor(t / this.periodo);
    if (ciclo % this.sumicoCada !== this.sumicoCada - 1) return false;
    return t % this.periodo < this.duracaoSumico;
  }

  /** Devolve a mão em pixels, ou null quando ela está fora do quadro. */
  mao(t, largura, altura) {
    if (this.sumindoEm(t)) return null;
    const balanco = Math.sin(t * 1.7) * largura * 0.04;
    return colocar(maoDaJogada(this.jogadaEm(t)), {
      cx: largura / 2 + balanco,
      cy: altura * 0.72,
      escala: altura / 420,
    });
  }
}
