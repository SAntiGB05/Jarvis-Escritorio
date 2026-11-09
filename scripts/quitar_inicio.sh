#!/bin/zsh
# Quita Jarvis del arranque automático (si estaba abierto así, se cierra).
launchctl bootout gui/$(id -u)/com.jarvis.escritorio 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/com.jarvis.escritorio.plist"
echo "Jarvis ya no arrancará solo. Ábrelo desde Aplicaciones cuando quieras."
