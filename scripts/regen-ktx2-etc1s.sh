#!/usr/bin/env bash
#
# Rigenera le texture KTX2 in ETC1S e rimuove i JPG/PNG duplicati.
#
# CONTESTO
#   La prima conversione (W-2) usava UASTC per normal/roughness: qualità alta
#   ma file 5-9x PIU GRANDI dei JPG di partenza (totale 1,4 MB -> 4,6 MB).
#   Poiche entrambi i formati venivano spediti al client, il costo di banda
#   era ~5,9 MB invece di 1,4 MB.
#
#   ETC1S (Basis LZ) e' molto piu compatto e resta compresso in VRAM: si tiene
#   il vantaggio GPU di KTX2 senza la penalita di download.
#
# USO
#   chmod +x scripts/regen-ktx2-etc1s.sh
#   TOKTX=/percorso/a/toktx ./scripts/regen-ktx2-etc1s.sh
#
#   Senza argomenti fa un DRY-RUN (mostra cosa farebbe, non tocca nulla).
#   Per applicare davvero:  ./scripts/regen-ktx2-etc1s.sh --apply
#
set -euo pipefail

TEX_DIR="$(cd "$(dirname "$0")/.." && pwd)/public/textures"
TOKTX="${TOKTX:-toktx}"
APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

if ! command -v "$TOKTX" >/dev/null 2>&1 && [ ! -x "$TOKTX" ]; then
  echo "ERRORE: toktx non trovato. Installa KTX-Software o passa TOKTX=/percorso/toktx" >&2
  exit 1
fi

echo "Directory texture: $TEX_DIR"
[ "$APPLY" -eq 0 ] && echo ">>> DRY-RUN: nessun file verra' modificato. Usa --apply per eseguire." && echo

before=$(du -sb "$TEX_DIR" | cut -f1)
converted=0
removed=0

for src in "$TEX_DIR"/*.jpg "$TEX_DIR"/*.png; do
  [ -e "$src" ] || continue
  base="${src%.*}"
  out="$base.ktx2"

  # Le mappe non-colore (normal/roughness/ao) non vanno interpretate come sRGB.
  case "$(basename "$base")" in
    *normal*|*roughness*|*ao|*ambientocclusion) LINEAR="--assign_oetf linear" ;;
    *)                                          LINEAR="" ;;
  esac

  echo "  ETC1S  $(basename "$src")  ->  $(basename "$out")"
  if [ "$APPLY" -eq 1 ]; then
    # --encode etc1s  : Basis LZ, molto compatto
    # --clevel 4      : qualita' di compressione (0-5), 4 e' un buon compromesso
    # --qlevel 192    : qualita' percettiva (1-255)
    # --genmipmap     : mipmap generate a monte, niente costo a runtime
    # shellcheck disable=SC2086
    "$TOKTX" --encode etc1s --clevel 4 --qlevel 192 --genmipmap $LINEAR "$out" "$src"
    converted=$((converted + 1))
  fi
done

echo
echo "Rimozione dei sorgenti con controparte .ktx2:"
for src in "$TEX_DIR"/*.jpg "$TEX_DIR"/*.png; do
  [ -e "$src" ] || continue
  base="${src%.*}"
  if [ -f "$base.ktx2" ]; then
    echo "  rm $(basename "$src")"
    if [ "$APPLY" -eq 1 ]; then
      rm -f "$src"
      removed=$((removed + 1))
    fi
  fi
done

if [ "$APPLY" -eq 1 ]; then
  after=$(du -sb "$TEX_DIR" | cut -f1)
  echo
  echo "Convertite: $converted   Rimosse: $removed"
  echo "Dimensione: $(numfmt --to=iec "$before")  ->  $(numfmt --to=iec "$after")"
  echo
  echo "RICORDA: dopo questo script le texture esistono SOLO in .ktx2."
  echo "Aggiorna Materials.loadPbrTextureSet perche' non tenti piu' il .jpg."
fi
