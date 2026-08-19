# Roadmap — Integrazione Risorse Esterne
## La Piramide Perduta — Upgrade Realismo & Attrattività
**Versione:** 1.0 — Agosto 2026  
**Stato progetto base:** v0.2.0 (tutti i gap R/P/B/E chiusi)

---

## Indice delle onde

| Onda | Tema | Impatto visivo | Difficoltà | Giorni stimati |
|------|------|---------------|------------|----------------|
| **W-1** | Illuminazione HDRI + cielo | ★★★★★ | ★★☆☆☆ | 1 |
| **W-2** | Textures PBR pietra/sabbia | ★★★★☆ | ★★★☆☆ | 2 |
| **W-3** | Audio atmosferico + foley | ★★★★☆ | ★★☆☆☆ | 1 |
| **W-4** | Musica adattiva (Kevin MacLeod) | ★★★☆☆ | ★★★☆☆ | 2 |
| **W-5** | Artefatti 3D (Smithsonian / CC0) | ★★★★★ | ★★★★☆ | 3–4 |
| **W-6** | Particelle con textures reali | ★★★☆☆ | ★★☆☆☆ | 1 |
| **W-7** | Post-processing & materiali avanzati | ★★★★☆ | ★★★★☆ | 2–3 |

**Totale stimato:** 12–14 giorni di lavoro netto

---

## W-1 — Illuminazione HDRI + Cielo Desertico

### Sorgente
- **Poly Haven** → https://polyhaven.com/hdris → categoria "Desert" / "Outdoor"
- Consigliati: `kloofendal_48d_partly_cloudy`, `limpopo_golf_course_4k`, `sahara_4k`
- Formato: `.hdr` o `.exr` — scarica la versione **4K** (file ~25 MB)
- **Licenza: CC0** — uso libero, nessuna attribuzione obbligatoria

### Conversione ottimizzata
```bash
# Installa (una volta sola)
npm install -g @hdrpng/cli   # oppure usa gltf-transform già installato

# Se hai gltf-transform:
npx gltf-transform etc1s --quality 128 sahara_4k.hdr public/hdri/sahara.ktx2
# Alternativa semplice: copia .hdr direttamente in public/hdri/
```

### File da creare: `src/rendering/HDRILoader.ts`
```typescript
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { PMREMGenerator } from '@/rendering/ThreeImports.js';
import type { WebGLRenderer, Texture } from '@/rendering/ThreeImports.js';

export interface HDRIResult {
  envMap: Texture;       // IBL — luci indirette materiali PBR
  background: Texture;   // skybox visibile
}

export async function loadHDRI(
  renderer: WebGLRenderer,
  url: string,
): Promise<HDRIResult> {
  const loader = new RGBELoader();
  const hdrTexture = await loader.loadAsync(url);

  const pmrem = new PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envMap = pmrem.fromEquirectangular(hdrTexture).texture;
  pmrem.dispose();
  hdrTexture.dispose();

  return { envMap, background: envMap };
}
```

### Modifica: `src/rendering/ThreeRendererService.ts`
```typescript
// Aggiungere dopo la creazione della scene:
import { loadHDRI } from './HDRILoader.js';

// Nel metodo init() o setEnvironment():
const { envMap, background } = await loadHDRI(this.renderer, '/hdri/sahara.hdr');
this.scene.environment = envMap;      // IBL su tutti i materiali MeshStandardMaterial
this.scene.background = background;   // cielo visibile
```

### Varianti per stato di gioco
```typescript
// Lobby / esplorazione → sahara cielo aperto
await setEnvironment('/hdri/sahara.hdr');

// Boss room → luce rossa drammatica
await setEnvironment('/hdri/dungeon_night.hdr');
```

### Struttura file pubblica
```
public/
  hdri/
    sahara_4k.hdr          ← Poly Haven CC0
    kloofendal_4k.hdr      ← variante nuvolosa
```

### Verifica
```bash
npm run typecheck     # nessun errore TS
npm run build         # hdri/ correttamente copiato in dist/
```

