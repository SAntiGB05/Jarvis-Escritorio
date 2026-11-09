#!/bin/zsh
# Construye Jarvis.app y la instala (por defecto en /Applications).
#
#   ./empaquetar/crear_app.sh                 → /Applications/Jarvis.app
#   ./empaquetar/crear_app.sh ~/Applications  → otra carpeta
#
# La app usa el código y el .venv de ESTA carpeta: si mueves el proyecto,
# vuelve a ejecutar este script.
set -euo pipefail

ROOT=${0:A:h:h}
DEST_DIR=${1:-/Applications}
APP_NAME=Jarvis.app
BUILD=$ROOT/empaquetar/build
APP=$BUILD/$APP_NAME
PY=$ROOT/.venv/bin/python

[[ -x $PY ]] || { echo "Falta el entorno: python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt"; exit 1; }
SITE=$($PY -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')
INC=$($PY -c 'import sysconfig; print(sysconfig.get_paths()["include"])')
LIBPY=$($PY -c 'import sys; print(sys.base_prefix)')/Python      # Python.framework/Versions/3.x/Python
[[ -f $LIBPY ]] || { echo "No encuentro $LIBPY (¿Python de Homebrew en framework?)"; exit 1; }

echo "1/5  Ventana de ajustes (React)…"
(cd $ROOT/interfaz/ajustes && { [[ -d node_modules ]] || npm install --no-audit --no-fund; } && npm run build >/dev/null)

echo "2/5  Lanzador nativo…"
rm -rf $APP
mkdir -p $APP/Contents/MacOS $APP/Contents/Resources
clang -O2 -Wall -mmacosx-version-min=$(sw_vers -productVersion | cut -d. -f1).0 \
  -I"$INC" "$LIBPY" \
  -DJARVIS_ROOT="\"$ROOT\"" -DJARVIS_SITE="\"$SITE\"" \
  -o $APP/Contents/MacOS/Jarvis $ROOT/empaquetar/lanzador.c

echo "3/5  Info.plist e icono…"
cp $ROOT/empaquetar/Info.plist $APP/Contents/Info.plist
printf 'APPL????' > $APP/Contents/PkgInfo
$PY $ROOT/empaquetar/icono.py $APP/Contents/Resources >/dev/null
rm -f $APP/Contents/Resources/icono.png

echo "4/5  Firma local (ad hoc)…"
xattr -cr $APP
codesign --force --sign - --identifier com.jarvis.escritorio $APP

echo "5/5  Instalando en $DEST_DIR…"
# Cierra lo que esté corriendo (aviso «salir») y cualquier servicio de launchd anterior.
mkdir -p $ROOT/data/avisos
if [[ -f $ROOT/data/control.lock ]] && ! $PY -c "import fcntl,sys; f=open(sys.argv[1]); fcntl.flock(f, fcntl.LOCK_EX|fcntl.LOCK_NB)" $ROOT/data/control.lock 2>/dev/null; then
  touch $ROOT/data/avisos/salir
  for i in {1..40}; do
    $PY -c "import fcntl,sys; f=open(sys.argv[1]); fcntl.flock(f, fcntl.LOCK_EX|fcntl.LOCK_NB)" $ROOT/data/control.lock 2>/dev/null && break
    sleep 0.25
  done
fi
launchctl bootout gui/$(id -u)/com.jarvis.escritorio 2>/dev/null || true
mkdir -p $DEST_DIR
rm -rf $DEST_DIR/$APP_NAME
ditto $APP $DEST_DIR/$APP_NAME
touch $DEST_DIR/$APP_NAME   # que Finder y Spotlight vean el icono nuevo

echo
echo "Listo: $DEST_DIR/$APP_NAME"
echo "  • Arranque al iniciar sesión: ./scripts/instalar_inicio.sh"
echo "  • Ábrela desde Aplicaciones o Spotlight; la primera vez macOS pedirá permisos."
