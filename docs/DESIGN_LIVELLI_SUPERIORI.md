# 🏛️ DESIGN DEI LIVELLI SUPERIORI — La Piramide Perduta

> **Scopo**: progettare e guidare l'implementazione del meta-loop multi-floor
> (G-10) — la discesa nella piramide con livelli progressivi, scale e
> difficoltà crescente. Basato su best practice consolidate dei roguelike
> (Rogue, Nethack, Spelunky, Hades, Slay the Spire) e sul design esistente
> del progetto (enemyTemplates con fasce di piano, Threat Director con
> budget, palette Egyptian Noir in ART_BIBLE).
> Stato: **bozza di design v1** (2026-08-14) — i riferimenti alle righe
> indicano dove intervenire nel codice.

---

## 1. La discesa come struttura portante

Nei roguelike classici la **discesa one-way** (Rogue, Nethack, Spelunky) è la
struttura portante: il player scende, non risale. Ogni piano è un nuovo
"capitolo" con seed proprio, difficoltà maggiore e tema visivo coerente.

**Per La Piramide Perduta**: la piramide ha **10 piani** (dall'enemyTemplates
`maxFloor: 10`). La discesa è il loop: completi il piano → trovi la **scala**
→ scendi al piano successivo. Il VS attuale (piano 1) è il tutorial
esteso della discesa.

### Vincoli di design adottati
1. **Discesa one-way**: nessun ritorno ai piani superiori (coerente con la
   narrativa "scendere per scoprire"). Il piano 1 resta rigiocabile come run.
2. **Ogni piano ha seed derivato**: `seed(n) = hash32(seedBase, n)` —
   riproducibile, deterministico, senza stato persistente del piano.
3. **La scala è il premio**: il completamento del piano (guardiana abbattuta
   + porta aperta) rivela la scala. Niente scale nascoste.
4. **Fascia nemici per piano** (già in `src/content/enemyTemplates.ts`):
   - Piano 1: SCARAB, MUMMY (guardiana)
   - Piano 2: + COBRA
   - Piano 3: + SHABTI, PRIEST
   - Piano 4: + SOBEK_SPAWN, ROYAL_MUMMY
   - Piani 5+: tier 3 pieni, varietà crescente
5. **Difficoltà crescente senza inflazione**: i nemici NON scalano HP a ogni
   piano; la difficoltà sale per **composizione** (più nemici, più tier alti,
   budget Director più alto), non per moltiplicatori di HP. Solo il boss del
   piano 4 (ROYAL_MUMMY) è un "muro" di tier 3.

---

## 2. Architettura dei piani

### 2.1 Tema per fascia (coerente con ART_BIBLE palette)

| Piano | Fascia | Tema | Palette dominante | Nemici chiave |
|---|---|---|---|---|
| 1 | Superficie | Atrio dei sigilli | Sabbia/ocra `#8A7350`, oro `#D4A05A` | SCARAB, MUMMY |
| 2 | Primo livello | Corridoi dei cobra | Sabbia + turchese `#2E8B8B` | + COBRA |
| 3 | Medio | Gallerie degli Shabti | Pietra `#6B5432` + rosso `#C77D3A` | + SHABTI, PRIEST |
| 4 | Profondo | Cripta di Sobek | Pietra scura + verde `#3A7D5A` | + SOBEK_SPAWN, ROYAL_MUMMY |
| 5-6 | Abisso | Ossario | Nero `#0B0908` + porpora `#6A334D` | tutti i tier 3 |
| 7-8 | Sotterranei | Antro del Testimone | Nero + cyan freddo | tutti + WITNESS (scripted) |
| 9-10 | Cuore | Camera del Ka | Oro puro + bianco ossa | varietà massima |

### 2.2 Room role progression
- Piano 1: ENTRY, EXIT(porta), MAP, TREASURE, FORGE, SAFE/COMBAT/OPTIONAL
- Piani 2+: **EXIT diventa STAIR** (scala) — il ruolo esistente resta, il
  rendering cambia (scala al posto della porta sigillata)
- Piani 3+: una stanza SAFE in più (rifornimento) — "respiro" dopo tier 2
- Piani 5+: stanze JUNCTION più frequenti (labirinticità crescente)

### 2.3 Parametri per piano (data-driven, nuovi)

Nuovo modulo `src/content/floorProgression.ts` (puro, immutabile):

```ts
export interface FloorProgressionDef {
  readonly floorIndex: number;
  readonly theme: string;
  readonly palette: {
    readonly wallHex: number;
    readonly floorHex: number;
    readonly accentHex: number;
  };
  readonly directorBudget: number;      // budget spawn Director
  readonly safeRoomCount: number;       // stanze SAFE extra
  readonly junctionRatio: number;       // 0..1 probabilità JUNCTION
  readonly maxConcurrentEnemies: number; // slot nemici simultanei
}
```

Tabella base: budget Director 12 → 24 → 36 → 48 → 60 (10 per piano),
maxConcurrentEnemies 2 → 3 → 4 (cap a 4 dal piano 4).