**Effetto:** i materiali MeshStandardMaterial (pietra, metallo, pelle) acquisiscono
riflessi realistici dall'ambiente desertico senza alcun cambio ai materiali esistenti.

---

## W-2 — Textures PBR Pietra Egizia e Sabbia

### Sorgenti
| Risorsa | URL | Formato | Licenza |
|---------|-----|---------|---------|
| ambientCG Stone/Sand | https://ambientcg.com/list?category=Surface | ZIP con albedo/normal/roughness/AO | CC0 |
| Poly Haven textures | https://polyhaven.com/textures → "Stone", "Sand" | 4K PNG | CC0 |

### Texture consigliate per il gioco
- `rock_wall_07` (ambientCG) → pareti dungeon
- `sand_01` / `sand_dunes_01` (Poly Haven) → pavimento
- `sandstone_blocks_02` (Poly Haven) → blocchi delle piramidi
- `plaster_wall_02` (ambientCG) → intonaco con geroglifici

### Conversione a KTX2 (GPU-compressed, già in Workbox cache config)
```bash
# Strumento già installato come devDep: @gltf-transform/cli
npx gltf-transform etc1s rock_wall_07_color.jpg public/textures/rock_wall_color.ktx2
npx gltf-transform etc1s rock_wall_07_normal.jpg public/textures/rock_wall_normal.ktx2
npx gltf-transform etc1s rock_wall_07_roughness.jpg public/textures/rock_wall_roughness.ktx2
```

### File da creare: `src/rendering/PBRTextureLibrary.ts`
```typescript
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { WebGLRenderer, Texture } from '@/rendering/ThreeImports.js';

export interface PBRMaps {
  map: Texture;
  normalMap: Texture;
  roughnessMap: Texture;
  aoMap?: Texture;
}

let _loader: KTX2Loader | null = null;

function getLoader(renderer: WebGLRenderer): KTX2Loader {
  if (!_loader) {
    _loader = new KTX2Loader()
      .setTranscoderPath('/draco/')     // usa il decoder Draco già in public/draco/
      .detectSupport(renderer);
  }
  return _loader;
}

export async function loadPBR(
  renderer: WebGLRenderer,
  basePath: string,
): Promise<PBRMaps> {
  const loader = getLoader(renderer);
  const [map, normalMap, roughnessMap] = await Promise.all([
    loader.loadAsync(`${basePath}_color.ktx2`),
    loader.loadAsync(`${basePath}_normal.ktx2`),
    loader.loadAsync(`${basePath}_roughness.ktx2`),
  ]);
  return { map, normalMap, roughnessMap };
}

// Catalogo centralizzato
export const PBRPresets = {
  DUNGEON_WALL:   '/textures/rock_wall',
  DUNGEON_FLOOR:  '/textures/sand',
  PYRAMID_BLOCK:  '/textures/sandstone_blocks',
  PLASTER:        '/textures/plaster_wall',
} as const;
```

### Struttura file pubblica
```
public/
  textures/
    rock_wall_color.ktx2
    rock_wall_normal.ktx2
    rock_wall_roughness.ktx2
    sand_color.ktx2
    sand_normal.ktx2
    sand_roughness.ktx2
    sandstone_blocks_color.ktx2
    sandstone_blocks_normal.ktx2
    sandstone_blocks_roughness.ktx2
```

### vite.config.ts — nessuna modifica necessaria
Il workbox è già configurato con:
```ts
globPatterns: ["**/*.{js,css,html,glb,jpg,png,woff2,ktx2}"]
```
I file `.ktx2` sono già in cache.

---

## W-3 — Audio Atmosferico e Foley Desertico

### Sorgenti
| Sorgente | URL | Cosa scaricare | Licenza |
|---------|-----|---------------|---------|
| Freesound.org | https://freesound.org | vento desertico, granelli sabbia, torce, pipistrelli | CC0 / CC-BY |
| BBC Sound Effects | https://sound-effects.bbcrewind.co.uk | "desert wind", "tomb", "stone door" | PersonalUse free |
| OpenGameArt | https://opengameart.org/content/desert-ambience | loop ambientale 3 min | CC-BY 3.0 |

