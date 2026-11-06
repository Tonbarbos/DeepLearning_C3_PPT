/**
 * Laço principal: liga as quatro camadas, uma vez por quadro.
 *
 *   1. percepção     maos.js     webcam + MediaPipe  → 21 pontos
 *   2. interpretação gestos.js   21 pontos           → pedra/papel/tesoura
 *   3. jogo          logica.js   gesto + tempo       → estado, placar
 *   4. saída         visual.js   estado              → canvas
 *
 * Para executar, sirva a pasta e abra http://localhost:8000 (ver README.md):
 *
 *     python -m http.server 8000
 *
 * Sem webcam, acrescente ?teste=1 à URL para rodar com uma mão simulada.
 */
import { abrirCamera, Rastreador } from "./maos.js";
import { classificar, Estabilizador, INDEFINIDO } from "./gestos.js";
import { Jogo } from "./logica.js";
import { MaoSimulada } from "./simulador.js";
import {
  desenharVideo, desenharMao, desenharLeitura, desenharPlacar,
  desenharEstado, desenharDepuracao, desenharAviso, desenharFundoSimulado,
} from "./visual.js";

const canvas = document.getElementById("tela");
const ctx = canvas.getContext("2d");

const MODO_TESTE = new URLSearchParams(location.search).has("teste");

const opcoes = { mostrarEsqueleto: true, depurar: false };

const jogo = new Jogo({
  vitoriasParaVencer: 3,   // melhor de 5
  duracaoContagem: 3.0,
  duracaoResultado: 2.4,
  toleranciaPerda: 1.0,
  janela: { duracao: 0.5, minAmostras: 4 },
});
const estabilizador = new Estabilizador({ quadros: 5 });

const medidas = { fps: 0, _ultimo: 0, _hist: [] };

function medir(t, maoPresente) {
  if (medidas._ultimo) {
    const dt = t - medidas._ultimo;
    if (dt > 0) medidas.fps = medidas.fps * 0.9 + (1 / dt) * 0.1;
  }
  medidas._ultimo = t;
  medidas._hist.push(maoPresente ? 1 : 0);
  if (medidas._hist.length > 90) medidas._hist.shift();
}

const taxaDeteccao = () =>
  medidas._hist.length ? medidas._hist.reduce((a, b) => a + b, 0) / medidas._hist.length : 0;

function ajustarCanvas(video) {
  if (!video) return;
  const largura = Math.min(video.videoWidth || 960, 1280);
  const altura = Math.round(largura * ((video.videoHeight / video.videoWidth) || 9 / 16));
  if (canvas.width !== largura || canvas.height !== altura) {
    canvas.width = largura;
    canvas.height = altura;
  }
}

function novaPartida() {
  jogo.reiniciarPartida(performance.now() / 1000);
  estabilizador.limpar();
}

function teclas(evento) {
  const tecla = evento.key.toLowerCase();
  if (tecla === "r") novaPartida();
  if (tecla === "d") opcoes.depurar = !opcoes.depurar;
  if (tecla === "e") opcoes.mostrarEsqueleto = !opcoes.mostrarEsqueleto;
}

/** Traduz a falha de getUserMedia em uma instrução útil. */
function explicarFalha(erro) {
  const sugestao = " Sem webcam, acrescente ?teste=1 ao endereço para ver o jogo com uma mão simulada.";
  const porNome = {
    NotAllowedError:
      "Permissão da câmera negada. Autorize o acesso no cadeado da barra de endereços e recarregue a página.",
    NotFoundError: "Nenhuma câmera foi encontrada neste computador.",
    NotReadableError: "A câmera está sendo usada por outro programa. Feche-o e recarregue a página.",
    SecurityError:
      "A câmera só funciona em http://localhost ou https://. Não abra o arquivo direto pelo file://.",
  };
  return (porNome[erro?.name] || erro?.message || "Erro desconhecido.") + sugestao;
}

async function principal() {
  canvas.width = 960;
  canvas.height = 540;

  let video = null;
  let rastreador = null;
  const simulada = MODO_TESTE ? new MaoSimulada() : null;

  if (!MODO_TESTE) {
    desenharAviso(ctx, canvas.width, canvas.height, "Carregando o modelo…",
      "Na primeira execução o navegador baixa cerca de 8 MB do MediaPipe.");
    try {
      [video, rastreador] = await Promise.all([
        abrirCamera({ largura: 960, altura: 540 }),
        Rastreador.criar({ numMaos: 1, confianca: 0.5, espelhar: true }),
      ]);
    } catch (erro) {
      console.error(erro);
      desenharAviso(ctx, canvas.width, canvas.height, "Não foi possível iniciar", explicarFalha(erro));
      return;
    }
  }

  window.addEventListener("keydown", teclas);
  document.getElementById("reiniciar")?.addEventListener("click", novaPartida);
  novaPartida();

  function quadro() {
    const t = performance.now() / 1000;
    ajustarCanvas(video);
    const { width: w, height: h } = canvas;

    // 1. percepção
    const mao = MODO_TESTE
      ? simulada.mao(t, w, h)
      : (rastreador.processar(video, t, w, h)[0] ?? null);
    const maoPresente = mao !== null;

    // 2. interpretação
    const leitura = classificar(mao);
    let estavel = INDEFINIDO;
    if (maoPresente) {
      estavel = estabilizador.atualizar(leitura.gesto);
    } else {
      estabilizador.limpar();
    }

    // 3. jogo
    jogo.atualizar(estavel, maoPresente, t);

    // 4. saída
    medir(t, maoPresente);
    if (MODO_TESTE) desenharFundoSimulado(ctx, w, h);
    else desenharVideo(ctx, video, w, h);
    if (mao && opcoes.mostrarEsqueleto) desenharMao(ctx, mao);
    desenharEstado(ctx, w, h, jogo, t, maoPresente);
    desenharPlacar(ctx, w, jogo);
    desenharLeitura(ctx, w, h, { gesto: estavel, padrao: leitura.padrao, maoPresente });
    if (opcoes.depurar) {
      desenharDepuracao(ctx, w, h, {
        fps: medidas.fps,
        deteccao: taxaDeteccao(),
        bruto: leitura.gesto,
        estavel,
        polegar: leitura.polegar,
        estado: jogo.estado,
      });
    }

    requestAnimationFrame(quadro);
  }

  requestAnimationFrame(quadro);
}

principal();
