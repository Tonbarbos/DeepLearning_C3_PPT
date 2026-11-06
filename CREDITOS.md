# Créditos e origem do conteúdo de terceiros

## Modelo e biblioteca

- **MediaPipe Hand Landmarker** (Google), licença Apache 2.0.
  Modelo `hand_landmarker.task`, versão float16, carregado em tempo de execução de
  `https://storage.googleapis.com/mediapipe-models/hand_landmarker/`.
- **MediaPipe Tasks Vision para Web**, versão 1.2.2, carregada de
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/`.
  Documentação: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js
- Zhang et al., *MediaPipe Hands: On-device Real-time Hand Tracking* (2020) —
  detector de palma e modelo de landmarks usados pelo Hand Landmarker.

## Código de terceiros

- A organização em camadas (`maos` / `logica` / `visual` / laço principal), a
  suavização por quadros e a ideia de debounce com histerese foram **adaptadas do
  Fruit Ninja da Aula 12** da disciplina (Prof. Gabriel Soares Baptista).
  Nenhuma linha foi copiada: o projeto é em JavaScript e o Fruit Ninja em Python,
  mas a estrutura e os conceitos vieram de lá.

## Imagens e sons

- **Nenhum arquivo de imagem ou som de terceiros é usado.**
  Os ícones dos gestos são os emoji ✊ ✋ ✌️ desenhados com a fonte do sistema, e
  todo o resto da interface é desenhado com primitivas do canvas.