### Freesound — ricerche consigliate
- `"desert wind ambience loop"` → filtro: CC0, durata > 30s
- `"torch fire crackling loop"` → per torce nelle stanze
- `"stone scrape"` → per porte/trappole
- `"sand footsteps"` → foley passi del giocatore
- `"bat cave ambience"` → per stanze buie
- `"hieroglyphics echo"` → riverbero sale egiziane

### Formato raccomandato
Converti tutto in **OGG Vorbis** (supportato da Web Audio API):
```bash
# ffmpeg deve essere installato
ffmpeg -i desert_wind.wav -c:a libvorbis -q:a 6 -ar 44100 desert_wind.ogg
ffmpeg -i torch.wav -c:a libvorbis -q:a 5 torch.ogg
```

### Struttura file pubblica
```
public/
  audio/
    ambient/
      desert_wind_loop.ogg
      tomb_ambience_loop.ogg
      torch_crackle_loop.ogg
    foley/
      footstep_sand_01.ogg
      footstep_sand_02.ogg
      footstep_sand_03.ogg   ← 3 varianti per evitare ripetizione
      stone_door_open.ogg
      trap_trigger.ogg
    effects/
      bat_screech.ogg
      sand_pour.ogg
      torch_ignite.ogg
```

### Modifica: `src/audio/AudioAssetLibrary.ts`
```typescript
// Aggiungere al registro esistente:
export const AudioAssets = {
  // ... asset esistenti ...

  // Ambientali
  DESERT_WIND_LOOP:   { url: '/audio/ambient/desert_wind_loop.ogg',   loop: true,  volume: 0.3 },
  TOMB_AMBIENCE:      { url: '/audio/ambient/tomb_ambience_loop.ogg',  loop: true,  volume: 0.4 },
  TORCH_CRACKLE:      { url: '/audio/ambient/torch_crackle_loop.ogg',  loop: true,  volume: 0.2 },

  // Foley
  FOOTSTEP_SAND_01:   { url: '/audio/foley/footstep_sand_01.ogg',      loop: false, volume: 0.5 },
  FOOTSTEP_SAND_02:   { url: '/audio/foley/footstep_sand_02.ogg',      loop: false, volume: 0.5 },
  FOOTSTEP_SAND_03:   { url: '/audio/foley/footstep_sand_03.ogg',      loop: false, volume: 0.5 },
  STONE_DOOR:         { url: '/audio/effects/stone_door_open.ogg',      loop: false, volume: 0.8 },
} as const;
```

### Modifica: `src/audio/WebAudioEngine.ts`
```typescript
// Aggiungere metodo per variazione random dei passi (senza Math.random — usa seed):
playFootstep(stepIndex: number): void {
  const variants = [AudioAssets.FOOTSTEP_SAND_01, AudioAssets.FOOTSTEP_SAND_02, AudioAssets.FOOTSTEP_SAND_03];
  // stepIndex % 3 per rotazione deterministica
  this.play(variants[stepIndex % 3]);
}
```

---

## W-4 — Musica Adattiva (Kevin MacLeod + Soundimage)

### Sorgenti e brani consigliati

| Brano | Artista | Stile | Uso | URL |
|-------|---------|-------|-----|-----|
| **Oppressive Gloom** | Kevin MacLeod | Ambient scuro | Menu / corridoi | incompetech.com |
| **Sands of Time** | Kevin MacLeod | Orchestrale esotico | Esplorazione | incompetech.com |
| **Desert City** | Kevin MacLeod | Medio Oriente | Lobby / hub | incompetech.com |
| **Clash Defiant** | Kevin MacLeod | Combat orchestrale | Combattimento | incompetech.com |
| **Killers** | Kevin MacLeod | Drammatico intenso | Boss fight | incompetech.com |
| **Egyptian tracks** | Soundimage.org | Autentici | Alternativa | soundimage.org/egyptian-music |

