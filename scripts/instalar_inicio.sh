#!/bin/zsh
# Hace que Jarvis.app arranque sola al iniciar sesión (y la arranca ahora).
set -e
APP=${JARVIS_APP:-/Applications/Jarvis.app}
[[ -x $APP/Contents/MacOS/Jarvis ]] || APP=~/Applications/Jarvis.app
[[ -x $APP/Contents/MacOS/Jarvis ]] || { echo "Primero crea la app: ./empaquetar/crear_app.sh"; exit 1; }
PLIST="$HOME/Library/LaunchAgents/com.jarvis.escritorio.plist"
# El mismo plist que escribe el interruptor «Arrancar al iniciar sesión» de Ajustes.
"$APP/Contents/MacOS/Jarvis" -c "import control; control.poner_autoarranque(True)"
launchctl bootout gui/$(id -u)/com.jarvis.escritorio 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$PLIST"
echo "Jarvis arrancará solo al iniciar sesión (ya está en marcha). Registro: ~/Library/Logs/jarvis.log"
