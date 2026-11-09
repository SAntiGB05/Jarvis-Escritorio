# Jarvis de escritorio

Asistente de voz para macOS empaquetado como `Jarvis.app` (barra de menús).
Esfera flotante que aparece arriba a la derecha al decir la palabra de
activación («Raphael» por defecto). Doble clic en la esfera la desactiva y
descarta la petición.

## Estructura

- `jarvis/` — código Python (todo módulo importa rutas desde `rutas.py`)
  - `control.py` — la app: barra de menús, ventana de ajustes (pywebview) con el puente `Api`, y el motor como proceso hijo
  - `motor.py` — esfera flotante y ciclo escuchar → pensar → hablar; aplica `data/orb.json` en vivo y registra `data/actividad.jsonl`
  - `oido.py` — palabra de activación (`JARVIS_WAKE_WORD`, frases cortas transcritas con Whisper) y transcripción local
  - `voz.py` — edge-tts y reproducción con nivel de audio para la esfera
  - `cerebro.py` — subclase de `brain.Brain` (proceso `claude -p`) limitada a `acciones_mcp.py`; genera `cerebro/mcp.json` y el hook `cerebro/.claude/settings.json`
  - `acciones_mcp.py` — las únicas herramientas: apps, Spotify, recordatorios, volumen, hora, clima, Wikipedia, páginas de `sitios_permitidos.txt`, abrir los ajustes
  - `limitar_busqueda.py` — hook PreToolUse que limita WebSearch a `sitios_permitidos.txt`
  - `brain.py`, `claude_env.py`, `usage_store.py`, `data_paths.py` (reducido) — del proyecto original (ethanplusai/jarvis, licencia de uso personal)
- `cerebro/CLAUDE.md` — instrucciones del cerebro (nombre y personalidad llegan por `JARVIS_NAME` / `JARVIS_PERSONA`)
- `interfaz/orbe/` — la esfera (Three.js, `vendor/three`)
- `interfaz/ajustes/` — ventana de ajustes en React + Vite + TS (`npm run build` → `dist/`, con enlace `dist/orbe → ../../orbe`)
- `empaquetar/` — `crear_app.sh`, `lanzador.c` (ejecutable nativo que incrusta Python.framework y usa el `.venv`), `Info.plist`, `icono.py`
- `scripts/` — iniciar, detener, instalar/quitar el arranque al iniciar sesión

## Reglas

Toda red pasa por `acciones_mcp._get`, que exige HTTPS y un dominio de la
lista (también en redirecciones). AppleScript siempre con `argv`, nunca
interpolando texto del usuario.

Ajustes: `.env` (se aplica al reiniciar el motor), `data/orb.json` y
`sitios_permitidos.txt` (al instante). La app y el motor se avisan con
archivos en `data/avisos/` (`abrir_ajustes`, `salir`, `vista_previa.json`).