**Licenza Kevin MacLeod:** CC-BY 3.0 → aggiungere nel gioco:
```
Music: Kevin MacLeod (incompetech.com) — Licensed under CC BY 3.0
```

### Formato
- Scarica in **MP3** da incompetech.com
- Converti in **OGG** per web + mantieni MP3 come fallback:
```bash
ffmpeg -i sands_of_time.mp3 -c:a libvorbis -q:a 7 sands_of_time.ogg
```

### Struttura file pubblica
```
public/
  audio/
    music/
      menu_oppressive_gloom.ogg
      explore_sands_of_time.ogg
      explore_desert_city.ogg
      combat_clash_defiant.ogg
      boss_killers.ogg
```

### File da creare: `src/audio/MusicStateMachine.ts`
```typescript
/**
 * Macchina a stati per la musica adattiva.
 * Transizioni con crossfade di 2 secondi.
 * NOTA: nessun Date.now() — usa GameClock.elapsed iniettato.
 */

export type MusicState = 'MENU' | 'EXPLORE' | 'COMBAT' | 'BOSS' | 'VICTORY' | 'SILENT';

interface MusicTrack {
  url: string;
  volume: number;
}

const TRACKS: Record<MusicState, MusicTrack | null> = {
  MENU:    { url: '/audio/music/menu_oppressive_gloom.ogg', volume: 0.4 },
  EXPLORE: { url: '/audio/music/explore_sands_of_time.ogg', volume: 0.35 },
  COMBAT:  { url: '/audio/music/combat_clash_defiant.ogg',  volume: 0.6 },
  BOSS:    { url: '/audio/music/boss_killers.ogg',           volume: 0.7 },
  VICTORY: { url: '/audio/music/explore_desert_city.ogg',   volume: 0.4 },
  SILENT:  null,
};

const CROSSFADE_DURATION = 2.0; // secondi

export class MusicStateMachine {
  private ctx: AudioContext;
  private current: { node: AudioBufferSourceNode; gain: GainNode } | null = null;
  private state: MusicState = 'SILENT';

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  async transition(newState: MusicState, currentTime: number): Promise<void> {
    if (newState === this.state) return;
    this.state = newState;

    const track = TRACKS[newState];
    
    // Fade out traccia corrente
    if (this.current) {
      const oldGain = this.current.gain;
      oldGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + CROSSFADE_DURATION);
      const oldNode = this.current.node;
      setTimeout(() => oldNode.stop(), CROSSFADE_DURATION * 1000 + 100);
    }

    if (!track) { this.current = null; return; }

    // Carica e avvia nuova traccia
    const response = await fetch(track.url);
    const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      track.volume, 
      this.ctx.currentTime + CROSSFADE_DURATION
    );

    source.connect(gainNode).connect(this.ctx.destination);
    source.start();

    this.current = { node: source, gain: gainNode };
  }
}
```

### Integrazione nella logica di gioco
```typescript
// In GameLoop o GameStateManager — regola di trigger:
// Nemici nel raggio 15m → COMBAT
// Boss spawned → BOSS
// Tutti i nemici morti + vittoria → VICTORY
// Nessun nemico → EXPLORE

const music = new MusicStateMachine(audioCtx);

// Nella update loop (elapsedSeconds iniettato, mai performance.now()):
if (enemiesNearby && !bossActive)      await music.transition('COMBAT', elapsed);
else if (bossActive)                    await music.transition('BOSS', elapsed);
else if (roomCleared)                   await music.transition('VICTORY', elapsed);
else                                    await music.transition('EXPLORE', elapsed);
```

---

## W-5 — Artefatti 3D (Smithsonian, Sketchfab CC0, Quaternius)

### 5a — Smithsonian Open Access (fotogrammetria CC0)

**URL:** https://3d.si.edu  
**Come trovare modelli egiziani:**
1. Vai su `https://3d.si.edu`
2. Cerca: "Egypt", "canopic jar", "shabti", "scarab", "sarcophagus"
3. Filtra per: **3D Download available**
4. Scarica in formato **GLB** o **OBJ+MTL**

