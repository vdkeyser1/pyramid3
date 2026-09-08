# Pyramid art direction — changelog (2026-08-25)

Identità: **piramide egizia / Egyptian Noir**, non dungeon medievale.

## Completato (filone ambiente)

| Step | Dettaglio |
|---|---|
| Soglie | Stipiti + architrave dorato procedurali |
| Props pavimento | Solo anfora/detriti (`pot`/`rocks`) |
| Registry + script | Kenney dungeon rimosso; `-EgyptianFolder` per import |
| Stanze speciali | Khopesh, scudi a disco, canopi/altari procedurali |
| Decor stanze | False porte funerarie; coppe d'offerta (no tappeti) |
| Torcia posata | `EgyptianOilLamp` procedurale |
| Lampade corridoi | `createWallSconce` sui muri delle gallerie |
| Scala discesa | Bordi dorati + cavetto in cima (`Staircase.ts`) |
| Viewmodel | Khopesh, bastone Ra, pala, pugni procedurali |
| GLB | Meshopt su enemies/landmarks/props |
| Landmark GLB | 5/5 ToxSam integrati + 13 procedurali `EgyptianLandmarks` |

## Non usare

- Quaternius Modular Dungeons / Ultimate Modular Ruins (Medieval)
- Kenney barrel, gate, banner, wood, chest
- KayKit colonne/scudi/torce come ambiente

## Prossimi passi (post-VS, non bloccanti)

- Mixamo animazioni su PRIEST/ROYAL_MUMMY
- HDRI Poly Haven deserto (T2 roadmap)
- Import GLB egizi extra in `public/models/egyptian/`
- Simulazione su Web Worker (architettura futura)

## Comandi utili

```powershell
# Filler pietra neutro (opzionale)
pwsh -File scripts/download-external-assets.ps1 -KenneyStoneOnly

# Import pack egizio
pwsh -File scripts/download-external-assets.ps1 -SkipKenney -EgyptianFolder "<path>"

# Ottimizza GLB
node scripts/optimize-assets.mjs
```
