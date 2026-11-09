#!/bin/zsh
# Cierra Jarvis.app (motor incluido) hasta que la vuelvas a abrir o inicies sesión.
cd "${0:A:h:h}"
mkdir -p data/avisos && touch data/avisos/salir
echo "Jarvis se está cerrando. Para volver a abrirlo: ./scripts/iniciar.sh o desde Aplicaciones."
