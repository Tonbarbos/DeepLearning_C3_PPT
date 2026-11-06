# Pedra, papel e tesoura com MediaPipe

Aplicação web que reconhece pedra, papel e tesoura a partir dos 21 pontos da
mão detectados pelo **MediaPipe Hand Landmarker** (API Tasks para Web). Depois
de uma contagem regressiva, o gesto do jogador é travado e comparado com a
jogada sorteada pela máquina. O placar é mantido entre as rodadas, em partidas
de melhor de 5.

Trabalho 2 (C2) — Visão Computacional · Computação · FAESA · 2026/2.

## Como executar

A câmera do navegador só funciona em **contexto seguro**: `http://localhost` ou
`https://`. Abrir o `index.html` direto pelo `file://` **não funciona**.

```bash
python -m http.server 8000
```

Depois abra <http://localhost:8000> e autorize o acesso à câmera.

Não há nada para instalar: o MediaPipe é carregado de CDN e o modelo
(`hand_landmarker.task`, ~8 MB) é baixado pelo navegador na primeira execução e
fica em cache.

### Sem webcam

```
http://localhost:8000/?teste=1
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

O Gesture Recognizer pronto do MediaPipe **não** foi usado de propósito: ele já
devolveria `Closed_Fist`, `Open_Palm` e `Victory`, entregando à biblioteca
justamente o problema que o trabalho pede que a equipe resolva.

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
  neste ambiente.
