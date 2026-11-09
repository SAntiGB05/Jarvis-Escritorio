# Jarvis de escritorio

Jarvis de escritorio es un asistente de voz para macOS que vive en la barra de menús. Al decir su palabra de activación aparece una esfera de partículas animada (Three.js) que escucha tu petición, la resuelve con Claude (a través de tu suscripción a Claude Code, sin API key) y te responde con una voz neural gratuita de Microsoft Edge.

- 🎙️ **Privado:** la palabra de activación y la transcripción se hacen en tu Mac con Whisper; solo el texto llega al cerebro.
- 🔒 **Limitado a propósito:** solo puede usar sus herramientas (apps, Spotify, Recordatorios, volumen, hora, clima, Wikipedia). En internet solo entra a los sitios oficiales de una lista blanca.
- ⚙️ **Configurable:** una ventana de ajustes en React para cambiar nombre, palabra de activación, personalidad, modelo (Haiku, Sonnet u Opus), voz, sensibilidad del micrófono, el aspecto de la esfera y los sitios permitidos, y para ver permisos, uso de Claude y actividad.
- 🍎 **App nativa:** `Jarvis.app` con un lanzador propio en C, arranque al iniciar sesión e icono en la barra de menús.

## Origen

Este proyecto parte de ethanplusai/jarvis (https://github.com/ethanplusai/jarvis), pero está muy modificado. Del original se mantienen el núcleo del cerebro (`brain.py`) y algunas utilidades. Todo lo demás se rehízo o es nuevo: el panel web y sus herramientas se sustituyeron por una esfera flotante, se añadieron la escucha local en español, la voz, las herramientas limitadas por MCP, la lista blanca de internet, la ventana de ajustes y el empaquetado como app de macOS. Se distribuye bajo la misma licencia del original: **solo uso personal** (ver LICENSE).

Hecho con Python (pywebview, faster-whisper, edge-tts, PyObjC), React + Vite + TypeScript y MCP.
