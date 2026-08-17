# 📦 Cartella asset 3D — La Piramide Perduta

Questa cartella contiene i modelli 3D del gioco. **Struttura attesa** (dal manifest `src/content/assets.ts`):

```
public/assets/
├── enemies/
│   ├── scarab.glb          (SCARAB) ✅ Beetle (Poly Pizza, CC-BY)
│   ├── mummy.glb           (MUMMY) ✅ Zombie (Poly Pizza, CC-BY)
│   ├── cobra.glb           (COBRA) ✅ Cobrangle (ToxSam, CC0)
│   ├── shabti.glb          (SHABTI) ✅ Colossus (Poly Pizza, CC-BY)
│   ├── priest.glb          (PRIEST) ✅ GhostArmature (ToxSam, CC0)
│   ├── sobek.glb           (SOBEK_SPAWN) ✅ Crocodile (Poly Pizza, CC-BY)
│   └── royal_mummy.glb     (ROYAL_MUMMY — boss) ✅ Skeleton (Poly Pizza, CC0)
└── landmarks/
    ├── brazier.glb              (braciere-eterno) ✅ FireTorch01 (ToxSam, CC0)
    ├── glyph_hieroglyphs.glb    (geroglifico-luminoso) ✅ TempleEmbelisher01 (ToxSam, CC0)
    ├── obelisk.glb              (obelisco-spezzato) ✅ Obelisk (ToxSam, CC0)
    ├── sarcophagus.glb          (sarcofago-aperto) ✅ Door_Art (ToxSam, CC0)
    └── statue_anubis.glb        (statua-anubi) ✅ GodAnubis (ToxSam, CC0)
```

## ✅ Stato asset (2026-08-14) — COMPLETO 12/12

Tutti i modelli del manifest sono presenti. Fonti:

**ToxSam/open-source-3D-assets** (CC0, [GitHub](https://github.com/ToxSam/open-source-3D-assets),
progetti tomb-chaser-1/xyz di Polygonal Mind):

| Asset nel gioco | Modello sorgente | Note |
|---|---|---|
| `landmarks/statue_anubis.glb` | GodAnubis_Art | Statua di Anubi |
| `landmarks/obelisk.glb` | Obelisk_Art | Obelisco egizio |
| `landmarks/brazier.glb` | FireTorch01_Art | Torcia murale col fuoco |
| `landmarks/glyph_hieroglyphs.glb` | TempleEmbelisher01_Art | Pannello decorato con geroglifici |
| `landmarks/sarcophagus.glb` | Door_Art | Porta del tempio decorata (usata come sarcofago) |
| `enemies/priest.glb` | GhostArmature | Fantasma → Sacerdote delle Ceneri |
| `enemies/cobra.glb` | 034_Cobrangle_Art | Cobra geometrico → Cobra delle Fessure |

**Poly Pizza** ([poly.pizza](https://poly.pizza), modelli "Poly by Google" CC-BY e community CC0):

| Asset nel gioco | Modello sorgente | Licenza |
|---|---|---|
| `enemies/scarab.glb` | Beetle (`poly.pizza/m/4yufxgZ1QQ2`) | CC-BY (Poly by Google) |
| `enemies/mummy.glb` | Zombie (`poly.pizza/m/22K0aSZkHV`) | CC-BY (Poly by Google) |
| `enemies/shabti.glb` | Colossus pre Tilt Brush (`poly.pizza/m/1JrbPYnWdeA`) | CC-BY (Darwin Yamamoto) |
| `enemies/sobek.glb` | Crocodile (`poly.pizza/m/2an6E2WjW3z`) | CC-BY (Poly by Google) |
| `enemies/royal_mummy.glb` | Skeleton (`poly.pizza/m/DM4QScSmbS`) | CC0 |

**Attribuzione CC-BY richiesta** (inclusa in credits di gioco): "Beetle, Zombie, Crocodile by Poly by Google; Colossus by Darwin Yamamoto — via Poly Pizza (CC-BY 3.0). Modelli Polygonal Mind via ToxSam registry (CC0)."

## Regole
1. **Solo .glb** (binario, non .gltf con cartelle separate) — il loader usa `GLTFLoader`.
2. **Pivot a terra** e scala unitaria: il renderer applica `scale`/`yOffset` dal manifest.
3. **Licenze**: preferire CC0; per CC-BY aggiungere l'attribuzione in `README.md` della root.
4. Ottimizzazione consigliata: `npx gltf-transform optimize in.glb out.glb --compress draco` (CLI dev-only).

## Comportamento se mancante
Il gioco **funziona comunque**: l'AssetLoader fallisce silenziosamente e il renderer usa
le primitive placeholder semantiche (G-23). Quando un .glb viene aggiunto qui, viene
caricato automaticamente al prossimo avvio — nessun codice da cambiare.
