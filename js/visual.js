/**
 * Desenho no canvas: vídeo, esqueleto da mão, contagem, placar e resultado.
 *
 * Tudo o que o jogador vê sai daqui. A regra que guia este módulo é a da
 * especificação: a tela precisa deixar claro **o que a aplicação entendeu**,
 * e não apenas o resultado final.
 */
import { CONEXOES } from "./pontos.js";
import { PEDRA, PAPEL, TESOURA, INDEFINIDO } from "./gestos.js";
import {
  AGUARDANDO, CONTAGEM, RESULTADO, FIM_PARTIDA,
  VITORIA, DERROTA, EMPATE, ANULADA,
} from "./logica.js";

const COR = {
  fundoPainel: "rgba(12, 16, 28, 0.78)",
  texto: "#f2f5ff",
  apagado: "#9aa6c4",
  destaque: "#5cc8ff",
  vitoria: "#49d17a",
  derrota: "#ff6b6b",
  empate: "#ffc857",
  alerta: "#ff9f43",
  mao: "#5cc8ff",
  junta: "#ff6b6b",
};

const ICONE = { [PEDRA]: "✊", [PAPEL]: "✋", [TESOURA]: "✌️", [INDEFINIDO]: "…" };
const ROTULO = { [PEDRA]: "Pedra", [PAPEL]: "Papel", [TESOURA]: "Tesoura", [INDEFINIDO]: "—" };

const MOTIVO = {
  mao_perdida: "Mão saiu do quadro",
  gesto_indefinido: "Gesto não reconhecido",
};

function painel(ctx, x, y, w, h, raio = 14, cor = COR.fundoPainel) {
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, raio);
  ctx.fill();
}

