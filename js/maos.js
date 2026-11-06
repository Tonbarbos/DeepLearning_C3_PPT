/**
 * Camada de percepção: webcam e MediaPipe Hand Landmarker (API Tasks).
 *
 * Este módulo isola tudo o que depende de câmera e do MediaPipe. O resto do
 * código recebe apenas listas de 21 pontos {x, y} em pixels, já espelhados.
 * Mesma separação do `maos.py` da Aula 12, que serviu de base.
 *
 * API Tasks para Web, versão 1.2.2:
 * https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js
 */
import {
  FilesetResolver,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/vision_bundle.mjs";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";

// O modelo (~8 MB) é baixado na primeira execução e fica no cache do navegador.
// Para rodar sem internet, baixe este arquivo para `modelos/hand_landmarker.task`
// e troque a constante pelo caminho relativo.
const MODELO =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/" +
  "hand_landmarker/float16/latest/hand_landmarker.task";

/**
 * Abre a webcam e devolve um <video> já tocando.
 *
 * getUserMedia exige contexto seguro: funciona em https:// e em
 * http://localhost, mas não em file://. Ver README.
 */
export async function abrirCamera({ largura = 960, altura = 540 } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "Este navegador não expõe a câmera. Abra a página por http://localhost ou https://, não por file://."
    );
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: largura }, height: { ideal: altura } },
    audio: false,
  });
  const video = document.createElement("video");
  video.srcObject = stream;
  video.playsInline = true;
  video.muted = true;
  await video.play();
  // Em alguns navegadores as dimensões só aparecem no primeiro quadro.
  if (!video.videoWidth) {
    await new Promise((r) => video.addEventListener("loadeddata", r, { once: true }));
  }
  return video;
}

export class Rastreador {
  constructor(detector, { espelhar = true } = {}) {
    this.detector = detector;
    this.espelhar = espelhar;
    this._ultimoQuadro = -1;
    this._ultimoMs = -1;
    this._maos = [];
  }

  /**
   * Cria o rastreador. Tenta a GPU e cai para a CPU se não houver WebGL.
   */
  static async criar({ numMaos = 1, confianca = 0.5, espelhar = true } = {}) {
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    const opcoes = (delegate) => ({
      baseOptions: { modelAssetPath: MODELO, delegate },
      runningMode: "VIDEO",
      numHands: numMaos,
      minHandDetectionConfidence: confianca,
      minHandPresenceConfidence: confianca,
      minTrackingConfidence: confianca,
    });
    let detector;
    try {
      detector = await HandLandmarker.createFromOptions(fileset, opcoes("GPU"));
    } catch {
      detector = await HandLandmarker.createFromOptions(fileset, opcoes("CPU"));
    }
    return new Rastreador(detector, { espelhar });
  }

  /**
   * Detecta mãos no quadro atual do vídeo.
   *
   * @returns {Array<Array<{x: number, y: number}>>} listas de 21 pontos em pixels.
   *
   * O MediaPipe só processa quando o vídeo avançou; entre quadros repetidos
   * devolvemos o último resultado, para o jogo não "piscar" sem motivo.
   */
  processar(video, t, largura, altura) {
    if (video.readyState < 2) return this._maos;
    if (video.currentTime === this._ultimoQuadro) return this._maos;
    this._ultimoQuadro = video.currentTime;

    // O modo VIDEO exige timestamps estritamente crescentes.
    const ms = Math.max(Math.round(t * 1000), this._ultimoMs + 1);
    this._ultimoMs = ms;

    const resultado = this.detector.detectForVideo(video, ms);
    const maos = resultado.landmarks ?? [];
    this._maos = maos.map((mao) =>
      mao.map((p) => ({
        // Espelhamos aqui, uma vez só: assim mover a mão para a direita move
        // o gesto para a direita na tela, e o resto do código não se preocupa.
        x: (this.espelhar ? 1 - p.x : p.x) * largura,
        y: p.y * altura,
      }))
    );
    return this._maos;
  }
}