**Pezzi consigliati:**
- Canopic jars (vasi canopi) — decorazione stanze
- Ushabti figurines — oggetti collezionabili
- Scarab amulets — item interattivi
- Hieroglyphic tablets — pannelli di lore
- Bronze statuettes — oggetti altar

**Workflow di ottimizzazione:**
```bash
# 1. Scarica il GLB originale (può essere 50-200MB)
# 2. Riduzione poligoni con gltf-transform (già installato):
npx gltf-transform dedup canopic_jar_original.glb canopic_jar_step1.glb
npx gltf-transform simplify --ratio 0.05 --error 0.001 canopic_jar_step1.glb canopic_jar_step2.glb
npx gltf-transform draco canopic_jar_step2.glb public/models/canopic_jar.glb
# Risultato atteso: < 2 MB, qualità visiva ottima per distanze > 1m

# 3. Comprimi le texture embed nel GLB:
npx gltf-transform etc1s canopic_jar_step2.glb public/models/canopic_jar.glb
```

**Verifica dimensioni target:**
| Modello | Poligoni target | Dimensione GLB target |
|---------|----------------|----------------------|
| Vaso canopo | 5.000–15.000 | < 2 MB |
| Ushabti | 3.000–8.000 | < 1 MB |
| Scarabeo | 1.000–3.000 | < 512 KB |
| Sarcofago | 20.000–40.000 | < 5 MB |

### 5b — Quaternius Ruins CC0

**URL:** https://quaternius.com/packs/egyptianruins.html  
**Licenza:** CC0  
**Contenuto:** ~40 mesh (colonne, archi, blocchi, pavimenti, torce)

```bash
# Dopo il download, ottimizza il pack completo:
for f in quaternius_egypt/*.glb; do
  npx gltf-transform draco "$f" "public/models/ruins/$(basename $f)"
done
```

### 5c — File da creare: `src/content/ArtifactRegistry.ts`

```typescript
/**
 * Registro centralizzato degli artefatti 3D egiziani.
 * content/ non importa THREE — solo interfacce (boundary constraint).
 */

export interface ArtifactDef {
  readonly id: string;
  readonly url: string;               // path in public/models/
  readonly displayName: string;
  readonly loreName: string;          // nome egizio originale
  readonly rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  readonly interactable: boolean;
  readonly scale: number;             // scala di spawn in-world
  readonly description: string;       // testo lore
  readonly source: 'smithsonian' | 'quaternius' | 'sketchfab-cc0' | 'procedural';
}

export const ArtifactRegistry: readonly ArtifactDef[] = [
  {
    id: 'canopic_jar_horus',
    url: '/models/canopic_jar.glb',
    displayName: 'Vaso Canopo di Horus',
    loreName: 'ḥr — Heru',
    rarity: 'uncommon',
    interactable: true,
    scale: 0.3,
    description: 'Custodisce il fegato del faraone. Un occhio di Horus veglia sul coperchio.',
    source: 'smithsonian',
  },
  {
    id: 'ushabti_servant',
    url: '/models/ushabti.glb',
    displayName: 'Ushabti del Servo',
    loreName: 'wšbty',
    rarity: 'common',
    interactable: false,
    scale: 0.15,
    description: 'Figurina funeraria destinata a lavorare nell\'aldilà al posto del defunto.',
    source: 'smithsonian',
  },
  {
    id: 'scarab_amulet',
    url: '/models/scarab.glb',
    displayName: 'Amuleto Scarabeo',
    loreName: 'ḫpr — Kheper',
    rarity: 'rare',
    interactable: true,
    scale: 0.08,
    description: 'Simbolo del dio sole nascente. Concede rigenerazione HP +2/s per 30s.',
    source: 'smithsonian',
  },
  {
    id: 'column_ruined',
    url: '/models/ruins/column_ruined.glb',
    displayName: 'Colonna Spezzata',
    loreName: null,
    rarity: 'common',
    interactable: false,
    scale: 1.0,
    description: null,
    source: 'quaternius',
  },
] as const;
```

### File da creare: `src/rendering/ArtifactLoader.ts`

