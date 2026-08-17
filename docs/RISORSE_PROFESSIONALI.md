# La Piramide Perduta — Risorse Professionali (asset, audio, tool, tecniche)

> **Scopo**: elenco operativo, verificato online (2026-08-13), di tutte le risorse
> necessarie per portare il vertical slice a livello professionale. Ogni voce ha:
> URL verificato, licenza, uso consigliato nel progetto e gap che chiude (G-NN).
> La maggior parte è **gratuita e royalty-free** — nessun acquisto obbligatorio.

---

## 1. Asset 3D — Nemici, personaggio, ambiente (G-13, G-14)

### 1.1 Kit ambientali modulari (CC0)

| Risorsa | Licenza | Cosa contiene | Uso nel gioco |
|---|---|---|---|
| **Quaternius — Ultimate Modular Ruins** (`quaternius.com/packs/ultimatemodularruins.html`) | **CC0** | Pack modulare di rovine: muri, colonne, archi, pavimenti, scale, detriti | Kit base per stanze/corridoi procedurali al posto dei box Three.js; dimensioni allineabili alla griglia `ROOM_SIZE_M = 12` |
| **Quaternius — Ultimate Animated Monsters / Creatures** (`quaternius.com`) | CC0 | Creature animate low-poly (retarget Mixamo-ready) | Base per MUMMY/SCARAB/SHABTI con animazioni già pronte |
| **Kenney — Game Assets** (`kenney.nl/assets`) | **CC0** | Oltre 30 pack: nature, castle, platformer, UI | Props generici (urne, casse, torce) e UI supplementare; licenza CC0 commerciale-safe |

### 1.2 Modelli singoli (Sketchfab — filtrare per licenza CC)

- **Sketchfab search `egyptian` / `egyptian prop` / `anubis` / `sarcophagus`** (`sketchfab.com/search?q=egyptian&type=models`) — migliaia di modelli; filtrare per **Downloadable + CC-BY / CC0**. Ideali: sarcofagi, statue di Anubi/Bastet/Thoth/Sobek, obelischi, vasi canopi, bracieri.
- **ToxSam/open-source-3D-assets** (GitHub, CC0) — registry di **991+ modelli GLB CC0** (da progetti metaverse) che include **Egyptian temples**: `github.com/ToxSam/open-source-3D-assets`. Struttura JSON API-friendly → si può generare il manifest di G-17 direttamente dal loro database.

### 1.3 Animazioni (rigging/retarget)

- **Mixamo** (`mixamo.com`, Adobe, gratuito con account) — animazioni umanoidi (idle, walk, attack, death, hit-react) in formato FBX/GLB, retarget automatico su skeleton custom. Per il **player viewmodel** (mani+arma) e per varianti umanoidi di PRIEST/ROYAL_MUMMY.
- **three.js SkinnedMesh examples** (`threejs.org/examples/?q=skinning`) — reference di implementazione per skeleton + skinned mesh in WebGPU.
- **VAT (Vertex Animation Textures)** — per gli sciami (SCARAB ×50): bake delle animazioni in DataTexture via `three/examples/jsm/utils/SkeletonUtils` + shader custom; il repo `notthetup/three-vat` non è più mantenuto → implementare con TSL (vedi §4).

### 1.4 Pipeline di import (G-17)

| Tool | URL | Uso |
|---|---|---|
| **GLTFLoader** | `three/examples/jsm/loaders/GLTFLoader.js` (già in `three` 0.185) | Caricamento .glb — **zero nuove dipendenze** |
| **gltf-transform** | `gltf-transform.dev` (CLI/Node) | Ottimizzazione pre-build: Draco/meshopt compression, quantizzazione, dedup, LOD — script CI `npm run assets:optimize` |
| **@gltf-transform/cli** | npm | `gltf-transform optimize in.glb out.glb --compress draco` in pipeline |
| **DRACOLoader / KTX2Loader** | `three/examples/jsm/loaders/` | Texture compresse (Basis/KTX2) per performance mobile |
| **Blender** (esterno) | `blender.org` | Modellazione/rigging/retopology degli asset prima dell'export glTF 2.0 |

---

## 2. Texture e materiali PBR (G-14, G-16)

### 2.1 Librerie texture (tutte CC0)

