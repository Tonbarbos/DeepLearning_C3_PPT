/**
 * Índices dos 21 landmarks da mão e a topologia do esqueleto.
 *
 * Módulo puro: não importa MediaPipe nem toca no DOM, para que `gestos.js` e
 * `logica.js` possam ser testados no Node, sem navegador e sem câmera.
 *
 * Numeração definida pelo MediaPipe Hand Landmarker (0 = pulso, 20 = ponta do
 * mínimo). Ver: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker
 */

export const PULSO = 0;

// Cada dedo tem 4 pontos, do mais próximo ao mais distante do pulso.
export const POLEGAR = { base: 1, meio: 2, ip: 3, ponta: 4 };
export const INDICADOR = { base: 5, meio: 6, dip: 7, ponta: 8 };
export const MEDIO = { base: 9, meio: 10, dip: 11, ponta: 12 };
export const ANELAR = { base: 13, meio: 14, dip: 15, ponta: 16 };
export const MINIMO = { base: 17, meio: 18, dip: 19, ponta: 20 };

/** Os quatro dedos usados para decidir o gesto, em ordem fixa. */
export const DEDOS_LONGOS = [INDICADOR, MEDIO, ANELAR, MINIMO];
export const NOMES_DEDOS_LONGOS = ["indicador", "médio", "anelar", "mínimo"];

/** Pares de landmarks ligados por um segmento (o "esqueleto" desenhado na tela). */
export const CONEXOES = [
  [0, 1], [1, 2], [2, 3], [3, 4],          // polegar
  [0, 5], [5, 6], [6, 7], [7, 8],          // indicador
  [5, 9], [9, 10], [10, 11], [11, 12],     // médio
  [9, 13], [13, 14], [14, 15], [15, 16],   // anelar
  [13, 17], [17, 18], [18, 19], [19, 20],  // mínimo
  [0, 17],                                 // borda da palma
];

/** Distância euclidiana entre dois pontos {x, y}. */
export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Tamanho de referência da mão: do pulso à base do dedo médio.
 *
 * Dividir as medidas por esse valor as torna independentes da distância até a
 * câmera — o mesmo truque que a Aula 12 usa na razão da pinça.
 */
export function tamanhoMao(mao) {
  return Math.max(dist(mao[PULSO], mao[MEDIO.base]), 1e-6);
}