```typescript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Group } from '@/rendering/ThreeImports.js';
import type { ArtifactDef } from '@/content/ArtifactRegistry.js';

let _gltfLoader: GLTFLoader | null = null;

function getGLTFLoader(): GLTFLoader {
  if (!_gltfLoader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');   // già in public/draco/ da v0.2.0
    _gltfLoader = new GLTFLoader();
    _gltfLoader.setDRACOLoader(draco);
  }
  return _gltfLoader;
}

const _cache = new Map<string, Group>();

export async function loadArtifact(def: ArtifactDef): Promise<Group> {
  if (_cache.has(def.id)) return _cache.get(def.id)!.clone();

  const gltf = await getGLTFLoader().loadAsync(def.url);
  const root = gltf.scene;
  root.scale.setScalar(def.scale);
  root.name = def.id;

  // Shadow casting per artefatti
  root.traverse((node) => {
    if ('isMesh' in node && node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  _cache.set(def.id, root);
  return root.clone();
}
```

---

## W-6 — Particelle con Textures Reali (sabbia, fumo, scintille)

### Sorgenti texture particelle

- **OpenGameArt** → https://opengameart.org/content/particle-pack → CC0
- **Kenney Particle Pack** → https://kenney.nl/assets/particle-pack → CC0
- Include: smoke.png, spark.png, star.png, dust.png (tutti 64×64 PNG)

### Struttura file
```
public/
  textures/
    particles/
      dust.png           ← nuvola di sabbia (grigio sfumato)
      spark.png          ← scintille torce (bianco/giallo)
      smoke.png          ← fumo denso
      glow_soft.png      ← alone per effetti magici
```

### Modifica: `src/rendering/GPUParticleSystem.ts`
Il sistema esistente usa `gl_PointSize` + shader circular disc.
Aggiungere supporto texture atlante:

```typescript
// Aggiungere al costruttore:
import { TextureLoader } from '@/rendering/ThreeImports.js';

// Nel metodo createParticleMaterial():
const loader = new TextureLoader();
const dustTex = await loader.loadAsync('/textures/particles/dust.png');

const material = new ShaderMaterial({
  uniforms: {
    // ... uniform esistenti ...
    uParticleTexture: { value: dustTex },
    uUseTexture: { value: 1.0 },
  },
  // Nel fragment shader, aggiungere:
  // if (uUseTexture > 0.5) {
  //   vec4 texColor = texture2D(uParticleTexture, gl_PointCoord);
  //   fragColor = vec4(uColor, texColor.a * alpha);
  // }
});
```

---

## W-7 — Post-processing Avanzato & Materiali

### 7a — Lens Dirt / Sand Storm Effect

```typescript
// src/rendering/SandStormPass.ts
// Overlay texture semitrasparente che simula granelli di sabbia sulla "lente"
// Intensità aumenta quando il giocatore è esposto all'esterno

import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export class SandStormPass extends ShaderPass {
  set intensity(v: number) {
    this.uniforms['uIntensity'].value = Math.max(0, Math.min(1, v));
  }

  constructor() {
    super({
      uniforms: {
        tDiffuse:   { value: null },
        tSandDirt:  { value: null },   // texture granelli sabbia (Freesound)
        uIntensity: { value: 0.0 },
        uTime:      { value: 0.0 },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform sampler2D tSandDirt;
        uniform float uIntensity;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          vec2 driftUv = vUv + vec2(uTime * 0.005, uTime * 0.002);
          vec4 sand = texture2D(tSandDirt, fract(driftUv));
          gl_FragColor = mix(base, base * 0.85 + sand * 0.15, uIntensity);
        }
      `,
    });
  }
}
```

### 7b — Materiali Dorati (sarcofagi, gioielli)

```typescript
import { MeshStandardMaterial } from '@/rendering/ThreeImports.js';

export function createGoldMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0xD4A017,        // oro antico
    metalness: 0.95,
    roughness: 0.15,
    envMapIntensity: 2.0,   // amplifica riflessi HDRI W-1
  });
}