| Risorsa | Licenza | Uso |
|---|---|---|
| **ambientCG** (`ambientcg.com`, search `sand`, `rock`, `stone`) | **CC0** | Texture PBR 4K/8K: sabbia (floor), pietra calcarea (muri), arenaria — tutte con albedo/roughness/normal/height |
| **Poly Haven** (`polyhaven.com/textures`, `polyhaven.com/hdris`) | **CC0** | Texture PBR + **HDRI** per ambient lighting/reflection (es. "Sand Dunes", "Desert") |
| **OpenGameArt — ancient-egypt-0** (`opengameart.org/content/ancient-egypt-0`) | **CC0** | **Geroglifici** (3 fogli), texture papiro, rosetta stone, piramide — perfetti per i landmark `geroglifico-luminoso`, `ankh-murale`, e per l'HUD "papiro" |
| **OpenGameArt — egyptian-rpg** (`opengameart.org/content/egyptian-rpg`) | CC0 | Texture/pattern egizi aggiuntivi |
| **OpenGameArt — egyptian-tileset** | CC0 | Tileset egizio (se si vuole variante 2D/top-down) |

### 2.2 Materiali custom (G-16) — tecniche Three.js 0.185

- **Geroglifici luminosi pulsanti**: texture geroglifica come `emissiveMap` + `onBeforeCompile` per modulare l'intensità con il tempo (o Node Material TSL).
- **Bende infiammabili MUMMY**: shader di dissolve/burn — threshold su noise texture (`simplex-noise` o texture procedurale) animato dal danno da fuoco; `fireDamageMultiplier: 2.0` è già in `content/enemies.ts`, serve solo il tipo di danno "fuoco" in `DamageResolver` + il material.
- **Dissolve morte nemico**: stesso shader a soglia con threshold animato 0→1 (standard roguelike, costo ~10 righe TSL).
- **Sabbia/polvere**: albedo ambientCG "Sand" + normal map + `roughness 0.95` — sostituisce il materiale piatto marrone.
- **Riferimento ufficiale TSL**: `threejs.org/docs/#manual/en/introduction/TSL-Overview` + `three/examples/jsm/tsl/` (WebGPU native).

---

## 3. Audio — SFX, ambience, musica (G-18, G-19)

### 3.1 Sample royalty-free

| Risorsa | Licenza | Uso |
|---|---|---|
| **Kenney — Audio Packs** (`kenney.nl/assets?q=audio`, es. "Interface Sounds", "Impact Sounds", "RPG Audio") | **CC0** | SFX UI (click/hover), impatti, hit — base solida, zero rischi licenza |
| **Sonniss — GDC Game Audio Bundle** (`sonniss.com/gameaudiogdc`, release annuale gratuita) | Gratuito con attribuzione | Centinaia di GB di SFX professionali (fiamme, pietra, cripta, creature) — il "freesound premium" |
| **freesound.org** (search `torch fire`, `stone scrape`, `mummy`, `snake hiss`, `sand footsteps`) | CC0/CC-BY (filtrare) | Foley specifico: passi su sabbia, pietra che striscia, sibilo cobra, crepitio torcia |
| **OpenGameArt — desert/ambience** (search `desert ambience`, `the eternal sands`) | CC0/CC-BY | Loop ambience desert/cripta per i 4 livelli di `DARKNESS.thresholds` |
| **Mixkit / Pixabay Music** (`mixkit.co`, `pixabay.com/music`) | Gratuito | Musica dark/egizia/ambient per gli stati (esplorazione/tensione/combattimento) |

### 3.2 Sintesi procedurale (complementare, già nello spirito del progetto)

- **Web Audio API nativo** — già usato in `WebAudioEngine.ts`; estendere con: rumore filtrato per fiamma, oscillatori FM per droni, LFO per tensione.
- **Tone.js** (`tonejs.github.io`) — se serve scrivere sintetizzatori/sequencer più velocemente (alternativa: restare su Web Audio nativo, più controllo e zero dipendenze — decisione già presa dal progetto: *zero-dip extra dove possibile*).

### 3.3 Formato consigliato

- SFX brevi → `.ogg` (Opus) con fallback `.mp3` per Safari (o `.webm` Opus, supportato ovunque nel 2026).
- Ambience/musica → loop `.ogg` 48kHz, ~-14 LUFS.
- Caricamento: `fetch` + `AudioContext.decodeAudioData` in un `AudioAssetLoader` (G-19), con preload dei cue più usati (torcia, braciere, hit).

---

## 4. VFX e post-processing (G-15)

