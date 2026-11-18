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
  - `limitar_escritura.py` — hook PreToolUse de las herramientas que escriben: deniega si el turno leyó contenido externo y espera la confirmación física (doble clic, `data/avisos/confirmar.json` + `confirmado-<nonce>`)
  - `politica.py` — qué escribe, qué confirma y qué es no confiable (núcleo + manifiestos)
  - `comun.py` — utilidades compartidas (subprocess con lista y timeout, AppleScript con argv, JSON, paquetes, Llavero)
  - `fastpath.py` — comandos frecuentes sin Claude (volumen, Spotify, hora, abrir app)
  - `brain.py`, `claude_env.py`, `usage_store.py`, `data_paths.py` (reducido) — del proyecto original (ethanplusai/jarvis, licencia de uso personal)
- `paquetes/<id>/` — paquetes de capacidad: `paquete.json` (herramientas, `escritura`, `confirmacion`, `no_confiables`, `permisos_macos`), `SKILL.md` y `herramientas.py`. Activos en `data/paquetes.json`; `cerebro.py` genera con ellos `--tools`, `cerebro/.claude/skills/`, los matchers de los hooks y `--paquetes` del servidor MCP
- `cerebro/CLAUDE.md` — instrucciones del cerebro (nombre y personalidad llegan por `JARVIS_NAME` / `JARVIS_PERSONA`)
- `interfaz/orbe/` — la esfera (Three.js, `vendor/three`)
- `interfaz/ajustes/` — ventana de ajustes en React + Vite + TS (`npm run build` → `dist/`, con enlace `dist/orbe → ../../orbe`)
- `empaquetar/` — `crear_app.sh`, `lanzador.c` (ejecutable nativo que incrusta Python.framework y usa el `.venv`), `Info.plist`, `icono.py`
- `scripts/` — iniciar, detener, instalar/quitar el arranque al iniciar sesión

## Reglas

Toda red pasa por `acciones_mcp._get`, que exige HTTPS y un dominio de la
lista (también en redirecciones); las URL que elige el modelo además no pueden
llevar datos (query ≤ 200, nada con pinta de base64). AppleScript siempre con
`argv`, nunca interpolando texto del usuario. `subprocess` siempre con lista,
`cwd` y `timeout` (usar `comun.ejecutar`). Las herramientas de desarrollo solo
aceptan NOMBRES del registro `data/proyectos.json`, nunca rutas ni comandos.

Toda herramienta nueva que escriba o actúe va en `escritura` de su manifiesto
(o en `politica.BASE`); si es de riesgo, también en `confirmacion`; si devuelve
texto de terceros, en `no_confiables`.

Cambiar `motor.py`, `acciones_mcp.py`, `limitar_busqueda.py` o
`limitar_escritura.py` exige volver a ejecutar `empaquetar/crear_app.sh`
(el lanzador verifica su SHA-256). La app se firma con el certificado local «Jarvis Local»
(`empaquetar/crear_certificado.sh`) para que los permisos de macOS no se pierdan
al recompilar; sin él, `crear_app.sh` firma ad hoc.

Ajustes: `.env` (se aplica al reiniciar el motor), `data/orb.json` y
`sitios_permitidos.txt` (al instante). La app y el motor se avisan con
archivos en `data/avisos/` (0700: `abrir_ajustes`, `salir`, `vista_previa.json`,
`confirmar.json`). El secreto de Spotify está en el Llavero
(`comun.secreto_leer`), no en `.env`.
