#!/usr/bin/env bash
set -e

UUID="octotheme@lucas.local"
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

if ! command -v glib-compile-schemas &>/dev/null; then
    echo "Erro: 'glib-compile-schemas' não encontrado."
    echo "Fedora:  sudo dnf install glib2-devel"
    echo "Debian:  sudo apt install libglib2.0-bin"
    exit 1
fi

if [ ! -f "$SRC/metadata.json" ]; then
    echo "Erro: metadata.json não encontrado em $SRC"
    exit 1
fi

echo "==> Instalando em: $DEST"
rm -rf "$DEST"
mkdir -p "$DEST/schemas" "$DEST/media"

cp "$SRC/metadata.json" \
   "$SRC/extension.js" \
   "$SRC/prefs.js" \
   "$SRC/i18n.js" \
   "$SRC/theme-catalog.js" \
   "$SRC/theme-inventory.js" \
   "$DEST/"
cp "$SRC"/schemas/*.xml "$DEST/schemas/"
cp "$SRC"/media/* "$DEST/media/"

echo "==> Compilando schemas..."
glib-compile-schemas "$DEST/schemas"

echo ""
echo "Instalado com sucesso."
echo ""
echo "AÇÃO NECESSÁRIA:"
echo "   No Wayland, extensões novas só aparecem após novo login."
echo "   SAIA da sessão e ENTRE de novo."
echo ""
echo "Depois de logar, rode:"
echo "   gnome-extensions enable $UUID"
echo "   gnome-extensions prefs  $UUID"
