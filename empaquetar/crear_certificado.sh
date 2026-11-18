#!/bin/zsh
# Crea (una sola vez) un certificado local de firma de código «Jarvis Local» en
# tu llavero de inicio de sesión. Con él, crear_app.sh firma Jarvis.app siempre
# con la MISMA identidad y macOS conserva los permisos (Micrófono,
# Accesibilidad, Automatización…) entre recompilaciones. Con la firma ad hoc,
# cada recompilación es «otra app» y los vuelve a pedir.
#
# El certificado es autofirmado y solo sirve para firmar código en este Mac:
# no se marca como de confianza ni cambia ningún ajuste del sistema.
#
#   ./empaquetar/crear_certificado.sh
set -euo pipefail

NOMBRE="Jarvis Local"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"
OPENSSL=/usr/bin/openssl          # LibreSSL del sistema: genera un .p12 que el Llavero acepta

if security find-certificate -c "$NOMBRE" "$KEYCHAIN" >/dev/null 2>&1; then
  echo "El certificado «$NOMBRE» ya existe en tu llavero. Nada que hacer."
  exit 0
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
chmod 700 "$TMP"
PASS=$($OPENSSL rand -hex 16)      # clave temporal del .p12 (se borra al terminar)

cat > "$TMP/cfg" <<EOF
[ req ]
distinguished_name = dn
prompt = no
x509_extensions = ext
[ dn ]
CN = $NOMBRE
[ ext ]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
subjectKeyIdentifier = hash
EOF

$OPENSSL req -x509 -newkey rsa:2048 -nodes -days 3650 -config "$TMP/cfg" \
  -keyout "$TMP/key.pem" -out "$TMP/cert.pem" 2>/dev/null
$OPENSSL pkcs12 -export -inkey "$TMP/key.pem" -in "$TMP/cert.pem" \
  -name "$NOMBRE" -out "$TMP/jarvis.p12" -passout "pass:$PASS"

# -T: codesign puede usar la clave sin preguntar cada vez.
security import "$TMP/jarvis.p12" -k "$KEYCHAIN" -P "$PASS" -T /usr/bin/codesign >/dev/null

echo "Listo: certificado «$NOMBRE» creado en tu llavero."
echo "Ahora ejecuta ./empaquetar/crear_app.sh (la primera vez macOS puede preguntar"
echo "si codesign puede usar la clave: pulsa «Permitir siempre»)."