function texto(ctx, s, x, y, { tamanho = 24, cor = COR.texto, align = "left", peso = 600 } = {}) {
  ctx.fillStyle = cor;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.font = `${peso} ${tamanho}px system-ui, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(s, x, y);
}

/** Desenha o quadro da câmera espelhado, preenchendo o canvas. */
export function desenharVideo(ctx, video, w, h) {
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();
}

/** Esqueleto da mão. Os pontos já chegam espelhados, em pixels. */
export function desenharMao(ctx, mao) {
  ctx.strokeStyle = COR.mao;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const [a, b] of CONEXOES) {
    ctx.beginPath();
    ctx.moveTo(mao[a].x, mao[a].y);
    ctx.lineTo(mao[b].x, mao[b].y);
    ctx.stroke();
  }
  ctx.fillStyle = COR.junta;
  for (const p of mao) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Crachá do gesto lido agora. É a resposta visual exigida pela especificação:
 * o jogador vê, antes de a rodada valer, o que o programa está entendendo.
 */
export function desenharLeitura(ctx, w, h, { gesto, padrao, maoPresente }) {
  const lw = 230;
  const lh = 92;
  const x = w / 2 - lw / 2;
  const y = h - lh - 18;
  painel(ctx, x, y, lw, lh);

  if (!maoPresente) {
    texto(ctx, "sem mão", x + lw / 2, y + 34, { tamanho: 22, cor: COR.alerta, align: "center" });
    texto(ctx, "mostre a mão à câmera", x + lw / 2, y + 64, {
      tamanho: 14, cor: COR.apagado, align: "center", peso: 400,
    });
    return;
  }

  texto(ctx, ICONE[gesto], x + 46, y + 44, { tamanho: 40, align: "center" });
  texto(ctx, ROTULO[gesto], x + 78, y + 34, {
    tamanho: 22, align: "left", cor: gesto === INDEFINIDO ? COR.apagado : COR.texto,
  });

  // Quatro marcas: quais dedos a regra considerou estendidos.
  const nomes = ["I", "M", "A", "m"];
  padrao.forEach((estendido, i) => {
    const cx = x + 86 + i * 26;
    const cy = y + 66;
    ctx.fillStyle = estendido ? COR.destaque : "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    texto(ctx, nomes[i], cx, cy + 1, {
      tamanho: 11, align: "center", cor: estendido ? "#0b1020" : COR.apagado, peso: 700,
    });
  });
}

/** Placar e número da rodada. */
export function desenharPlacar(ctx, w, jogo) {
  painel(ctx, 18, 18, 272, 76);
  texto(ctx, "VOCÊ", 54, 42, { tamanho: 13, cor: COR.apagado, align: "center", peso: 700 });
  texto(ctx, String(jogo.placar.jogador), 54, 72, { tamanho: 32, align: "center" });
  texto(ctx, "×", 154, 62, { tamanho: 22, cor: COR.apagado, align: "center" });
  texto(ctx, "PC", 254, 42, { tamanho: 13, cor: COR.apagado, align: "center", peso: 700 });
  texto(ctx, String(jogo.placar.computador), 254, 72, { tamanho: 32, align: "center" });
  texto(ctx, `melhor de ${jogo.vitoriasParaVencer * 2 - 1}`, 154, 38, {
    tamanho: 12, cor: COR.apagado, align: "center", peso: 400,
  });
  texto(ctx, `rodada ${Math.max(jogo.rodada, 1)}`, 154, 78, {
    tamanho: 12, cor: COR.apagado, align: "center", peso: 400,
  });
}

function faixa(ctx, w, h, titulo, subtitulo, cor) {
  const fh = 128;
  const y = h / 2 - fh / 2;
  painel(ctx, 0, y, w, fh, 0, "rgba(8, 11, 20, 0.72)");
  texto(ctx, titulo, w / 2, y + 48, { tamanho: 44, align: "center", cor });
  if (subtitulo) {
    texto(ctx, subtitulo, w / 2, y + 92, {
      tamanho: 18, align: "center", cor: COR.apagado, peso: 400,
    });
  }
}

/** Camada central, que muda conforme o estado da máquina. */
export function desenharEstado(ctx, w, h, jogo, t, maoPresente) {
  switch (jogo.estado) {
    case AGUARDANDO:
      faixa(ctx, w, h,
        maoPresente ? "Preparando…" : "Mostre a mão para começar",
        maoPresente ? "segure a mão no quadro" : "a contagem começa sozinha");
      break;

    case CONTAGEM: {
      const restante = jogo.restante(t);
      const n = Math.ceil(restante);
      const perdida = !maoPresente;
      texto(ctx, perdida ? "!" : String(n), w / 2, h / 2 - 10, {
        tamanho: 150, align: "center", cor: perdida ? COR.alerta : COR.destaque,
      });
      texto(ctx, perdida ? "volte com a mão para o quadro" : "prepare seu gesto", w / 2, h / 2 + 86, {
        tamanho: 20, align: "center", cor: perdida ? COR.alerta : COR.apagado, peso: 400,
      });
      break;
    }

    case RESULTADO:
      desenharRodada(ctx, w, h, jogo.ultimaRodada);
      break;

    case FIM_PARTIDA: {
      const venceu = jogo.vencedorDaPartida() === "jogador";
      faixa(ctx, w, h,
        venceu ? "Você venceu a partida!" : "O computador venceu",
        `${jogo.placar.jogador} × ${jogo.placar.computador} — tecla R para jogar de novo`);
      break;
    }
  }
}

function desenharRodada(ctx, w, h, rodada) {
  if (!rodada) return;

  if (rodada.resultado === ANULADA) {
    faixa(ctx, w, h, "Rodada anulada", MOTIVO[rodada.motivo] || rodada.motivo, COR.alerta);
    return;
  }

  const titulo = {
    [VITORIA]: "Você ganhou!",
    [DERROTA]: "Você perdeu",
    [EMPATE]: "Empate",
  }[rodada.resultado];
  const cor = { [VITORIA]: COR.vitoria, [DERROTA]: COR.derrota, [EMPATE]: COR.empate }[rodada.resultado];

  const ph = 196;
  const y = h / 2 - ph / 2;
  painel(ctx, 0, y, w, ph, 0, "rgba(8, 11, 20, 0.78)");

  const meio = w / 2;
  texto(ctx, ICONE[rodada.jogador], meio - 150, y + 72, { tamanho: 78, align: "center" });
  texto(ctx, "você", meio - 150, y + 126, { tamanho: 16, align: "center", cor: COR.apagado, peso: 400 });
  texto(ctx, "×", meio, y + 72, { tamanho: 30, align: "center", cor: COR.apagado });
  texto(ctx, ICONE[rodada.computador], meio + 150, y + 72, { tamanho: 78, align: "center" });
  texto(ctx, "computador", meio + 150, y + 126, { tamanho: 16, align: "center", cor: COR.apagado, peso: 400 });
  texto(ctx, titulo, meio, y + 166, { tamanho: 30, align: "center", cor });
}

/** Painel de depuração (tecla D): números para ajustar os parâmetros. */
export function desenharDepuracao(ctx, w, h, info) {
  const linhas = [
    `fps ............ ${info.fps.toFixed(0)}`,
    `detecção ....... ${(info.deteccao * 100).toFixed(0)}%`,
    `gesto bruto .... ${ROTULO[info.bruto]}`,
    `gesto estável .. ${ROTULO[info.estavel]}`,
    `polegar ........ ${info.polegar ? "estendido" : "recolhido"}`,
    `estado ......... ${info.estado}`,
  ];
  const bw = 250;
  const bh = 26 + linhas.length * 22;
  const x = w - bw - 18;
  painel(ctx, x, 18, bw, bh);
  linhas.forEach((linha, i) => {
    texto(ctx, linha, x + 16, 40 + i * 22, {
      tamanho: 13, cor: COR.apagado, peso: 400,
    });
  });
}

/**
 * Fundo do modo de teste, que substitui a imagem da câmera.
 * O aviso fica visível o tempo todo para não haver dúvida de que não há webcam.
 */
export function desenharFundoSimulado(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#131c33");
  grad.addColorStop(1, "#080b14");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  painel(ctx, w / 2 - 150, 18, 300, 34, 999, "rgba(255, 159, 67, 0.16)");
  texto(ctx, "MODO DE TESTE — mão simulada", w / 2, 36, {
    tamanho: 13, align: "center", cor: COR.alerta, peso: 700,
  });
}

/** Mensagem grande no centro, usada para carregamento e erros. */
export function desenharAviso(ctx, w, h, titulo, detalhe) {
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, w, h);
  texto(ctx, titulo, w / 2, h / 2 - 16, { tamanho: 28, align: "center" });
  if (detalhe) {
    const palavras = detalhe.split(" ");
    const linhas = [];
    let atual = "";
    for (const palavra of palavras) {
      if ((atual + " " + palavra).trim().length > 60) {
        linhas.push(atual.trim());
        atual = palavra;
      } else {
        atual += " " + palavra;
      }
    }
    linhas.push(atual.trim());
    linhas.forEach((linha, i) =>
      texto(ctx, linha, w / 2, h / 2 + 24 + i * 24, {
        tamanho: 16, align: "center", cor: COR.apagado, peso: 400,
      })
    );
  }
}