export function createBronzeMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0x8B5E3C,
    metalness: 0.85,
    roughness: 0.35,
    envMapIntensity: 1.5,
  });
}

export function createLapisMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0x1A5B9A,
    metalness: 0.0,
    roughness: 0.6,
    envMapIntensity: 0.8,
  });
}
```

---

## Sequenza di Esecuzione Raccomandata

```
SETTIMANA 1 (impatto immediato):
  Giorno 1:  W-1 — HDRI (scarica 1 file, 2h integrazione)
  Giorno 2:  W-3 — Audio atmosferico (scarica 6-8 OGG, 3h integrazione)
  Giorno 3:  W-2a — Prime 2 textures PBR (pietra parete + sabbia pavimento)
  Giorno 4:  W-4 — Musica adattiva (3 brani Kevin MacLeod, MusicStateMachine)
  Giorno 5:  Smoke test + npm run verify

SETTIMANA 2 (profondità):
  Giorno 6-7:  W-5a — Smithsonian: scarica + ottimizza 3 artefatti
  Giorno 8:    W-5b — Quaternius ruins pack
  Giorno 9:    W-2b — Textures rimanenti (sandstone, plaster)
  Giorno 10:   W-6 — Particelle con texture reali
  Giorno 11:   W-7 — Post-processing polish
  Giorno 12:   npm run verify + test:e2e + Lighthouse audit
```

---

## Tabella Licenze e Attribuzioni

| Asset | Licenza | Attribuzione richiesta | Da inserire in |
|-------|---------|----------------------|----------------|
| Poly Haven HDRI | CC0 | No | — |
| ambientCG textures | CC0 | No | — |
| Smithsonian 3D | CC0 | Facoltativa | CREDITS.md |
| Quaternius Ruins | CC0 | No | — |
| Kevin MacLeod music | CC-BY 3.0 | **Sì** | Credits in-game |
| Freesound CC0 | CC0 | No | — |
| Freesound CC-BY | CC-BY | **Sì** | CREDITS.md |
| BBC Sound Effects | PersonalUse | Non per distribuzione commerciale | Solo per test |
| Kenney Particle Pack | CC0 | No | — |

### File CREDITS.md da creare (obbligatorio per CC-BY)
```markdown
# La Piramide Perduta — Credits

## Musica
- "Oppressive Gloom", "Sands of Time", "Desert City", "Clash Defiant", "Killers"
  by Kevin MacLeod (incompetech.com)
  Licensed under Creative Commons: By Attribution 4.0 License
  https://creativecommons.org/licenses/by/4.0/

## Modelli 3D
- [Nome artefatto]: Smithsonian Institution — Open Access, CC0
  https://3d.si.edu

## Audio
- [Lista file CC-BY scaricati da Freesound con link e autore]
```

---

## Parametri di Qualità Target Post-Integrazione

| Metrica | Valore attuale | Target dopo W1-W7 |
|---------|---------------|-------------------|
| First Contentful Paint | < 2s | < 2.5s (+HDRI load) |
| Bundle JS gzipped | ~450 KB | ~450 KB (nessun JS aggiunto) |
| Asset totali dist/ | ~8 MB | ~35–50 MB (KTX2 + GLB + OGG) |
| Frame rate (60fps target) | ✓ | ✓ (GPU particles già ottimizzate) |
| Lighthouse Performance | ≥ 90 | ≥ 85 (più asset = più cache) |
| Immersione soggettiva | 6/10 | 9/10 |

---

## Comandi Verifica Finale

```bash
# Dopo ogni wave:
npm run typecheck           # zero errori TS
npm run verify:boundaries   # content/ non importa Three
npm run verify:content      # seed deterministico
npm run test                # unit tests
npm run build               # bundle completo

# Lighthouse (dopo W-1):
npx lhci autorun --collect.url=http://localhost:4173

# Dimensione asset (controlla che KTX2 non superino budget):
du -sh public/textures/ public/models/ public/audio/ public/hdri/
```

---

*Generato — Agosto 2026 | La Piramide Perduta v0.2.0 → v0.3.0*
