# Jarvis de escritorio

Jarvis de escritorio es un asistente de voz para macOS que vive en la barra de menús. Al decir su palabra de activación aparece una esfera de partículas animada (Three.js) que escucha tu petición, la resuelve con Claude (a través de tu suscripción a Claude Code, sin API key) y te responde con una voz neural gratuita de Microsoft Edge.

- 🎙️ **Privado:** la palabra de activación y la transcripción se hacen en tu Mac con Whisper; solo el texto llega al cerebro.
- 🔒 **Limitado a propósito:** solo puede usar sus herramientas (apps, Spotify, Recordatorios, volumen, hora, clima, Wikipedia). En internet solo entra a los sitios oficiales de una lista blanca.
- ⚙️ **Configurable:** una ventana de ajustes en React para cambiar nombre, palabra de activación, personalidad, modelo (Haiku, Sonnet u Opus), voz, sensibilidad del micrófono, el aspecto de la esfera y los sitios permitidos, y para ver permisos, uso de Claude y actividad.
- 🍎 **App nativa:** `Jarvis.app` con un lanzador propio en C, arranque al iniciar sesión e icono en la barra de menús.

## Origen

Este proyecto parte de ethanplusai/jarvis (https://github.com/ethanplusai/jarvis), pero está muy modificado. Del original se mantienen el núcleo del cerebro (`brain.py`) y algunas utilidades. Todo lo demás se rehízo o es nuevo: el panel web y sus herramientas se sustituyeron por una esfera flotante, se añadieron la escucha local en español, la voz, las herramientas limitadas por MCP, la lista blanca de internet, la ventana de ajustes y el empaquetado como app de macOS. Se distribuye bajo la misma licencia del original: **solo uso personal** (ver LICENSE).

Hecho con Python (pywebview, faster-whisper, edge-tts, PyObjC), React + Vite + TypeScript y MCP.

## Uso

Di **"Raphael"** (o la palabra que elijas) y aparece la esfera arriba a la
derecha. **Doble clic en la esfera** mientras está activa: se desactiva y
descarta lo que le pediste (corta la escucha, la respuesta y la voz).

## La app

`Jarvis.app` vive en la barra de menús (icono de la esfera, sin icono en el
Dock). Desde ahí: **Abrir ajustes…** (⌘,), detener/iniciar, reiniciar y salir.
También puedes decir «Raphael, abre los ajustes» o abrir Jarvis desde
Spotlight.

La ventana de ajustes permite cambiar nombre, palabra de activación,
personalidad, cerebro (Haiku/Sonnet/Opus), voz, oído, el orbe (color, tamaño,
densidad, posición…), Spotify, clima y los sitios permitidos, y ver permisos,
uso de Claude y actividad.

- El orbe y los sitios permitidos se aplican al instante.
- Lo demás se guarda en `.env` y se aplica al pulsar **Reiniciar ahora**.

## Instalar / actualizar

Requisitos: macOS 13+, Python 3.12 de Homebrew, Node.js y
[Claude Code](https://claude.com/claude-code) con tu sesión iniciada.

```sh
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
./empaquetar/crear_app.sh          # construye e instala /Applications/Jarvis.app
./scripts/instalar_inicio.sh       # que arranque sola al iniciar sesión (y la abre)
```

La primera vez, macOS pedirá permisos para **Jarvis**: Micrófono,
Accesibilidad (para que Spotify reproduzca solo) y Automatización. Están en
Ajustes → Sistema, con un botón para cada uno.

La app usa el código y el `.venv` de esta carpeta: si la mueves, vuelve a
ejecutar `crear_app.sh`. Cambiar código Python no requiere reconstruir, solo
reiniciar Jarvis.

- Abrir sin ventana: `./scripts/iniciar.sh` · cerrar: `./scripts/detener.sh`
- Quitar del arranque automático: `./scripts/quitar_inicio.sh`
- Registro: `~/Library/Logs/jarvis.log`
- Desarrollar la ventana de ajustes: `cd interfaz/ajustes && npm run dev` (datos de ejemplo)

## Estructura

```
jarvis/        código Python: app (control), motor, oído, voz, cerebro, herramientas
cerebro/       carpeta de trabajo del cerebro (sus instrucciones)
interfaz/
  orbe/        la esfera (Three.js)
  ajustes/     ventana de ajustes (React + Vite + TypeScript)
empaquetar/    construcción de Jarvis.app (lanzador nativo, icono, Info.plist)
scripts/       iniciar, detener y arranque automático
sitios_permitidos.txt   lista blanca de internet
```
