# Pedra, papel e tesoura com MediaPipe

**▶ Jogar: <https://tonbarbos.github.io/DeepLearning_C3_PPT/>**

Aplicação web que reconhece pedra, papel e tesoura a partir dos 21 pontos da
mão detectados pelo **MediaPipe Hand Landmarker** (API Tasks para Web). Depois
de uma contagem regressiva, o gesto do jogador é travado e comparado com a
jogada sorteada pela máquina. O placar é mantido entre as rodadas, em partidas
de melhor de 5.

Não há nada para instalar nem para baixar: basta abrir o link acima em um
navegador e autorizar a câmera.

Trabalho 2 (C2) — Visão Computacional · Computação · FAESA · 2026/2.

## Jogando pelo navegador

1. Abra <https://tonbarbos.github.io/DeepLearning_C3_PPT/>.
2. Autorize o acesso à câmera quando o navegador pedir.
3. Mostre a mão: depois de um instante a contagem de 3 começa sozinha.
4. Faça o gesto antes do fim da contagem e **segure** — a jogada é travada pela
   leitura do último meio segundo.
5. Vence a partida quem fizer 3 pontos primeiro.

Na primeira vez o navegador baixa cerca de 8 MB do MediaPipe (biblioteca e
modelo) e guarda em cache; as visitas seguintes abrem na hora.

> **Por que funciona no GitHub Pages?** A câmera só é liberada em contexto
> seguro, e o Pages serve por `https`. Pela mesma razão, abrir o `index.html`
> direto do disco (`file://`) **não funciona** — veja a seção seguinte.

### Sem webcam

```
https://tonbarbos.github.io/DeepLearning_C3_PPT/?teste=1
```

Esse modo substitui a câmera por uma mão sintética que percorre os três gestos e
some de tempos em tempos, exercitando inclusive o comportamento de perda de
detecção. Serve para conferir o jogo em uma máquina sem câmera — é o equivalente
ao `--video` do Fruit Ninja da Aula 12.

### Teclas

| Tecla | Efeito |
|---|---|
| `R` | nova partida |
| `E` | liga/desliga o esqueleto da mão |
| `D` | painel de depuração (fps, taxa de detecção, gesto bruto e estável) |

## Rodando localmente

Só é necessário para desenvolver ou para rodar os testes. Como a câmera exige
contexto seguro, é preciso servir a pasta — `localhost` conta como seguro:

```bash
git clone https://github.com/Tonbarbos/DeepLearning_C3_PPT.git
cd DeepLearning_C3_PPT
python -m http.server 8000
```

Depois abra <http://localhost:8000>.

## Testes

```bash
node js/testes.js
```

24 testes cobrindo a classificação dos gestos (incluindo invariância a rotação e
a escala), a estabilização, a janela de votação e a partida inteira — máquina de
estados, rodada anulada, melhor de N e reprodutibilidade com semente.

Eles rodam **sem navegador e sem webcam**: `gestos.js` e `logica.js` não importam
MediaPipe nem tocam no DOM, exatamente como o `logica.py` da Aula 12.

## Como o gesto é reconhecido

O MediaPipe entrega apenas as coordenadas dos 21 pontos. Toda a decisão sobre
qual gesto está sendo feito é do projeto, em `js/gestos.js`:

1. **Dedo estendido**: a ponta está mais longe do pulso do que a junta do meio
   daquele dedo. Comparar *distâncias ao pulso*, e não coordenadas `y`, faz o
   teste continuar valendo com a mão girada — há um teste para isso.
2. **Padrão dos quatro dedos longos** (indicador, médio, anelar, mínimo):
   `0000` → pedra, `1111` → papel, `1100` → tesoura. Qualquer outro padrão vira
   **indefinido**.
3. **O polegar é medido mas não decide**: é o ponto mais instável dos 21. A
   medida fica disponível para a C3.
4. **Estabilização**: o gesto só é aceito depois de aparecer em 5 quadros
   seguidos, evitando que a leitura pisque.
5. **Trava da jogada**: no fim da contagem, vale a **moda** das leituras do
   último meio segundo, com mínimo de 4 leituras válidas. Um único quadro ruim
   não decide a rodada.

A jogada da máquina é sorteada **no início da contagem**, antes de o gesto do
jogador ser lido: assim não há como reagir ao que ela tirou.

O Gesture Recognizer pronto do MediaPipe **não** foi usado: ele já devolveria
`Closed_Fist`, `Open_Palm` e `Victory`, e a tabela de ideias da especificação
aponta MediaPipe Hands para este projeto.

## Quando a detecção se perde

| Situação | Comportamento |
|---|---|
| Mão fora do quadro, fora de rodada | Crachá mostra "sem mão"; a contagem não começa |
| Mão some por menos de 1 s durante a contagem | Tolerado, a rodada segue |
| Mão some por mais de 1 s durante a contagem | **Rodada anulada**, aviso na tela, ninguém pontua |
| Mão presente mas gesto irreconhecível na revelação | **Rodada anulada** por gesto indefinido |

## Arquivos

| Arquivo | Conteúdo | Depende de |
|---|---|---|
| `index.html` | Página, canvas e instruções | — |
| `css/estilo.css` | Aparência da página | — |
| `js/pontos.js` | Índices dos landmarks e esqueleto | nada |
| `js/gestos.js` | Classificação dos gestos e estabilização | `pontos.js` |
| `js/logica.js` | Máquina de estados, regras, placar | `gestos.js` |
| `js/simulador.js` | Mão sintética para testes e modo `?teste=1` | `pontos.js` |
| `js/maos.js` | Webcam e MediaPipe Hand Landmarker | MediaPipe |
| `js/visual.js` | Desenho no canvas | `pontos.js` |
| `js/main.js` | Laço principal que liga as camadas | todos |
| `js/testes.js` | Testes da lógica e dos gestos | Node |

A separação é a mesma recomendada na especificação: dá para mudar uma regra do
jogo sem tocar na parte de visão computacional, e o contrário também vale.

O projeto é estático — sem build, sem bundler, sem `npm install`. É por isso que
o GitHub Pages consegue servi-lo direto da branch `main`, sem nenhuma etapa de
publicação. Todos os caminhos são relativos, então o site funciona no subcaminho
`/DeepLearning_C3_PPT/` sem ajuste.

## Caminho para a C3

A estrutura já está preparada:

- `jogo.historico` guarda todas as rodadas desde a primeira partida — é a base
  para o adversário que reage ao histórico de jogadas;
- `Rastreador.criar({ numMaos: 2 })` basta para a partida entre dois jogadores na
  mesma câmera; a classificação é por mão e não muda;
- `PARAMETROS` em `gestos.js` concentra os limiares, para ajuste fino.

## Verificação feita

- `node js/testes.js`: 24 testes, todos passando.
- Página servida em `localhost` e carregada no navegador: o MediaPipe inicializa
  (WASM + modelo baixados, `Graph successfully started running`) e o jogo roda o
  ciclo completo — contagem, revelação, placar e rodada anulada — verificado no
  modo `?teste=1`.
- **A captura por webcam física depende de teste manual** e não foi verificada
  em ambiente automatizado.

## Créditos

Modelo, biblioteca e material de origem estão listados em
[CREDITOS.md](CREDITOS.md). Nenhuma imagem ou som de terceiros é usado: os
ícones dos gestos são emoji da fonte do sistema.
