#!/bin/zsh
# Hace que Jarvis.app arranque sola al iniciar sesión (y la arranca ahora).
set -e
APP=${JARVIS_APP:-/Applications/Jarvis.app}
[[ -x $APP/Contents/MacOS/Jarvis ]] || APP=~/Applications/Jarvis.app
[[ -x $APP/Contents/MacOS/Jarvis ]] || { echo "Primero crea la app: ./empaquetar/crear_app.sh"; exit 1; }
PLIST="$HOME/Library/LaunchAgents/com.jarvis.escritorio.plist"
ROOT=${0:A:h:h}
# El mismo plist que escribe el interruptor «Arrancar al iniciar sesión» de Ajustes.
# (Con el Python del proyecto: el lanzador de Jarvis.app ya no acepta `-c`.)
"$ROOT/.venv/bin/python" -c "import sys; sys.path.insert(0, sys.argv[1] + '/jarvis'); import control; control._ejecutable_app = lambda: [sys.argv[2]]; control.poner_autoarranque(True)" "$ROOT" "$APP/Contents/MacOS/Jarvis"
launchctl bootout gui/$(id -u)/com.jarvis.escritorio 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$PLIST"
echo "Jarvis arrancará solo al iniciar sesión (ya está en marcha). Registro: ~/Library/Logs/jarvis.log"
