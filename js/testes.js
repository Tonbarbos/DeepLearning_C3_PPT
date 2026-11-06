/**
 * Testes de `gestos.js` e `logica.js` com mãos sintéticas.
 *
 * Os dois módulos não importam MediaPipe nem tocam no DOM, por isso a partida
 * inteira roda aqui sem navegador e sem webcam:
 *
 *     node js/testes.js
 */
import {
  PEDRA, PAPEL, TESOURA, INDEFINIDO,
  classificar, polegarEstendido, Estabilizador, JanelaDeGestos,
} from "./gestos.js";
import { maoSintetica, maoDaJogada, MaoSimulada } from "./simulador.js";
import {
  Jogo, criarRng, decidirRodada,
  AGUARDANDO, CONTAGEM, RESULTADO, FIM_PARTIDA,
  VITORIA, DERROTA, EMPATE, ANULADA,
} from "./logica.js";

// ---------------------------------------------------------------- utilidades

let passou = 0;
const falhas = [];

function teste(nome, fn) {
  try {
    fn();
    passou += 1;
    console.log(`  ok   ${nome}`);
  } catch (erro) {
    falhas.push(nome);
    console.log(`  FALHA ${nome}\n        ${erro.message}`);
  }
}

function ok(condicao, msg) {
  if (!condicao) throw new Error(msg || "condição falsa");
}

function igual(a, b, msg) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(`${msg || "valores diferentes"}: ${x} != ${y}`);
}

const PUNHO = () => maoSintetica({});
const ABERTA = () => maoSintetica({ indicador: true, medio: true, anelar: true, minimo: true, polegar: true });
const V = () => maoSintetica({ indicador: true, medio: true });

function girar(mao, graus) {
  const r = (graus * Math.PI) / 180;
  const cos = Math.cos(r);
  const sen = Math.sin(r);
  return mao.map((p) => ({ x: p.x * cos - p.y * sen, y: p.x * sen + p.y * cos }));
}

function escalar(mao, k, dx = 0, dy = 0) {
  return mao.map((p) => ({ x: p.x * k + dx, y: p.y * k + dy }));
}

/** Avança o jogo por `segundos`, a 30 quadros por segundo. */
function rodar(jogo, { gesto, mao = true, segundos, t0 }) {
  const dt = 1 / 30;
  let t = t0;
  const fim = t0 + segundos;
  while (t < fim) {
    jogo.atualizar(gesto, mao, t);
    t += dt;
  }
  return t;
}

// ------------------------------------------------------------ gestos.js

console.log("\ngestos.js");

teste("punho fechado é pedra", () => {
  igual(classificar(PUNHO()).gesto, PEDRA);
});

teste("mão aberta é papel", () => {
  igual(classificar(ABERTA()).gesto, PAPEL);
});

teste("indicador e médio são tesoura", () => {
  igual(classificar(V()).gesto, TESOURA);
});

teste("padrões fora dos três viram indefinido", () => {
  igual(classificar(maoSintetica({ indicador: true })).gesto, INDEFINIDO);
  igual(classificar(maoSintetica({ indicador: true, medio: true, anelar: true })).gesto, INDEFINIDO);
  igual(classificar(maoSintetica({ minimo: true })).gesto, INDEFINIDO);
});

teste("classificação não muda com a mão girada", () => {
  // Comparar distâncias ao pulso, e não coordenadas y, é o que garante isso.
  for (const graus of [45, 90, 180, 270]) {
    igual(classificar(girar(V(), graus)).gesto, TESOURA, `tesoura a ${graus}°`);
    igual(classificar(girar(PUNHO(), graus)).gesto, PEDRA, `pedra a ${graus}°`);
    igual(classificar(girar(ABERTA(), graus)).gesto, PAPEL, `papel a ${graus}°`);
  }
});

teste("classificação não muda com a distância da câmera", () => {
  for (const k of [0.4, 2.5]) {
    igual(classificar(escalar(V(), k, 300, 200)).gesto, TESOURA, `tesoura a ${k}x`);
    igual(classificar(escalar(ABERTA(), k, 300, 200)).gesto, PAPEL, `papel a ${k}x`);
  }
});

teste("polegar é medido, mas não decide o gesto", () => {
  ok(polegarEstendido(ABERTA()), "polegar aberto deveria ser detectado");
  ok(!polegarEstendido(PUNHO()), "polegar fechado não deveria ser detectado");
  // Punho com o polegar para fora continua sendo pedra.
  igual(classificar(maoSintetica({ polegar: true })).gesto, PEDRA);
});

teste("estabilizador só aceita depois de N quadros iguais", () => {
  const e = new Estabilizador({ quadros: 3 });
  igual(e.atualizar(PEDRA), INDEFINIDO, "1 quadro não basta");
  igual(e.atualizar(PEDRA), INDEFINIDO, "2 quadros não bastam");
  igual(e.atualizar(PEDRA), PEDRA, "3 quadros bastam");
  igual(e.atualizar(PAPEL), PEDRA, "um quadro solto não derruba o gesto");
  e.atualizar(PAPEL);
  igual(e.atualizar(PAPEL), PAPEL, "três quadros trocam o gesto");
});