---

## 3. Le scale — design del transito

### 3.1 Geometria
La scala è **una discesa a chiocciola nel muro** (piramidale): 12 gradini
(3 giri), larghezza 1.6m, alzata 0.22m. Il player interagisce (E) alla base;
durante la discesa: fade-out 0.6s → nuovo piano → fade-in 0.6s. Nessuna
fisica di gradino: è una transizione di piano, non un percorso.

### 3.2 Rendering (nuovo in ThreeDungeonLayout)
- Aggiungere il caso `'stair'` al LandmarkPlaceholders (famiglia visiva n.10)
- Mesh: cilindro cavo (pozzo) + gradini elicoidali (BoxGeometry ruotati)
- Emissive debole turchese in cima (la "luce della scala")
- Il .glb `assets/landmarks/stairs.glb` è opzionale (fallback primitivo)

### 3.3 Gameplay
- `tryCompleteSlice` con piano non finale → `'STAIR'` (nuova risoluzione)
- `GameApplication.onStairDescend()`: `floorIndex++`, seed derivato
  `hash32(baseSeed, floorIndex)`, rigenera slice + renderer, fade
- La progressione del profilo registra `completedFloorIds.push(floorId)`

### 3.4 HUD
- Objective text: "Scendi al piano N" dopo il completamento
- `floorText`: `Piano N · Stanze rivelate X · Oro Y`

---

## 4. Progressione della difficoltà

| Piano | Budget Director | Nemici max simultanei | Fasce tier | Note |
|---|---|---|---|---|
| 1 | 12 | 2 | 1 | VS attuale |
| 2 | 22 | 3 | 1-2 | +COBRA |
| 3 | 32 | 3 | 1-3 | +SHABTI/PRIEST |
| 4 | 42 | 4 | 1-3 | boss ROYAL_MUMMY |
| 5+ | 52+ | 4 | 3 | varietà, WITNESS scripted |

**Anti-inflazione**: nessun moltiplicatore HP. Se il playtest mostra
difficoltà insufficiente, si aumenta il budget/composizione, MAI gli HP.

---

## 5. Cosa manca nel codice oggi (gap → azione)

| # | Gap | File | Azione |
|---|---|---|---|
| 1 | `floorIndex` ignorato dal generatore | `FloorGenerator.ts` | Usare `input.floorIndex` per tema/room mix |
| 2 | EXIT è sempre porta | `ThreeDungeonLayout.ts`, `FloorSceneLayout.ts` | Ruolo `STAIR` + scala rendering |
| 3 | Nessuna progressione multi-floor | `GameApplication.ts` `tryCompleteSlice` | Risoluzione `STAIR` + `onStairDescend()` |
| 4 | Budget Director fisso | `EnemySpawnDirector.ts` | Budget da `floorProgression[floorIndex]` |
| 5 | Seed piano fisso | `GameApplication.ts` | `seed(n) = hash32(base, n)` |
| 6 | Palette fissa | `ThreeRendererService.ts` | `applyFloorPalette(def)` per piano |
| 7 | Nessun test multi-floor | `tests/` | Test: seed derivato, STAIR, budget per piano |

---

## 6. Riferimenti best practice (ricerca online 2026-08-14)

- **Rogue (1980) / Moria**: "levels were not persistent — when the player
  left the level and tried to return, a new level was generated" —
  Wikipedia, Roguelike. Fondamento della discesa one-way con seed.
- **Wikipedia, Procedural generation**: la generazione a room-carving con
  ruoli (entry/exit/treasure) è il pattern dominante dei roguelike moderni.
- **RogueBasin (Articles)**: dungeon generation è la categoria più
  documentata del genere; le stanze ruolo-based (BSP + role assignment)
  sono lo standard de facto.
- **Pattern industriale (Hades, Spelunky, Slay the Spire)**: progressione
  per "regioni" con difficoltà a gradini (non lineare), temi visivi per
  fascia, e nessun grind — il design di La Piramide Perduta segue questo
  schema (tema per fascia §2.1).
- **"La scala come elemento organizzatore"** (design architetturale,
  cross-domain): in un multi-level la scala organizza lo spazio e la
  prima impressione — traslato al level design: la scala è il punto di
  riferimento visivo di ogni piano.

---

## 7. Ordine di implementazione

1. `src/content/floorProgression.ts` (dati puri + test invarianti)
2. `FloorSceneLayout.ts`: ruolo `STAIR` (tipo RoomRole esteso)
3. `FloorGenerator.ts`: usa `floorIndex` per room mix + assegnazione STAIR
4. `LandmarkPlaceholders` + `ThreeDungeonLayout`: famiglia visiva `stair`
5. `GameApplication`: `onStairDescend()` + seed derivato + fade
6. `EnemySpawnDirector`: budget da progressione
7. `ThreeRendererService`: `applyFloorPalette(def)`
8. Test + e2e multi-floor