| Tecnica | Implementazione Three.js 0.185 | Uso |
|---|---|---|
| **Fiamma torcia** (oggi solo SpotLight) | `Points`/sprite con noise in shader TSL, ~50-100 particelle, additive blending | La torcia deve avere un **fuoco visibile**, non solo luce |
| **Trail arma** | `THREE.Mesh` + ribbon/curve aggiornata per frame durante `ACTIVE` | VFX `vfx_slash_trail` già dichiarato negli attack |
| **Polvere scavo** | Particle system (`THREE.Points` + PointsMaterial) burst a ogni `SEGMENT_COMPLETE` | Feedback scavo già triggerato da `DigEvent` |
| **Dissolve nemico** | Shader TSL threshold + noise (vedi §2.2) | Morte nemici al posto del pop |
| **Outline/punish window** | `postprocessing` (pmndrs) o rimorchio: render target + `THREE.Mesh` outline pass; oppure emissive boost (già fatto in `setEnemyStates`) | Segnale `punishWindowSignal` — già amplificabile da `amplifiedTelegraphs` |
| **Bloom/vignette/grain** | `postprocessing` npm (`pmndrs/postprocessing`, compatibile WebGPU via EffectComposer) o `three/examples/jsm/postprocessing/` (gratis, niente dipendenza) | Il "Noir" ha bisogno di bloom selettivo su occhi/geroglifici + vignette |
| **Volumetric god rays** | Ray-marched volume shader (TSL) su WebGPU, riservato a momenti narrativi (ingresso boss, tesoro raro) | Livello "Cinema" del §17.4 del GDD |
| **Screen shake** | ✅ **Già implementato** (`addCameraShake`, rispetta `reduceCameraShake`) | Nessuna azione |
| **Particles budget** | 5.000 attive, 500/sistema — pool preallocato, no allocazioni per-frame | Standard da GDD §17.4 |

---

## 5. UI, Font e identità (G-09, G-12)

| Risorsa | Licenza | Uso |
|---|---|---|
| **Cinzel** (Google Fonts, `fonts.google.com/specimen/Cinzel`) | OFL | Titoli/menu — serif epigrafico, perfetto per l'Egyptian Noir |
| **Noto Sans Egyptian Hieroglyphs** (Google Fonts) | OFL | Geroglifici reali in UI/messaggi (es. simboli nei landmark, decorazioni HUD) |
| **fontsource** (`fontsource.org/fonts/cinzel`) | OFL | Self-hosting senza Google CDN (privacy + offline, coerente col progetto) |
| **Noto Sans** (corpo UI) | OFL | Testo corrente (già indicato nel GDD §5.2) |

---

## 6. Tool di qualità e pipeline (G-21 + benchmark)

| Tool | Uso |
|---|---|
| **gltf-transform** (CLI) | Ottimizzazione asset in CI: `npx gltf-transform optimize` |
| **Playwright** ✅ già presente | E2E (8 test verdi) |
| **Vitest + happy-dom** ✅ già presenti | 252 test |
| **PROPERTY_RUNS** ✅ già parametrizzato | 100 locale → 10k CI → 100k nightly |
| **F3 debug overlay** (già previsto in `debug/`) | Draw calls, triangoli, ms/sistema, entità |
| **Lighthouse** (`npx lighthouse`) | Audit performance/accessibility del build di produzione |
| **WebHint / axe-core** | Audit accessibilità web complessiva |

---

## 7. Piano di integrazione consigliato (ordine)

1. **G-17 + G-14 (infra asset)**: `AssetLoader` + manifest `content/assets.ts` (mappa archetipo/landmark → URL .glb) usando il registry CC0 di ToxSam e Quaternius Ruins. Poi `ThreeDungeonLayout` istanzia gli asset al posto delle primitive (le 9 famiglie di G-23 diventano punti di aggancio).
2. **G-16 (materiali)**: geroglifici emissivi (texture CC0 ancient-egypt-0) + dissolve MUMMY + sabbia ambientCG. Tutto in TSL/onBeforeCompile.
3. **G-13 (nemici)**: SCARAB (creature pack Quaternius), MUMMY (dissolve + rig Mixamo), poi gli altri 6 archetipi per priorità di tier.
4. **G-15 (VFX)**: fiamma torcia → trail arma → polvere scavo → bloom/vignette (`postprocessing`).
5. **G-18/G-19 (audio)**: Kenney SFX UI/hit + Sonniss foley + ambience desert da OGA; `AudioAssetLoader` con preload; wiring cue arma/combat in `AudioEventDirector`.
6. **G-12 (art bible)**: consolidare palette/silhouette/regole di leggibilità con gli asset scelti in `docs/ART_BIBLE.md`.

**Vincolo da rispettare**: nessun asset CC-BY senza attribuzione nel `README`/credits; preferire CC0 dove possibile (Quaternius, Kenney, ambientCG, Poly Haven, ancient-egypt-0).

---

*Verificato online il 2026-08-13: tutti gli URL sopra rispondono 200 (Sonniss risponde 403 ai bot ma il bundle è pubblico e gratuito con registrazione).*