teste("janela devolve a moda e ignora indefinidos", () => {
  const j = new JanelaDeGestos({ duracao: 1.0, minAmostras: 3 });
  [PEDRA, INDEFINIDO, PAPEL, PEDRA, INDEFINIDO, PEDRA].forEach((g, i) => j.registrar(g, i * 0.1));
  igual(j.decidir(0.5).gesto, PEDRA);
});

teste("janela devolve null sem amostras válidas suficientes", () => {
  const j = new JanelaDeGestos({ duracao: 1.0, minAmostras: 4 });
  [PEDRA, INDEFINIDO, INDEFINIDO].forEach((g, i) => j.registrar(g, i * 0.1));
  igual(j.decidir(0.3), null);
});

teste("janela esquece amostras antigas", () => {
  const j = new JanelaDeGestos({ duracao: 0.5, minAmostras: 2 });
  [PAPEL, PAPEL, PAPEL].forEach((g, i) => j.registrar(g, i * 0.1));  // t = 0,0 a 0,2
  [PEDRA, PEDRA, PEDRA].forEach((g, i) => j.registrar(g, 1.0 + i * 0.1));
  igual(j.decidir(1.2).gesto, PEDRA, "os papéis de 1 s atrás deveriam ter saído");
});

// ------------------------------------------------------------ logica.js

console.log("\nlogica.js");

teste("regras de quem vence quem", () => {
  igual(decidirRodada(PEDRA, TESOURA), VITORIA);
  igual(decidirRodada(TESOURA, PAPEL), VITORIA);
  igual(decidirRodada(PAPEL, PEDRA), VITORIA);
  igual(decidirRodada(TESOURA, PEDRA), DERROTA);
  igual(decidirRodada(PAPEL, TESOURA), DERROTA);
  igual(decidirRodada(PEDRA, PAPEL), DERROTA);
  for (const g of [PEDRA, PAPEL, TESOURA]) igual(decidirRodada(g, g), EMPATE);
});

teste("a mão visível inicia a contagem sozinha", () => {
  const jogo = new Jogo({ rng: criarRng(1) });
  igual(jogo.estado, AGUARDANDO);
  rodar(jogo, { gesto: PEDRA, segundos: 0.5, t0: 0 });
  igual(jogo.estado, AGUARDANDO, "meio segundo não deveria bastar");
  rodar(jogo, { gesto: PEDRA, segundos: 0.6, t0: 0.5 });
  igual(jogo.estado, CONTAGEM);
});

teste("a jogada da máquina é sorteada antes de ler o jogador", () => {
  const jogo = new Jogo({ rng: criarRng(7) });
  rodar(jogo, { gesto: PEDRA, segundos: 1.0, t0: 0 });
  igual(jogo.estado, CONTAGEM);
  ok(jogo.jogadaComputador !== null, "deveria já estar sorteada");
  ok(jogo.jogadaJogador === null, "a jogada do jogador ainda não existe");
});

teste("rodada completa pontua para quem venceu", () => {
  const jogo = new Jogo({ rng: criarRng(3) });
  let t = rodar(jogo, { gesto: PEDRA, segundos: 1.0, t0: 0 });
  const daMaquina = jogo.jogadaComputador;
  t = rodar(jogo, { gesto: PEDRA, segundos: 3.2, t0: t });
  igual(jogo.estado, RESULTADO);
  igual(jogo.jogadaJogador, PEDRA);
  const esperado = decidirRodada(PEDRA, daMaquina);
  igual(jogo.ultimaRodada.resultado, esperado);
  igual(jogo.placar.jogador, esperado === VITORIA ? 1 : 0);
  igual(jogo.placar.computador, esperado === DERROTA ? 1 : 0);
});

teste("mão perdida durante a contagem anula a rodada", () => {
  const jogo = new Jogo({ rng: criarRng(5), toleranciaPerda: 1.0 });
  let t = rodar(jogo, { gesto: PEDRA, segundos: 1.0, t0: 0 });
  igual(jogo.estado, CONTAGEM);
  t = rodar(jogo, { gesto: INDEFINIDO, mao: false, segundos: 1.5, t0: t });
  igual(jogo.estado, RESULTADO);
  igual(jogo.ultimaRodada.resultado, ANULADA);
  igual(jogo.ultimaRodada.motivo, "mao_perdida");
  igual(jogo.placar, { jogador: 0, computador: 0 }, "rodada anulada não pontua");
});

teste("sumiço curto não anula a rodada", () => {
  const jogo = new Jogo({ rng: criarRng(5), toleranciaPerda: 1.0 });
  let t = rodar(jogo, { gesto: PEDRA, segundos: 1.0, t0: 0 });
  t = rodar(jogo, { gesto: INDEFINIDO, mao: false, segundos: 0.4, t0: t });
  igual(jogo.estado, CONTAGEM, "0,4 s de sumiço deveria ser tolerado");
  t = rodar(jogo, { gesto: PAPEL, segundos: 2.8, t0: t });
  igual(jogo.ultimaRodada.resultado !== ANULADA, true);
});

