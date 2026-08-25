# Pyramid art direction — changelog (2026-08-25)

Identità confermata: **piramide egizia / Egyptian Noir**, non dungeon medievale.

## Completato

| Step | Dettaglio |
|---|---|
| Soglie | Stipiti + architrave dorato procedurali (no `gate.glb` Kenney) |
| Props pavimento | Solo `pot` / `rocks` neutri (no barrel, chest, banner, wood) |
| Registry | Rimossi asset Kenney dungeon da `ArtifactRegistry` |
| Script asset | `download-external-assets.ps1` → `-KenneyStoneOnly` / `-EgyptianFolder` |
| Stanze speciali | Khopesh, scudi a disco, canopi/altari da `EgyptianLandmarks` |
| Decor stanze | False porte funerarie; tappeti → coppe d'offerta |
| Torcia posata | Lampada a olio procedurale (`EgyptianOilLamp.ts`), no KayKit `torch_lit` |
| GLB | Meshopt su enemies/landmarks/props in `public/assets/` |

## Non usare

- Quaternius Modular Dungeons / Ultimate Modular Ruins (tag Medieval)
- Kenney barrel, gate, banner, wood, chest
- KayKit colonne/scudi come ambiente (solo bauli loot se necessario)

## Fonti egizie consigliate

- `public/assets/landmarks/` — ToxSam CC0 (già in gioco)
- Poly Pizza / ToxSam registry filtrati "egyptian"
- Colonne `EgyptianColumn`, landmark `EgyptianLandmarks`, decor `RoomDecor`

## Prossimi passi (post-VS)

- Viewmodel falce / mani (Mixamo)
- Animazioni nemici su rig esistente
- Texture PBR geroglifici emissivi aggiuntive (OpenGameArt)
- Import GLB egizi opzionali in `public/models/egyptian/`
