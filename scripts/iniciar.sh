#!/bin/zsh
# Abre Jarvis.app sin mostrar la ventana de ajustes.
APP=/Applications/Jarvis.app
[[ -d $APP ]] || APP=~/Applications/Jarvis.app
[[ -d $APP ]] || { echo "Primero crea la app: ./empaquetar/crear_app.sh"; exit 1; }
open "$APP" --args --sin-ventana && echo "Jarvis en marcha."