teste("gesto indefinido na revelação anula a rodada", () => {
  const jogo = new Jogo({ rng: criarRng(9) });
  let t = rodar(jogo, { gesto: PEDRA, segundos: 1.0, t0: 0 });
  // Mão presente o tempo todo, mas nenhum gesto reconhecível.
  t = rodar(jogo, { gesto: INDEFINIDO, segundos: 3.2, t0: t });
  igual(jogo.estado, RESULTADO);
  igual(jogo.ultimaRodada.resultado, ANULADA);
  igual(jogo.ultimaRodada.motivo, "gesto_indefinido");
  igual(jogo.placar, { jogador: 0, computador: 0 });
});

teste("a partida termina em melhor de N e guarda o vencedor", () => {
  const jogo = new Jogo({ vitoriasParaVencer: 2, rng: criarRng(11) });
  let t = 0;
  for (let i = 0; i < 12 && jogo.estado !== FIM_PARTIDA; i += 1) {
    // Responde sempre o que vence a jogada já sorteada pela máquina.
    t = rodar(jogo, { gesto: PEDRA, segundos: 1.0, t0: t });
    const vencedor = Object.keys({ pedra: 1, papel: 1, tesoura: 1 })
      .find((g) => decidirRodada(g, jogo.jogadaComputador) === VITORIA);
    t = rodar(jogo, { gesto: vencedor, segundos: 3.2, t0: t });
    t = rodar(jogo, { gesto: vencedor, segundos: 2.4, t0: t });
  }
  igual(jogo.estado, FIM_PARTIDA);
  igual(jogo.placar.jogador, 2);
  igual(jogo.vencedorDaPartida(), "jogador");
});

teste("mesma semente, mesma sequência da máquina", () => {
  const sequencia = (semente) => {
    const jogo = new Jogo({ rng: criarRng(semente), vitoriasParaVencer: 99 });
    const jogadas = [];
    let t = 0;
    for (let i = 0; i < 5; i += 1) {
      t = rodar(jogo, { gesto: PEDRA, segundos: 1.0, t0: t });
      jogadas.push(jogo.jogadaComputador);
      t = rodar(jogo, { gesto: PEDRA, segundos: 3.2, t0: t });
      t = rodar(jogo, { gesto: PEDRA, segundos: 2.4, t0: t });
    }
    return jogadas;
  };
  igual(sequencia(42), sequencia(42), "mesma semente deveria repetir");
  ok(JSON.stringify(sequencia(42)) !== JSON.stringify(sequencia(99)), "sementes diferentes deveriam divergir");
});

teste("o histórico guarda todas as rodadas (base para a C3)", () => {
  const jogo = new Jogo({ rng: criarRng(13), vitoriasParaVencer: 99 });
  let t = 0;
  for (let i = 0; i < 3; i += 1) {
    t = rodar(jogo, { gesto: PAPEL, segundos: 1.0, t0: t });
    t = rodar(jogo, { gesto: PAPEL, segundos: 3.2, t0: t });
    t = rodar(jogo, { gesto: PAPEL, segundos: 2.4, t0: t });
  }
  igual(jogo.historico.length, 3);
  ok(jogo.historico.every((r) => r.computador !== null), "cada rodada registra a jogada da máquina");
});

// ------------------------------------------------------------ simulador.js

console.log("\nsimulador.js");

teste("cada jogada gera a mão que a classificação reconhece", () => {
  // Fecha o ciclo: o gerador do modo de teste produz gestos que o
  // classificador realmente lê de volta.
  for (const jogada of [PEDRA, PAPEL, TESOURA]) {
    igual(classificar(maoDaJogada(jogada)).gesto, jogada, `${jogada} ida e volta`);
  }
});

teste("a mão simulada percorre as três jogadas", () => {
  const sim = new MaoSimulada({ periodo: 1, sumicoCada: 99 });
  const vistos = new Set();
  for (let t = 0; t < 3; t += 0.5) {
    const mao = sim.mao(t, 960, 540);
    vistos.add(classificar(mao).gesto);
  }
  igual([...vistos].sort(), [PAPEL, PEDRA, TESOURA].sort());
});

teste("a mão simulada some de tempos em tempos", () => {
  const sim = new MaoSimulada({ periodo: 1, sumicoCada: 2, duracaoSumico: 0.5 });
  ok(sim.mao(0.2, 960, 540) !== null, "no primeiro ciclo a mão aparece");
  ok(sim.mao(1.2, 960, 540) === null, "no segundo ciclo ela some");
});

// ---------------------------------------------------------------- resultado

const total = passou + falhas.length;
console.log(`\n${passou}/${total} testes passaram`);
if (falhas.length) {
  console.log("falharam:", falhas.join(", "));
  process.exit(1);
}
