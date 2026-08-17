# La Piramide Perduta — Resoconto Completo del Progetto

> Documento di handoff tecnico. Obiettivo: permettere a un'altra IA (o a uno sviluppatore) di riprendere il progetto senza contesto pregresso, con dettaglio su codice, architettura, stack, game design, UI/UX e stato di completamento.
>
> Versione progetto: 0.1.0 — Vertical Slice.
>
> **Questo documento è mantenuto aggiornato man mano che i gap descritti in `PIANO_COLMATURA_GAP.md` vengono chiusi.** Consultare il Registro di implementazione in cima a `PIANO_COLMATURA_GAP.md` per lo stato più recente; le sezioni 6, 11, 15 e 16 di questo file vengono riviste ad ogni gap completato per restare coerenti con lo stato reale del codice.
>
> **Stato corrente**: G-01 (fisica e player controller reali) è stato completato dopo la stesura iniziale di questo documento — la sezione 6 sotto riflette già lo stato aggiornato.

---

## 1. Cos'è il progetto

**La Piramide Perduta** è un FPS roguelike "Egyptian Noir", browser-first, in sviluppo come vertical slice. Il giocatore esplora una necropoli egizia generata proceduralmente, con un'unica risorsa critica — il **combustibile della torcia** — che governa esplorazione, combattimento e stealth: la luce rivela ma attira, il buio nasconde ma disorienta e rafforza certi nemici.

Non esiste un documento di design (GDD/Master Bible) nel repository stesso: le specifiche vivono nella cronologia delle conversazioni di sviluppo (riferite nel codice come "Master Bible v4", con sezioni tipo `§9.4`, `§44.8`, ADR e MIG numerati). **Questo file è oggi la fonte di verità più vicina a un GDD scritto**, ricostruita leggendo l'intero codice sorgente. Chiunque riprenda il progetto dovrebbe considerare di trascrivere la Master Bible reale in un file `docs/MASTER_BIBLE.md` per non perdere ulteriormente il contesto.

Nessun asset grafico o audio authored è presente: il progetto usa ancora geometrie di test (piani, cilindri, box) e cue audio sintetici/procedurali al posto di sample reali.

---

## 2. Come avviare il progetto

```bash
npm install
npm run dev          # Vite dev server, apre il browser
```

Script disponibili (`package.json`):

| Script | Comando | Scopo |
|---|---|---|
| `dev` | `vite` | Server di sviluppo con HMR |
| `build` | `tsc -b && vite build` | Build di produzione (typecheck + bundle) |
| `preview` | `vite preview` | Serve la build di produzione |
| `typecheck` | `tsc -b --pretty false` | Solo controllo tipi, nessun output |
| `lint` | `eslint .` | ESLint strict + stylistic type-checked |
| `format` / `format:check` | `prettier --write/--check .` | Formattazione |
| `test` | `vitest run` | Tutti i test una tantum |
| `test:watch` | `vitest` | Test in watch mode |
| `test:property` | `vitest run tests/property` | Solo i property-based test (fast-check) |
| `test:e2e` | `playwright test` | Smoke end-to-end Playwright su bootstrap, tutorial accessibile, pointer-lock recovery, pause/resume, persistenza impostazioni e palette accessibile |
| `verify:boundaries` | `node scripts/verify-boundaries.mjs` | Verifica i confini architetturali fra layer |
| `verify:content` | `node scripts/verify-content.mjs` | Verifica i range dei valori di bilanciamento |
| `verify` | combinazione di tutti sopra + build | Gate di CI completo |
| `benchmark:gen` | `node scripts/benchmark-generation.mjs` | Benchmark generazione piano (placeholder, vedi §11) |
| `benchmark:replay` | `node scripts/benchmark-replay.mjs` | Benchmark determinismo replay (placeholder, vedi §11) |

Nota ambiente: in una sandbox Linux, `node_modules` può avere binding nativi mancanti per `rolldown`/Vite 8 (errore `Cannot find native binding`). Soluzione: `rm -rf node_modules package-lock.json && npm install` oppure semplicemente `npm install` di nuovo per far scaricare il binding della piattaforma corretta.

---

## 3. Stack tecnologico

### 3.1 Dipendenze di runtime (`dependencies`)

| Libreria | Versione | Uso nel progetto |
|---|---|---|
| `three` | 0.185.1 | Motore di rendering 3D. Usato in `src/rendering/ThreeRendererService.ts` per scena, camera, luci, mesh di test. Importa anche `three/webgpu` per il renderer WebGPU. |
| `@dimforge/rapier3d-compat` | 0.19.3 | Motore fisico WASM (Rapier). Usato per character controller cinematico, collider, raycast. **Attenzione**: caricato ma non ancora collegato al loop di gioco reale (vedi §13.1). |
| `idb` | 8.0.3 | Wrapper Promise-based su IndexedDB. Usato in `SaveManager.ts` per la persistenza del profilo giocatore. |
| `zod` | 4.4.3 | Validazione schema a runtime. Usato per `GameConfigSchema` e `SaveSchema` (import da `'zod/v4'`, non dal default export). |

### 3.2 Dipendenze di sviluppo (`devDependencies`)

| Libreria | Versione | Uso |
|---|---|---|
| `typescript` | 6.0.3 | Compilatore/type-checker. Strict mode con `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. |
| `vite` | 8.1.5 | Build tool e dev server. Target `es2022`. Alias `@/` → `src/`. |
| `vitest` | 4.1.10 | Test runner. Pool `threads`, environment `node`, alias condiviso con Vite. |
| `fast-check` | 4.9.0 | Property-based testing. Usato per invarianti di combattimento e RNG (vedi §12). |
| `eslint` + `@eslint/js` + `typescript-eslint` | 10.8.0 / 10.0.1 / 8.65.0 | Linting. Config `strictTypeChecked` + `stylisticTypeChecked` (le regole più severe disponibili in typescript-eslint). |
| `prettier` | 3.9.6 | Formattazione codice. |
| `@playwright/test` | 1.62.0 | Framework e2e usato per 7 smoke test sul bootstrap/runtime accessibile. |
| `@types/node`, `@types/three` | ^26.1.2 / ^0.185.1 | Tipi. |

### 3.3 Linguaggio e target

- **TypeScript strict**, target `ES2022`, moduli `ESNext` con risoluzione `Bundler`.
- 4 file `tsconfig` separati per dominio di compilazione:
  - `tsconfig.json` — root, tutto `src` + `tests`.
  - `tsconfig.sim.json` — solo core/ecs/simulation/procedural/ai/gameplay/content/math, `lib: ["ES2022"]` (nessun DOM): garantisce che la simulazione non possa accidentalmente referenziare `window`/`document`.
  - `tsconfig.worker.json` — workers + core/procedural/content/math, `lib: ["ES2022", "WebWorker"]`.
  - `tsconfig.node.json` — script `.mjs` e file di config, `types: ["node"]`.
- Import relativi con estensione `.js` esplicita anche per file `.ts` (richiesto da `verbatimModuleSyntax` + `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`).

### 3.4 Nessun framework UI

L'HUD e il menu impostazioni sono DOM/CSS puro (`document.createElement`, niente React/Vue/Svelte). Scelta esplicita dichiarata nei commenti (`Vincolo: usa DOM/CSS come richiesto da GDD §17`).

---

## 4. Architettura del codice

### 4.1 Separazione a layer (enforced staticamente)

```
platform → core → simulation → adapters → presentation → ui
```

In pratica, i layer effettivi nel repository e le regole di confine (definite in `scripts/verify-boundaries.mjs`, eseguito come parte di `npm run verify`):

| Layer (cartella) | Può importare | Non può importare |
|---|---|---|
| `src/simulation/` | core, ecs, procedural, content | `three`, `@dimforge/rapier3d`, `idb`, `../rendering`, `../physics`, `../ui` |
| `src/ecs/` | — | `three`, `@dimforge/rapier3d`, `idb` |
| `src/content/` | — | `three`, `@dimforge/rapier3d`, `../rendering`, `../physics` |
| `src/procedural/` | core, content | `three`, `@dimforge/rapier3d`, `idb`, `../rendering`, `../physics`, `../ui` |
| `src/ai/` | — | `three`, `@dimforge/rapier3d`, `idb`, `../rendering`, `../ui` |
| `src/gameplay/` | content, math | `three`, `@dimforge/rapier3d`, `idb`, `../rendering`, `../ui` — **eccezione esplicita**: `PlayerCharacterController.ts` può importare Rapier (è l'unico adapter gameplay↔fisica; commento nel codice segnala che andrebbe spostato in `src/adapters/` in futuro) |
| `src/ui/` | — | `../ecs/World`, `../simulation/Simulation` (la UI consuma solo view-model, mai lo stato ECS diretto) |

Lo script cammina ricorsivamente `src/`, estrae ogni import/export/dynamic-import via regex, e fallisce con elenco puntuale delle violazioni se una regola non è rispettata. Verifica anche simboli vietati (`Math.random()`, `Date.now()`, `performance.now()`) dentro `simulation/`, `procedural/`, `ai/` — perché romperebbero il determinismo.

### 4.2 ECS ibrido

`src/ecs/`:

- **`EntityAllocator.ts`**: `MAX_ENTITIES = 4096`, ID generazionali (`Uint16Array` di generazioni + `Uint8Array` di alive-flag + free-list), branded type `EntityId = number & { __brand: 'EntityId' }`.
- **`World.ts`**: aggrega allocator + due component store SoA (`TransformStore`, `HealthStore`). `createEntity()`/`destroyEntity()`/`isAlive()`.
- **`components/TransformStore.ts`**: posizione/rotazione/scala in `Float32Array` (SoA, Structure of Arrays) per cache-friendliness.
- **`components/HealthStore.ts`**: HP in `Float32Array`.
- **`components/PerceptionStore.ts`**: stati di percezione nemica in SoA (8 stati).

Filosofia dichiarata: SoA (TypedArray) per componenti "caldi" (hot path, letti/scritti ogni frame su molte entità), oggetti immutabili per dati "freddi" (contenuto, configurazione).

**Nota di completezza**: il World ECS ha *solo* transform e health come componenti concreti. Tutti gli altri sistemi (combattimento, torcia, armi, nemici) sono implementati come moduli funzionali indipendenti con il proprio stato locale (es. `TorchRuntime`, `CombatState`, `MummyRuntime`) — **non** sono ancora componenti ECS nel World. Sono "pronti per essere integrati" ma oggi vivono fuori dall'ECS.

### 4.3 RNG deterministico a canali (`src/procedural/SeedRng.ts`)

Punto critico dell'architettura, motivato da un bug fix esplicito (MIG-11):

- 6 canali dichiarati: `topology`, `roles`, `encounters`, `loot`, `decor`, `lighting`.
- Ogni canale è un'istanza **indipendente** di xorshift32, il cui seed è derivato con `hash32(rootSeed, generationVersion, saltDelCanale, index)` — mai dallo stato di un altro canale.
- Il salt di canale è `hashString32(nomeCanale)`, non l'ordine di dichiarazione: aggiungere un nuovo canale non altera la sequenza degli altri.
- Invarianti testate con property-based test (100 run): consumare N numeri in un canale non altera un altro canale; stesso `(seed, generationVersion)` ⇒ stessa sequenza per ogni canale; semi diversi ⇒ sequenze diverse; `next()` ∈ [0,1); `int(min,max)` ∈ [min,max); `shuffle` preserva gli elementi.
- Implementazione RNG: xorshift32 (non crittografico, adeguato a generazione di livelli — dichiarato esplicitamente nei commenti).

`src/procedural/Hash32.ts` fornisce `hash32` (combinazione di più interi) e `hashString32` (FNV-1a) con fmix32 di MurmurHash3 per il rimescolamento finale.

### 4.4 Fixed step game loop

`src/core/FixedStepClock.ts`: clock a passo fisso, `TICK_HZ = 60` (definito in `content/balance.ts`). `maxSteps` di recupero = **5** (era 10, corretto in questa sessione di sviluppo per allineamento a spec: "max 5 recovery steps" — evita spirali di morte quando il frame rate crolla).

Frequenze dichiarate nei commenti: fisica/gameplay a 60 Hz, AI decision-making a 10 Hz (bucket per `EntityId`, vedi §4.6).

### 4.5 Branded types

Pattern ricorrente in tutto il codice per prevenire mix-up di ID numerici a livello di tipo:

```ts
type EntityId = number & { readonly __brand: 'EntityId' };
type RoomId = number & { readonly __brand: 'RoomId' };
type FloorId = string;
type Ticks = number & { readonly __brand: 'Ticks' };
type Seed = number;
```

**Attenzione**: `EntityId` è ridichiarato localmente e in modo incoerente in più file (`ecs/EntityAllocator.ts`, `simulation/Director.ts`, `gameplay/combat/*.ts`, `gameplay/enemies/*.ts`) invece di essere importato da un'unica fonte. Sono strutturalmente compatibili (stesso brand string) ma è debito tecnico: un refactor dovrebbe centralizzarli in `src/ecs/EntityAllocator.ts` e importarli ovunque.

### 4.6 Pattern funzionali

- **`Result<T, E>`** (`src/core/Result.ts`): `ok(value)` / `err(error)` / `expectOk()`. Usato per validazione (es. `FloorValidator.validateFloor` restituisce `Result<FloorModel, Violation[]>`).
- **Sistemi come factory function**: quasi ogni modulo esporta `createX()` che ritorna un oggetto con metodi chiusi sullo stato interno (closure), non classi — eccezione: `PlayerCharacterController` è una `class` (unico caso nel codebase, perché wrappa oggetti Rapier stateful).
- **Comandi esaustivi con `switch`**: es. `TorchCommand` è una union discriminata su `kind`, gestita con `switch` che termina con `const exhaustive: never = command` — se si aggiunge un nuovo comando senza gestirlo, la build fallisce.
- **AI decision bucketing**: `shouldDecideThisTick(entityId, currentTick, decisionIntervalTicks)` distribuisce le decisioni AI nel tempo per `EntityId` così da evitare spike di CPU quando molti nemici decidono nello stesso tick.

### 4.7 Scheduler a fasi

`src/core/SystemScheduler.ts`: sistemi con `phase` in `input | ai | physics | gameplay | animation | render`, eseguiti sempre in quest'ordine (`PHASE_ORDER`). `register()`/`unregister()`/`tick()`.

---

## 5. Struttura del filesystem

```
La Piramide Perduta/
├── index.html                  entry HTML, canvas #game-canvas, tema scuro caldo
├── package.json                script npm, dipendenze
├── vite.config.ts              build tool, alias @/ → src/, target es2022
├── vitest.config.ts            test runner, stesso alias, pool threads
├── tsconfig*.json               4 varianti (root/sim/worker/node)
├── eslint.config.mjs           strictTypeChecked + stylisticTypeChecked
├── .prettierrc
├── public/                     favicon.svg, icons.svg (unici asset presenti)
├── scripts/                    script Node .mjs indipendenti da Vite
│   ├── verify-boundaries.mjs   confini architetturali (§4.1)
│   ├── verify-content.mjs      range dei valori di balance.ts
│   ├── benchmark-generation.mjs   placeholder, non collegato a FloorGenerator reale
│   ├── benchmark-replay.mjs       placeholder, simulazione fittizia
│   └── export-diagnostics.mjs  conta file/righe per layer, dipendenze, errori tsc
├── src/
│   ├── main.ts                 entry point, crea il loading screen e chiama createGame()
│   ├── app/
│   │   ├── createGame.ts       bootstrap: trova #game-canvas, crea GameApplication, resize/visibility handler
│   │   └── GameApplication.ts  orchestratore stateful dell'intero ciclo di vita (il "controller" principale)
│   ├── config/
│   │   ├── GameConfig.ts       schema Zod: render/audio/accessibility/controls/debug
│   │   ├── FeatureFlags.ts     5 flag booleani con default conservativi
│   │   └── PerformanceTiers.ts detectCapabilities() + selectBackend()
│   ├── core/
│   │   ├── Result.ts           Result<T,E>
│   │   ├── AppError.ts         codici di errore tipizzati
│   │   ├── FixedStepClock.ts   clock a 60 Hz, max 5 step di recupero
│   │   ├── Logger.ts           logger strutturato a livelli
│   │   └── SystemScheduler.ts  scheduler a fasi (§4.7)
│   ├── math/
│   │   └── Vec3.ts             vettore 3D puro, nessuna dipendenza da Three
│   ├── ecs/                    §4.2
│   ├── procedural/             generazione piano, validazione, RNG, hash
│   ├── ai/                     percezione, FSM, utility AI, pathfinding, swarm
│   ├── simulation/             orchestratore, event queue, snapshot, Director, systems/
│   ├── gameplay/               combattimento, torcia, armi, scavo, echo, nemici, innesti, player
│   ├── physics/                Rapier: world, collision layers, collider factory, runtime WASM
│   ├── rendering/               Three.js: renderer service, quality controller
│   ├── content/                 dati immutabili: balance.ts, enemies.ts, weapons.ts, upgrades.ts, loot/
│   ├── progression/              Ka tree, SaveManager (IndexedDB)
│   ├── audio/                    Web Audio Engine
│   ├── input/                    ActionMap + InputSystem
│   ├── ui/                       HUD.ts, SettingsMenu.ts (DOM/CSS)
│   └── workers/                  generation.worker.ts + protocollo + client
├── tests/
│   ├── gameplay/                11 file, 93 unit test sui sistemi gameplay
│   ├── property/                2 file: floor-invariants + combat-properties (fast-check)
│   ├── input/                   ActionMap.test.ts, InputSystem.test.ts
│   └── fixtures/regression-seeds.json   vuoto, array []
└── dist/                        output di build (generato, non versionare modifiche a mano)
```

---

## 6. Loop di gioco reale — come i pezzi si connettono OGGI

Questo è il punto più importante per chi riprende il progetto: **esiste ancora un divario tra l'architettura "giusta" (simulazione ECS + fisica Rapier) e cosa gira davvero nel browser**, ma dopo il completamento di **G-01** (vedi `PIANO_COLMATURA_GAP.md`) il divario si è ristretto: fisica e player controller sono ora reali. Restano scollegati generazione procedurale, combattimento, IA, persistenza e audio (G-02 e successivi).

### 6.1 Cosa fa `main.ts` → `createGame.ts` → `GameApplication.ts` (aggiornato post G-01)

1. `main.ts` mostra una schermata di caricamento DOM, poi chiama `createGame()`.
2. `createGame()` trova `#game-canvas`, crea un `GameApplication` (via `createGameApplication()`), imposta le dimensioni canvas, chiama `app.init(canvas)` poi `app.start()`. Registra resize e visibilitychange (pausa automatica su tab nascosta).
3. `GameApplication.init()`:
   - rileva le capability (`detectCapabilities()`) e sceglie il backend (`selectBackend`, preferisce WebGPU, fallback WebGL2, altrimenti throw);
   - **crea `PhysicsWorld` (Rapier) prima del renderer** (`await createPhysicsWorld()`);
   - crea `QualityController`, `FixedStepClock` (60 Hz), `Simulation` (world ECS + scheduler + event queue), `ActionMap`, `InputSystem`, `HUD`, `SettingsMenu`;
   - crea `ThreeRendererService` passandogli `physicsWorld.raw` e lo inizializza — **la scena resta di test hardcoded** (piano 40×40, 5 colonne cilindriche, un sarcofago, una porta interattiva, muri perimetrali invisibili) ma ora ogni elemento ha un **collider Rapier reale** allineato (fixed body per muri/colonne/sarcofago, kinematic body per la porta);
   - **crea l'entità ECS del player** (`simulation.world.createEntity()`), imposta `HealthStore` iniziale, istanzia `PlayerCharacterController` (Rapier KinematicCharacterController) e registra `PlayerSystem` (fase `input`) + `PhysicsSystem` (fase `physics`) sullo scheduler;
   - tenta di avviare il `generation.worker.ts` (creato ma **il floor generato non viene ancora richiesto né usato** — nessuna chiamata a `generationClient.request(...)`, resta gap G-02);
   - crea `torchRuntime` locale (`TorchSystem.createTorch`) — la torcia FUNZIONA nel loop reale (F per accendere, consumo di carburante, evento fuel-empty);
   - monta HUD e SettingsMenu, mostra il tutorial, registra pointer lock su click.
4. Il loop (`requestAnimationFrame`) ogni frame:
   - `input.beginFrame()` + `processInput()` — gestisce toggle torcia, interact (porta), pausa (mostra/nasconde settings), switch armi (**solo cambia una stringa `weaponName`, nessun `WeaponSystem` reale collegato — resta gap G-03**);
   - **mouse-look accumulato una volta per frame** (`cameraYaw`/`cameraPitch`, non per tick fisso di simulazione — evita che la sensibilità dipenda dal numero di step fissi eseguiti);
   - `clock.update(deltaMs)` calcola quanti step fissi eseguire; per ognuno chiama `simulation.step(...)` che ora esegue davvero `PlayerSystem.update` (polling input → `PlayerCharacterController.update` → sincronizza `TransformStore`) e `PhysicsSystem.update` (`physicsWorld.step()`), oltre a `tickTorch(torchRuntime)`;
   - **la camera riflette la posa calcolata dalla fisica**: `renderer.setCameraPose(x, y + eyeOffset, z, yaw, pitch)` legge `playerController.getState()` — il renderer non decide più movimento/collisioni;
   - `updateHUD()` — HP/torcia/oscurità/arma (gli HP ora leggono `HealthStore`; l'oscurità non è ancora un sistema autonomo completo ma non è più fissa: `DARKNESS_RELIEF` dei bracieri la riduce davvero nello stato runtime mostrato dall'HUD);
   - `renderer.render(deltaMs)`.

### 6.2 Cosa esiste ma non è ancora collegato (aggiornato — G-01 rimosso dalla lista)

Questi moduli sono completi, testati unitariamente, e conformi alle regole di boundary — ma **ancora irraggiungibili dal loop reale**:

- L'intero `src/gameplay/combat/` (CombatSystem, HitRegistry, DamageResolver, HurtboxStore, AttackDefinition) — nessuna hurtbox spawna, nessun nemico esiste nella scena, quindi nessun combattimento è possibile in game (gap G-03).
- `src/gameplay/weapons/` (WeaponSystem, durabilità) — lo slot arma nell'HUD cambia nome ma non ha alcun effetto meccanico.
- `src/gameplay/digging/` (scavo, sondaggio) — nessun `DigSite` viene mai creato nella scena (gap G-04).
- `src/gameplay/echo/KaEchoSystem.ts` — non è più il percorso runtime reale: il tasto R passa oggi da `TorchActions`/`TorchSystem`, genera `KA_ECHO_PULSE` e alimenta un consumer AI minimo via stato di stimolo runtime; resta comunque fuori da un sistema AI/audio generale (gap G-04).
- `src/gameplay/enemies/` (MummySystem, ScarabSystem) — nessuna istanza mai creata; zero nemici in scena (gap G-03).
- `src/ai/*` (percezione, FSM, utility AI, pathfinding, swarm) — mai chiamato, perché non ci sono entità nemiche.
- `src/simulation/Director.ts` — non esiste ancora come sistema runtime continuo, ma viene ora usato almeno nel bootstrap per pianificare lo spawn iniziale dello scarabeo nel layout procedurale; nessun loop di spawn durante la run avviene ancora.
- `src/procedural/FloorGenerator.ts` — il worker esiste e sa generare piani validi, ma **nessuna chiamata lo invoca**; la scena è sempre quella di test hardcoded in `ThreeRendererService.ts` (gap G-02, prossimo da affrontare).
- `src/progression/SaveManager.ts` e `KaProgression.ts` non coprono ancora l'intero meta-loop, ma sono ormai istanziati davvero da `GameApplication`: il profilo viene caricato all'avvio, aggiornato sugli eventi runtime principali e riusato per overlay/tabella Ka e bonus persistenti (gap G-05 ancora parziale).
- `src/audio/WebAudioEngine.ts` — mai istanziato; nessun suono viene mai riprodotto (e comunque genererebbe solo silenzio, vedi §10; gap G-06).
- `src/gameplay/upgrades/` — nessuna fucina, nessun innesto applicabile in game.
- `src/gameplay/torch/BrazierSystem.ts` — nessun braciere esiste nella scena di test (c'è solo una `SpotLight` fissa sulla camera).

### 6.3 Cosa funziona davvero, oggi, giocando nel browser (aggiornato post G-01)

- **Movimento FPS in prima persona via Rapier KinematicCharacterController reale**: WASD + mouse-look, collisione fisica vera (non più `Box3` ad-hoc) contro muri/colonne/sarcofago/porta, con autostep, snap-to-ground, gravità, terminal velocity.
- **Sprint e crouch ora meccanicamente reali** (governati da `PlayerCharacterController`, che li implementava già ma non era mai raggiunto): sprint cambia la velocità target, crouch cambia altezza capsula e velocità. Salto con coyote time e input buffer funzionante.
- Torcia: F accende/spegne, consumo di carburante reale nel tempo, flicker organico (3 onde sinusoidali sovrapposte), messaggio HUD quando si esaurisce.
- Una porta interagibile con E (scorre lateralmente, ora muove anche il proprio rigid body kinematic Rapier, non solo la mesh visiva).
- HUD con barra HP reale, barra torcia (dinamica, funzionante), indicatore oscurità runtime (ora ridotto davvero dai bracieri), nome arma (cambia testo, nessun effetto) e minimappa schematica reale che mostra stanze rivelate/speciali e posizione del giocatore. `Tab` apre inoltre un overlay runtime che mostra mappa testuale, bestiario con schede sintetiche sbloccate, graft scoperti e albero Ka con acquisto diretto dei nodi.
- Alla morte compare anche una schermata runtime dedicata con causa del decesso e retry, che si abilita solo dopo la sincronizzazione del profilo.
- Tutorial overlay con i comandi, dismissable, attiva il pointer lock.
- Menu impostazioni (Esc) con tutti i 14 controlli di accessibilità, applicazione runtime/persistenza profilo e sezione di rebind che cattura il prossimo tasto, aggiorna `ActionMap`/`InputSystem` a caldo e salva i binding nel profilo; i residui di G-07 restano sugli effetti accessibilità ancora non cablati, non più sulla persistenza o sul menu.
- Adaptive quality: `QualityController.adaptTo(frameTime)` degrada il tier se il frame time supera la soglia, ma **nessun sistema di rendering legge mai `quality.profile`** per applicare davvero i limiti (shadow map size, max luci, ecc.).

**In sintesi**: dopo G-01 il "gioco" avviabile con `npm run dev` è un tech-demo di movimento FPS **fisicamente reale** (Rapier) con torcia funzionante, ma ancora sganciato da generazione procedurale, combattimento, IA e persistenza. Il collegamento di questi pezzi resta il lavoro più grande rimasto — vedi `PIANO_COLMATURA_GAP.md` per il piano dettagliato gap-per-gap e l'ordine di esecuzione consigliato (§7.2 di quel documento).

---

## 7. Game design — meccaniche (ricostruite dal codice)

### 7.1 Torcia (`src/gameplay/torch/TorchSystem.ts`, `content/balance.ts` → `TORCH`)

Macchina a stati: `OFF → LOW/HIGH → PLACED`. Combustibile in **secondi**, tutte le durate interne in **tick** (60 Hz).

| Parametro | Valore |
|---|---|
| Combustibile iniziale | 180 s |
| Consumo (rateo relativo a HIGH) | OFF: 0 · LOW: 0.4 · HIGH: 1.0 · PLACED: 1.0 |
| Durata agitazione (WAVE) | 0.8 s |
| Cooldown agitazione | 2.0 s |
| Costo accensione braciere | 12 s di combustibile |
| Ricarica max da braciere | 60 s, una sola volta per braciere |
| Sollievo debito oscurità da braciere | −8 |

Comandi: `TOGGLE`, `SET`, `WAVE`, `PLACE`, `PICK_UP`, `IGNITE_BRAZIER`, `REFILL_FROM_BRAZIER`, `KA_ECHO`. Ogni comando ritorna `{ runtime, changed, effects }` — mai eccezioni, transizioni non ammesse restituiscono `changed: false`.

### 7.2 Richiamo del Ka / Ka Echo (`src/gameplay/echo/KaEchoSystem.ts`, dietro `feature.kaEcho`)

Impulso attivo di orientamento — probabile meccanica di tipo "sonar" per illuminare/rivelare l'ambiente circostante.

| Parametro | Valore |
|---|---|
| Costo | 3 s di combustibile |
| Cooldown | 12 s |
| Durata effetto | 1.5 s |
| Rumore generato | 4.0 (il più alto fra le azioni, vedi §7.6) |

Richiede torcia con combustibile sufficiente; non attivabile in cooldown.

### 7.3 Combattimento (`src/gameplay/combat/`)

Grammatica a 4 fasi, identica per giocatore e nemici: **READY → ANTICIPATION → ACTIVE → RECOVERY → READY**. Le durate sono per-attacco (`AttackDefinition`), non globali.

Formula danno (`DamageResolver.resolveDamage`):

```
raw = baseDamage × attackModifier × sourceModifier × criticalMultiplier(se critico)
appliedArmor = clamp(targetArmor, 0, armorCap=0.75)
mitigated = raw × (1 − appliedArmor)
resisted = mitigated × resistanceMultiplier
finalDamage = raw ≤ 0 ? 0 : max(minimumDamageHp=1, round(resisted))
```

Invarianti garantite (testate con property-based test, 100 run): danno finale ≥ 1 quando tutti i moltiplicatori sono positivi; armatura mai oltre 0.75 (nessuna invulnerabilità); determinismo (stessi input ⇒ stesso output); critico ≥ normale a parità di input; nessun NaN/Infinity propagato (input non finiti normalizzati a 0).

Altre regole:

- `HitRegistry`: un bersaglio può essere colpito **una sola volta per swing** (chiave `attackerId:targetId:attackId:activeStartTick`).
- Stun pesante: max 1 ogni 1.2 s (`COMBAT.maxHeavyHitStunPerSecond = 1/1.2`).
- Grazia nuova stanza: 2.0 s dall'ingresso, nessun nemico può entrare in ACTIVE.
- Due attacchi pesanti da nemici diversi non si sovrappongono entro 0.4 s (`heavyOverlapGuardTicks`).
- Durabilità arma: ×2 il consumo contro nemici corazzati, ×0.5 contro nemici molli; avviso al 20% di durabilità residua.
- Ordine di risoluzione danno deterministico per `EntityId` (`sortTargetsDeterministically`) — necessario per il replay.

### 7.4 Armi (`content/weapons.ts`, `content/balance.ts` → `WEAPONS`)

| Arma | Danno | Intervallo | Portata | Durabilità | Note |
|---|---|---|---|---|---|
| Pugni | 3 | 0.65 s | 1.1 m | ∞ | fallback sempre disponibile |
| Khopesh | 18 | 0.78 s | 1.7 m | 120 (colpi) | parabile |
| Bastone | 11 | 0.55 s | 2.2 m | 180 (colpi) | parabile |
| Pala | 7 | 1.0 s | 1.5 m | 30 (scavi, non colpi) | usata anche per scavare |

### 7.5 Scavo e sondaggio (`src/gameplay/digging/`, `content/balance.ts` → `DIGGING`)

Scavo del tesoro in **4 segmenti persistenti**, interrompibile senza perdita di progresso, richiede torcia accesa.

| Parametro | Valore |
|---|---|
| Durata totale | 8 s (÷4 segmenti = 2 s/segmento) |
| Rumore per segmento | crescente: 2.0 → 3.0 → 4.0 → 5.0 (completamento) |
| Sondaggio: durata | 0.6 s |
| Sondaggio: raggio "cavo vicino" | 1.5 m |
| Sondaggio: raggio "cavo lontano" | 6.0 m, oltre = "roccia" |
| Fallback passivo | dopo 60 s nella regione corretta |
| Max sondaggi per certezza | 3 |

Sondaggio dietro `feature.sounding`, 3 livelli di risposta: `ROCK`, `HOLLOW_FAR`, `HOLLOW_NEAR`.

### 7.6 Rumore (`content/balance.ts` → `NOISE_MULTIPLIER`)

Scala relativa usata per il calcolo della percezione uditiva nemica:

| Azione | Rumore |
|---|---|
| Accovacciato | 0.2 |
| Camminata | 1.0 |
| Schivata | 2.2 |
| Scavo (sondaggio) | 2.0 |
| Attacco leggero | 1.5 |
| Sprint | 2.8 |
| Attacco pesante | 3.0 |
| Scavo (completamento segmento, max) | 5.0 |
| Richiamo del Ka | 4.0 |

### 7.7 Nemici (`content/enemies.ts`, `src/ai/`, `src/gameplay/enemies/`)

8 archetipi definiti in `ENEMIES: Record<EnemyArchetype, EnemyDef>`:

| Archetipo | HP | Velocità | Torch Affinity | Tier | Corrotto | Note |
|---|---|---|---|---|---|---|
| SCARAB (Scarabeo di Lapislazzuli) | 20 | 6.0 m/s | +0.7 (attratto dalla luce) | 1 | no | attacco: Carica Ondulante |
| MUMMY (Mummia Dormiente) | 60 | 1.5 m/s | −0.6 (respinto dalla luce) | 1 | no | Fendente a Due Mani (pesante) + Presa |
| COBRA (Cobra delle Fessure) | 25 | 4.0 m/s | 0.0 | 1 | no | Morso Rapido, alto udito (12 m) |
| SHABTI (Shabti Guardiano) | 120 | 2.0 m/s | 0.0 | 2 | no | Colpo di Scettro + Carica di Pietra (8 m range) |
| PRIEST (Sacerdote delle Ceneri) | 80 | 3.0 m/s | 0.0 | 2 | **sì** | Dardo d'Ombra a distanza (20 m range) |
| SOBEK_SPAWN (Figlio di Sobek) | 200 | 5.0 m/s | 0.0 | 2 | no | Morso Rotante + Colpo di Coda a 360° |
| ROYAL_MUMMY (Mummia Reale) | 300 | 2.5 m/s | −0.6 | 3 | **sì** | mini-boss, Fendente Reale ad arco largo (140°) |
| WITNESS (Il Testimone) | ∞ | 0.5 m/s | 0.0 | 3 | **sì** | nessun attacco, `viewRadiusM: 0` — probabile minaccia ambientale/timer di oscurità, non un nemico da combattere |

Sistemi comportamentali specifici implementati per due archetipi (gli altri hanno solo la definizione dati, senza runtime dedicato):

- **MummySystem**: risveglio 2.5 s (finestra di fuga o "free hit" per il giocatore), rotazione massima 60°/s verso il bersaglio, arretramento alla luce con cooldown 3.0 s, bende infiammabili (danno da fuoco ×2 — dato dichiarato ma non collegato a un sistema di fuoco).
- **ScarabSystem**: tell di carica 0.4 s, carica attiva 0.3 s, recupero 0.8 s, max 2 cariche simultanee per gruppo (gestito da `SwarmSteering.canStartCharge`), gruppi di 3–6 individui, steering boids (separazione/coesione/allineamento) più attrazione verso la torcia posata.

FSM di stato nemico (8 stati, `EnemyState.ts`): `DORMANT → SUSPICIOUS → ALERTED → ENGAGE ⇄ RECOVER → SEARCH → FLEE/DEATH`, transizioni validate da `canTransition()`.

Percezione (`PerceptionSystem.checkPerception`): cono di vista frontale (raggio × fattore di illuminazione: 1.0 se torcia HIGH/PLACED, 0.6 se LOW, 0.3 se OFF), sfera uditiva attenuata dal rumore del giocatore, senso del Ka (solo nemici corrotti, ignora i muri, raggio fisso 4 m).

Decisione (`EnemyDecisionSystem.decideAction`): utility AI (non GOAP), punteggi per azione (`ATTACK_LIGHT`, `ATTACK_HEAVY`, `CIRCLE_STRAFE`, `RETREAT`, `INVESTIGATE`, `FLEE_TO_COVER`, `PATROL`, `IDLE`) sommati da HP residui, distanza, visibilità, rumore, affinità torcia, alleati vicini. Bucket temporale per `EntityId` per distribuire il carico.

Pathfinding: A* su griglia (`GridNavigator.findPath`, budget 512 nodi esplorati, 8 direzioni, euristica Manhattan) per nemici singoli; flow-field/boids (`SwarmSteering`) per sciami sopra soglia.

### 7.8 Threat Director (`src/simulation/Director.ts`, `content/balance.ts` → `DIRECTOR`)

Calibra la pressione di combattimento per piano.

```
budget = baseBudget × (1 + powerBandExtra) × (hadWipe ? 0.75 : 1)
```

| Power band (nodi Ka acquistati) | Extra budget |
|---|---|
| 0–2 | +0% |
| 3–5 | +15% |
| 6–8 | +30% |
| 9+ | +45% |

Altre regole: nessuno spawn entro 4 m dal giocatore; max 1 incontro non-telegrafato ogni 3 stanze; dopo un wipe (morte di gruppo), grace period di 90 s con nessuno spawn; sotto 15 s di combustibile torcia, nessuna imboscata non-telegrafata spontanea. Fallback esplicito: se il budget calcolato è negativo, il piano resta vuoto invece di crashare ("meglio troppo facile che un crash", commento nel codice).

### 7.9 Progressione (`src/progression/KaProgression.ts`)

Albero "Ka" con 8 nodi acquistabili con "Frammenti":

| Nodo | Costo | Livelli max | Effetto |
|---|---|---|---|
| Respiro Lungo | 10 | 3 | +10% combustibile torcia/livello |
| Ka Robusto | 15 | 3 | +10 HP max/livello |
| Mano Ferma | 30 | 1 | inizia ogni run con un bastone |
| Occhio del Ladro | 45 | 1 | tell visivo sui sarcofagi pericolosi |
| Passo di Bastet | 60 | 1 | 0.12 s i-frame nella schivata |
| Memoria di Thoth | 80 | 1 | mappa garantita nella prima metà del piano |
| Patto di Anubi | 120 | 1 | una resurrezione per run al 30% HP |
| Sangue di Ra | 200 | 1 | una maledizione depositabile per piano |

`computePowerBand(purchasedNodeCount)` alimenta direttamente il budget del Director (§7.8) — stesso schema a 4 fasce. Nel runtime attuale, cinque nodi hanno gia effetto immediato e verificabile: `Respiro Lungo` aumenta davvero la capacita massima della torcia, `Ka Robusto` aumenta davvero gli HP massimi del giocatore, `Mano Ferma` sblocca davvero il bastone iniziale, `Memoria di Thoth` forza davvero la stanza mappa nella prima meta del piano e `Patto di Anubi` concede davvero una resurrezione per run al 30% HP; gli altri nodi restano ancora persistiti ma non cablati a sistemi runtime concreti.

### 7.10 Innesti / Upgrade (`content/upgrades.ts`)

5 modificatori arma definiti, di cui 3 disponibili nel vertical slice (`VERTICAL_SLICE_UPGRADES`):

| Innesto | Costo (oro) | Effetto | Nel vertical slice |
|---|---|---|---|
| Bronzo del Nilo | 40 | +15% danno, −20% durabilità | sì |
| Osso di Sciacallo | 55 | +20% velocità attacco, −10% danno | sì |
| Resina d'Ambra | 30 | +50% durabilità, −10% velocità attacco | sì |
| Lapislazzuli | 70 | +5 danno contro non-morti | no (`ALL_UPGRADES` ma non VS) |
| Occhio di Horus | 90 | +30% critico da dietro, −10% danno frontale | no |

Un innesto applicabile una sola volta per arma; anteprima numerica prima della conferma (`previewUpgrade`).

### 7.11 Loot (`content/loot/treasureTables.ts`)

Una sola tabella definita, `TREASURE_TABLE_PYRAMID_1`: oro 150–300, 5% probabilità di frammento Ka, pool pesato di 5 oggetti (2 armi, 3 innesti).

### 7.12 Feature flag (`src/config/FeatureFlags.ts`)

| Flag | Default | Significato |
|---|---|---|
| `kaEcho` | `false` | Richiamo del Ka |
| `sounding` | `false` | Sondaggio del terreno |
| `brazierInvestment` | `false` | Bracieri come investimento territoriale |
| `punishWindowSignal` | `true` | Segnalazione visiva della finestra di punizione |
| `directorAntifrustration` | `true` | Protezioni anti-frustrazione del Director |

Tutti dichiarati per rollout graduale/A-B testing delle meccaniche v4 (ADR-009, ADR-010 citati nei commenti). Un override con chiave sconosciuta viene ignorato con `console.warn`, mai silenziosamente accettato.

### 7.13 Generazione procedurale del piano (`src/procedural/FloorGenerator.ts`)

Algoritmo: **Growing Tree maze** su griglia 8×6 con bias verso l'ultima cella attiva (`corridorBias = 0.6`, favorisce corridoi lunghi), seguito da **braiding** (25% dei vicoli ciechi riceve una porta extra per creare loop, `braidingRatio = 0.25`), poi assegnazione ruoli, posizionamento mappa/tesoro, landmark, validazione.

10 ruoli di stanza: `ENTRY, EXIT, SAFE, COMBAT, TOOL, MAP, TREASURE, FORGE, OPTIONAL, JUNCTION`. Regole di assegnazione: ENTRY = stanza più a sinistra della griglia, EXIT = più a destra; MAP preferibilmente in una stanza "normale" (non junction, non dead-end); TREASURE scelta fra le stanze a distanza-grafo 2–6 da MAP (1–6 se tutorial), preferendo la mediana delle candidate; FORGE preferibilmente in un vicolo cieco; almeno 1 SAFE, 1 FORGE, 2 OPTIONAL garantiti.

18 landmark testuali disponibili (es. `statua-anubi`, `obelisco-spezzato`, `braciere-eterno`), assegnati con priorità alle intersezioni (≥3 porte) e alle stanze di ruolo speciale, senza duplicati.

**Retry loop**: fino a 20 tentativi con seed salato (`seed XOR (attempt × 0x9e3779b9)`), poi fallback a un template lineare fisso di 14 stanze se tutti i tentativi falliscono la validazione — non lancia mai un'eccezione verso il chiamante.

15 invarianti verificate da `FloorValidator.validateFloor` (`FLOOR_INVARIANTS`, INV-01…INV-15): percorso entry→exit esiste; percorso map→treasure esiste; treasure ≠ map; ID stanza unici; porte reciproche; bounds non sovrapposti; clearance minima di spawn; distanza map-treasure nel range; landmark unico per intersezione; nessun NaN/Infinity; round-trip di serializzazione identico; determinismo seed→output; conteggi di ruolo obbligatori rispettati; il tesoro non è sul percorso critico (salvo tutorial); nessuna chiave chiusa dietro la porta che apre. Le violazioni sono classificate `BLOCKING` (rifiuta il piano, forza retry) o `WARNING` (accettato ma segnalato).

Eseguita in un **Web Worker dedicato** (`generation.worker.ts`) per non bloccare il thread principale — con timeout lato client di 30 s (`GenerationClient.request`). **Come detto in §6.2, questo worker non è mai invocato dal loop di gioco reale.**

---

## 8. UI/UX

### 8.1 Palette colori (ricorrente in HUD, tutorial, settings)

| Colore | Hex | Uso |
|---|---|---|
| Sfondo primario | `#0B0908` | body, sfondo scena Three.js, nero caldo |
| Sfondo pannelli | `#1A1512` | tutorial, settings, message box |
| Bordo pannelli | `#4A2F1A` | bordi di tutti i riquadri |
| Testo/accento primario | `#D4A05A` | oro/ambra — colore dominante dell'HUD |
| Testo secondario | `#8B7355` | descrizioni, label secondarie |
| Accento freddo | `#2E8B8B` | sezioni, indicatori di stato secondari (es. livello oscurità) |
| HP alto | gradiente `#6A334D → #9A2B2B` | barra vita |
| HP critico (≤25%) | gradiente `#6A334D → #8B1A1A` | barra vita in pericolo |
| Torcia accesa | gradiente `#D4A05A → #FF8C00` | barra combustibile |
| Torcia critica (≤20%) | gradiente `#8B1A1A → #FF4500` | allarme visivo |

Font: `'Courier New', monospace` ovunque nell'interfaccia — scelta stilistica per un tono "diario/papiro" retro-tecnologico coerente col tema "noir egizio".

### 8.2 HUD (`src/ui/HUD.ts`, DOM-based, non canvas)

Elementi (posizionamento assoluto, `pointer-events: none` sul contenitore root):

- **Barra HP** (basso-sinistra): 200×18px, colore dinamico in base alla percentuale.
- **Barra combustibile torcia** (sotto HP): 200×10px, colore dinamico (spento/critico/normale).
- **Indicatore oscurità** (sopra la barra torcia): testo `Oscurità: N (LIVELLO)` — 4 livelli testuali: CALMA (<25) / SUSSURRI (25–49) / PATTUGLIE (50–74) / TESTIMONE (≥75), soglie da `DARKNESS.thresholds`.
- **Nome arma + 3 slot** (basso-destra): nome in maiuscolo, slot con evidenziazione dello slot attivo.
- **Minimappa schematica runtime** (alto-destra): 140×140px, resa SVG dentro HUD DOM. Mostra entry/exit/stanza mappa, stanze rivelate e marker del giocatore; non mostra ancora landmark, tesoro o semantica avanzata.
- **Overlay tutorial**: schermo intero, semi-trasparente, elenco comandi diviso in 3 sezioni (Movimento/Azioni/Armi-Interfaccia), pulsante "CLICCA PER INIZIARE", dismissable anche cliccando fuori dal pannello.
- **Messaggi temporanei**: centrati, fade in/out, durata default 2.5 s (es. "🔥 Torcia accesa", "💀 Torcia esausta! Cerca un braciere...").

### 8.3 Menu impostazioni (`src/ui/SettingsMenu.ts`)

Overlay modale full-screen, form generato dinamicamente per 14 impostazioni di accessibilità raggruppate in 4 sezioni:

1. **Visione**: Luce Assistita, Alto Contrasto, Telegrafi Amplificati (toggle), Daltonismo (select: nessuno/protanopia/deuteranopia/tritanopia).
2. **Audio**: Indicatore Sonoro (toggle — sostituto visivo per il suono).
3. **Sottotitoli**: Nomi Personaggi, Direzione Audio.
4. **Gameplay**: Torcia Toggle (vs hold), Sprint Toggle (vs hold).
5. **Comfort**: Riduci Vibrazione Camera, Riduci Flicker Torcia, Disabilita Motion Blur, Barra Oscurità — più uno slider Scala Testo (1.0–1.6).

Pulsanti Annulla/Applica, chiusura con Esc. **Nessuna di queste impostazioni è oggi collegata a un effetto reale** (vedi §6.3).

### 8.4 Controlli di default (`src/input/ActionMap.ts`, GDD §7.1)

| Azione | Tasto |
|---|---|
| Movimento | W A S D (+ frecce) |
| Guarda | Mouse |
| Attacco / Parata | Click sinistro / destro |
| Interagisci | E |
| Schivata | Spazio |
| Accovacciati | Ctrl sinistro |
| Scatto | Shift sinistro |
| Salto | Spazio (condiviso con schivata — potenziale conflitto di design da rivedere) |
| Torcia ON/OFF | F |
| Posa/Raccogli torcia | G |
| Agita torcia | Q |
| Richiamo del Ka | R |
| Arma 1/2/3 | 1 2 3 |
| Mappa | Tab |
| Pausa | Esc |
| Debug overlay | \` (backquote) |

Sistema di rebind ora presente anche a runtime nel `SettingsMenu`: ogni azione mostra binding corrente, pulsante `Cambia`, cattura del prossimo `KeyboardEvent.code`, `Default` per reset e persistenza in `payload.settings.runtimeSettings.controls.bindings`.

### 8.5 Feedback visivo torcia

Flicker organico via sovrapposizione di 3 onde sinusoidali a frequenze diverse (0.7 Hz, 3.1 Hz, 11.3 Hz) con ampiezze decrescenti (±3%, ±6%, ±2%) — tecnica da "torch flicker" classica per evitare periodicità percepibile.

---

## 9. Rendering (`src/rendering/`)

### 9.1 Backend

`ThreeRendererService.ts` supporta **WebGPU** (preferito, via `three/webgpu`) con fallback automatico a **WebGL2** se l'inizializzazione WebGPU fallisce o non è disponibile. Rilevamento capability in `PerformanceTiers.detectCapabilities()`: controlla `navigator.gpu`, crea un context WebGL2 di prova (poi lo libera con l'estensione `WEBGL_lose_context`), legge `devicePixelRatio`, `navigator.deviceMemory`, `navigator.hardwareConcurrency`.

Tier di qualità rilevato automaticamente:
- **low** se `devicePixelRatio ≤ 1` OR `deviceMemory < 4GB` OR `hardwareConcurrency < 4`;
- **high** se `devicePixelRatio > 2` AND `deviceMemory ≥ 8GB` AND `hardwareConcurrency ≥ 8`;
- **medium** altrimenti (default).

### 9.2 Profili qualità (`QualityController.ts`)

| Tier | FPS target | Scala risoluzione | Shadow map | Max luci con ombra | Max luci realtime | Max nemici | Post-FX |
|---|---|---|---|---|---|---|---|
| low | 30 | 0.75× | 512 | 1 | 4 | 20 | no |
| medium | 60 | 1.0× | 1024 | 1 | 8 | 40 | sì |
| high | 120 | 1.5× | 2048 | 2 | 16 | 60 | sì |

`adaptTo(frameTimeMs)` degrada di un tier (high→medium→low) se il frame time supera `1000/targetFps` con un margine del 20%. **Non risale mai automaticamente** a un tier superiore (nessuna logica di upgrade). Come notato in §6.3, questo profilo non è ancora letto da nessun codice di rendering effettivo.

### 9.3 Scena attuale (hardcoded, di test)

- Piano 40×40 m, materiale `MeshStandardMaterial` marrone scuro.
- 5 colonne cilindriche (raggio 0.4–0.5, altezza 6) come ostacoli.
- 1 sarcofago (box 2.5×1.2×1.0) come elemento decorativo/interattivo.
- 1 porta scorrevole interagibile (E, entro 3 m).
- Muri perimetrali invisibili (20×20 m half-extent).
- Nebbia esponenziale (`FogExp2`, colore `0x0b0908`, densità 0.0008).
- Luce ambiente calda (`0xffddbb`, intensità 0.6) + emisfero (`0x88ccff`/`0x442200`, intensità 0.5) — necessarie perché altrimenti la scena sarebbe totalmente nera con la torcia spenta.
- Torcia = `THREE.SpotLight` (colore `0xd4a05a`, intensità base 80–100, angolo `π/5`, penombra 0.4, ombre 1024×1024) agganciata alla posizione/orientamento camera, `visible = false` di default.
- Tone mapping ACES Filmic (solo ramo WebGL2), color space sRGB.

Questa scena va sostituita con la geometria generata da `FloorGenerator` (rooms/corridoi/porte reali) per avere un livello di gioco vero.

### 9.4 Collisione nel renderer — ORA REALE (aggiornato post G-01)

**Superata**: la collisione non passa più da `THREE.Box3.intersectsBox`. `ThreeRendererService` riceve `physicsWorld.raw` (istanza `RAPIER.World`) da `GameApplication` e crea, per ogni elemento della scena di test (muri, colonne, sarcofago, porta), un rigid body Rapier con `ColliderFactory.createStaticBoxCollider` — fixed per gli elementi statici, kinematic per la porta apribile. Il movimento e la risoluzione delle collisioni sono ora interamente delegati a `PlayerCharacterController` (Rapier `KinematicCharacterController`); il renderer si limita a riflettere la posa calcolata (`RendererHandle.setCameraPose(x, y, z, yaw, pitch)`, che ha sostituito il precedente `updateMovement()`).

Limite noto: i collider delle colonne restano box che approssimano i cilindri visivi (stessa semplificazione già presente prima di G-01) — accettabile finché la geometria è di test; da rivalutare quando arriverà la mesh procedurale reale (G-02).

---

## 10. Fisica (`src/physics/`) — collegata e attiva (G-01)

- **`RapierRuntime.ts`**: init asincrono idempotente del WASM Rapier (`await import('@dimforge/rapier3d-compat')`), con promise condivisa per evitare doppio caricamento.
- **`PhysicsWorld.ts`**: wrapper del `RAPIER.World`, gravità `-9.81 m/s²`, timestep fisso `1/60`, 4 iterazioni solver, 1 iterazione PGS interna.
- **`CollisionLayers.ts`**: 4 layer bitmask (`PLAYER=1, ENVIRONMENT=2, ENEMY=4, SENSOR=8`), `InteractionGroups` a 32 bit (16 bit membership + 16 bit mask). Player interagisce con tutto; ambiente con player+nemici; nemici con tutto tranne i sensori; sensori solo col player.
- **`ColliderFactory.ts`**: helper per capsula player, box statico, trimesh statico (per geometria procedurale), capsula nemico, sensori (box e sfera). Attriti/restituzioni predefiniti per materiale (pietra/legno/sabbia/player).
- **`PlayerCharacterController.ts`** (399 righe, attivo nel loop reale dal G-01): `RAPIER.KinematicCharacterController` con accelerazione/decelerazione separata a terra/in aria, sprint, crouch (transizione morbida altezza capsula, ricrea il collider perché Rapier non supporta resize diretto), salto con coyote time (`PLAYER.coyoteTicks`) e input buffer (`PLAYER.inputBufferTicks`), autostep (`PLAYER.maxStepM`), snap-to-ground, terminal velocity `-30 m/s`. Wiring: `PlayerSystem`/`PhysicsSystem` sullo scheduler, collider statici da `ThreeDungeonLayout` (muri/colonne/sarcofago/porta kinematic), camera = posa autoritativa (`setCameraPose`).

---

## 11. Testing

### 11.1 Stato attuale (verificato in questa sessione, tutto verde)

```
npm run typecheck           →  pulito (0 errori)
npm run lint                →  pulito sull'intero progetto
npm run verify:boundaries   →  nessuna violazione
npm run verify:content      →  tutti i valori nei range previsti
npx vitest run              →  59 file di test, 333 test, tutti passati
npx vitest run --config vitest.config.dom.ts → 10 file, 43 test DOM (happy-dom)
npm run test:e2e            →  11 smoke test Playwright, tutti passati
npm run build (tsc -b + vite build) →  compila e bundlizza correttamente
```

Suddivisione:

- **`tests/gameplay/`** (11 file, 93 unit test): `DamageResolver`, `TorchSystem`, `CombatSystem`, `HitRegistry`, `WeaponSystem` (+ `WeaponDefinition`), `DiggingSystem`, `SoundingSystem`, `KaEchoSystem`, `Director`, `MummySystem`, `ScarabSystem`.
- **`tests/property/`** (2 file):
  - `floor-invariants.test.ts` — property test sul modello dati del `FloorValidator` (creato in sessione precedente, non riletto in dettaglio in questa sessione).
  - `combat-properties.test.ts` (11 property test, 100 run ciascuno via fast-check): 5 proprietà su `DamageResolver` (danno minimo, cap armatura, non-negatività, determinismo, critico≥normale) + 6 su `SeedRng` (indipendenza canali, riproducibilità seed+versione, diversità fra semi diversi, range `next()`, range `int()`, preservazione elementi in `shuffle()`).
- **`tests/input/`**: `ActionMap.test.ts`, `InputSystem.test.ts` (esistenti da sessione precedente, non riletti in dettaglio in questa sessione).

Scala di run count del property testing dichiarata nei commenti del progetto ma **non ancora implementata in CI** (nessuna pipeline CI esiste nel repo): 100 run in locale → 1.000 in PR → 10.000 su main → 100.000 nightly.

### 11.2 Cosa NON è testato

- Nessun test end-to-end oltre gli smoke principali del loop di bootstrap/runtime accessibile: mancano scenari e2e su combattimento esteso, scavo completo multi-step, progressione Ka avanzata e flussi multi-floor.
- Nessun test per `FloorGenerator.generateFloor()` end-to-end (solo il validator ha property test, non la generazione completa con retry/fallback).
- Nessun test per `SaveManager` (richiederebbe un ambiente con IndexedDB — `vitest.config.ts` usa `environment: "node"`, non `jsdom`/`happy-dom`, quindi IndexedDB non è disponibile senza cambiare configurazione o mockare `idb`).
- Nessun test per `PlayerCharacterController` (richiederebbe inizializzare Rapier WASM in ambiente di test).
- Nessun test per `ThreeRendererService`, `WebAudioEngine`, `HUD`, `SettingsMenu` (richiederebbero DOM — considerare `happy-dom` o `jsdom` come `environment` di Vitest, o Playwright component testing).
- Nessun test per `EnemyDecisionSystem`, `PerceptionSystem`, `GridNavigator`, `SwarmSteering` (logica AI pura, facilmente testabile senza dipendenze — buon prossimo target).
- Nessun test per `UpgradeSystem`, `BrazierSystem`, `KaProgression`.

**Aggiornamento**: il gate completo è ora verificato in modo ripetibile anche dopo i wiring successivi a G-01: `npm run verify` passa sull'intero progetto e `npm run test:e2e` passa con 7 smoke test Playwright.

### 11.3 Script di verifica custom

- **`scripts/verify-boundaries.mjs`**: cammina `src/`, verifica le regole di §4.1 via regex sugli import, più divieto di `Math.random()`/`Date.now()`/`performance.now()` in simulation/procedural/ai.
- **`scripts/verify-content.mjs`**: carica `balance.ts`, lo valuta con `new Function()` dopo strip delle annotazioni TS, verifica ~30 regole di range (es. `walkSpeed < sprintSpeed`, soglie oscurità crescenti, `crouchSpeed < walkSpeed`, `fovMin < fovMax`).
- **`scripts/export-diagnostics.mjs`**: conta file/righe per layer, legge le dipendenze da `package.json`, esegue `npx tsc --noEmit` catturando i primi 50 errori — utile come primo comando da lanciare quando si riprende il progetto.
- **`scripts/benchmark-generation.mjs`** e **`benchmark-replay.mjs`**: **hanno ancora placeholder** (`generateFloor()` fittizio nel primo, simulazione fittizia nel secondo) — non misurano il codice reale. Da collegare rispettivamente a `procedural/FloorGenerator.generateFloor` e a un vero step-loop di `Simulation`. Target dichiarato: <200ms per floor al p95.

---

## 12. Persistenza (`src/progression/SaveManager.ts`)

IndexedDB via `idb`, database `la-piramide-perduta`, due object store: `profile` (keyPath `id`) e `runs` (keyPath `id`, mai popolato da codice esistente). Schema validato con Zod (`SaveSchema`): `schemaVersion`, `contentVersion`, `createdAt/updatedAt`, `checksum` (hash a 32 bit naive, non crittografico — sufficiente per rilevare corruzione accidentale, non manomissione intenzionale), payload con `fragments`, `pyramidsUnlocked`, `bestiaryEntries[]`, `discoveredGrafts[]`, `kaNodes[]`, `claimedTreasureSiteIds[]`, `settings{}`.

API: `load()` (ritorna default se non esiste nulla), `save()` (valida prima di scrivere, ricalcola checksum e `updatedAt`), `exportJson()`/`importJson()` (per backup manuale utente), `exists()`, `dispose()` (chiude la connessione DB).

**Mai istanziato da `GameApplication`** — nessun salvataggio reale avviene nel gioco attuale.

---

## 13. Audio (`src/audio/WebAudioEngine.ts`) — reale (Kenney CC0) + sintetico + musica adattiva

Web Audio API completa: bus routing a 5 canali (`master → sfx/music/ambience/ui`), pooling con limite 32 istanze simultanee, panning HRTF 3D (`PannerNode`, modello `inverse`, `refDistance=1`, `maxDistance=30`), listener position/orientation, fade out su stop, gain ramping lineare per bus.

`GameApplication` istanzia ora davvero `createAudioEngine()`, richiama `unlock()` al dismiss del tutorial / primo click utile (e dopo l'unlock carica gli asset reali con `loadAssets()`), sincronizza listener position/orientation con player e camera, e mappa i `DomainEvent` runtime a cue tramite `AudioEventDirector`.

**Stato asset (aggiornato 2026-08-16)**: 17 sample reali Kenney CC0 in `public/audio/` (footstep×4, hit×3, crit×3, parry metal×3, click×2, confirmation×2) mappati via `src/audio/AudioAssetLibrary.ts` — `play()` usa la variante reale quando disponibile e ripiega sul profilo procedurale (`ProceduralCueLibrary`, 13 cue) altrimenti. In più: drone ambientale procedurale (`AmbiencePreset`, pilotato dall'oscurità) e musica adattiva a 3 stati (`MusicPreset`, crossfade 1.5s, stato derivato dai nemici). Restano opzionali (Priorità B): foley Sonniss/freesound, loop ambience reali, voce.

---

## 14. Convenzioni di codice osservate ovunque

- **Header JSDoc su ogni file**: `Scopo` (perché esiste), `Ownership` (chi lo crea/possiede), `Invarianti` (cosa deve restare vero), `Failure mode` (cosa succede se qualcosa va storto). Rispettare questa convenzione per ogni nuovo file.
- **Lingua**: commenti e nomi di dominio in italiano (es. `Scopo`, `Invarianti`, nomi nemici/oggetti), identificatori di codice in inglese.
- **Nessun valore magico**: ogni numero di bilanciamento vive in `content/balance.ts`, mai hardcoded in un sistema (eccezione nota: `ThreeRendererService.ts` ha valori hardcoded per la scena di test — accettabile perché è codice usa-e-getta in attesa della geometria procedurale reale).
- **Tutte le durate di simulazione in tick interi**, mai in millisecondi o secondi float dentro la logica di gameplay — la conversione avviene ai bordi (`secondsToTicks`, definito una volta in `balance.ts`).
- **Funzioni pure ove possibile**: la maggior parte dei moduli gameplay espone funzioni che prendono uno stato e un comando e restituiscono un nuovo stato + effetti, senza mutazione nascosta (eccezioni dichiarate: `Director`, `MummySystem`, `ScarabSystem`, `KaEchoSystem` mutano l'oggetto stato passato per riferimento invece di restituirne uno nuovo — incoerenza di stile da notare, non bug).
- **Result<T,E> per operazioni fallibili** in punti architetturalmente critici (validazione piano), non ovunque — il resto del codice usa `null`/`boolean`/`{changed: false}` come segnali di fallimento locale.

---

## 15. Elenco gap noti, in ordine di impatto

> **Aggiornamento (2026-08-16)**: i gap 1-6 sotto sono tutti RISOLTI (vedi `PIANO_COLMATURA_GAP.md` e `roadmap.md` §3 per il registro). La numerazione è mantenuta storicamente; il riferimento vivo è la checklist §9 di `PIANO_COLMATURA_GAP.md` e le Priorità A/B/C di `PIANO_COMPLETAMENTO.mpd`.

1. ~~Nessun collegamento fra simulazione/fisica e il loop di gioco reale~~ — **RISOLTO (G-01)**: `PhysicsWorld` + `PlayerCharacterController` istanziati in `GameApplication.init()`, sistemi sullo scheduler, camera = posa autoritativa.
2. ~~`FloorGenerator` mai usato per la scena reale~~ — **RISOLTO (G-02)**: `GenerationClient.request()` all'avvio, `ThreeDungeonLayout.buildDungeonLayout()` costruisce stanze/corridoi/collider dal `FloorModel`.
3. ~~Nessun nemico in scena~~ — **RISOLTO (G-03/G-13)**: `EnemySpawnDirector` + `GenericEncounterRuntime` materializzano TUTTI gli archetipi con hurtbox, hit-once e parry.
4. ~~Asset audio assenti~~ — **RISOLTO (G-06/G-19)**: 17 OGG Kenney + 13 cue sintetici + drone ambience + musica adattiva.
5. ~~Persistenza mai collegata~~ — **RISOLTO (G-05)**: `SaveManager`/`KaProgression` attivi (Frammenti, bestiario, graft, settings runtime, oro→Frammenti).
6. ~~Impostazioni di accessibilità senza effetto~~ — **RISOLTO (G-07)**: 11/14 con effetto reale (resta `torchToggle`, decisione in A-02).
7. **Benchmark script con placeholder** — `benchmark-generation.mjs` e `benchmark-replay.mjs` non misurano codice reale.
8. **Nessuna pipeline CI** — `.github/workflows/` non esiste; la progressione 100→1k→10k→100k run di fast-check dichiarata nei commenti non è automatizzata.
9. **`EntityId` (e altri branded type) ridichiarati localmente in più file** invece di importati da un'unica fonte — debito tecnico minore ma da sistemare prima che cresca.
10. **Copertura di test parziale**: mancano test per AI pura (percezione, decisione, pathfinding, swarm — facilmente testabile, alto valore), `UpgradeSystem`, `BrazierSystem`, `KaProgression`, e qualunque test che tocchi DOM/IndexedDB/Rapier/Three (richiede setup ambiente aggiuntivo).
11. **Nessun documento di design versionato nel repository** — la "Master Bible v4" citata nei commenti (sezioni `§N`, ADR, MIG) non è nel repo; questo file la ricostruisce parzialmente dal codice ma non sostituisce l'originale se esiste altrove.
12. **Conflitto di binding**: Salto e Schivata condividono entrambi `Space` in `ActionMap.ts` — verificare se intenzionale (context-sensitive: salto se in aria/terra, schivata se... quale condizione?) o refuso.
13. **`GameApplication` conserva ancora logica runtime manuale che andrebbe estratta in sistemi dedicati** — gli HP leggono già `HealthStore`, l'oscurità usa ora uno stato event-driven minimo, ma spawn nemici, hurtbox e parte dei consumer eventi sono ancora orchestrati direttamente dall'applicazione.

---

## 16. Roadmap consigliata per chi riprende il progetto

Ordine suggerito, dal più bloccante al meno. **Aggiornata**: i passi 1-3 originali sono stati eseguiti; il documento vivo per lo stato dettagliato è `PIANO_COLMATURA_GAP.md` (sezione "Registro di implementazione" in cima).

1. ~~Leggere questo documento, lanciare `export-diagnostics.mjs`~~ — fatto, vedi sopra.
2. ~~Eseguire `npm run verify`~~ — fatto; nota: `npm run verify` include anche `npm run lint` sull'intero progetto, che in ambienti con vincoli di tempo simili a questa sessione (limite ~45s per comando) può non completare — vedi §11.2 per come è stato aggirato (lint mirato sui file toccati).
3. ~~**Collegare fisica e player**~~ — **FATTO (G-01)**: `PhysicsWorld` + `PlayerCharacterController` istanziati in `GameApplication.init()`, `PlayerSystem`/`PhysicsSystem` registrati sullo scheduler, collisione ad-hoc `Box3` rimossa da `ThreeRendererService`.
4. **→ Prossimo passo: Collegare la generazione procedurale (G-02)**: chiamare `GenerationClient.request()` all'avvio, tradurre `FloorModel` in geometria Three.js + collider Rapier (nuovo modulo, es. `src/rendering/FloorMeshBuilder.ts`). Dettagli completi in `PIANO_COLMATURA_GAP.md` §1 G-02, incluso l'avviso sugli stub morti `RoomRoleAssigner.ts`/`TreasurePlacer.ts` da ripulire nella stessa passata.
5. **Collegare il combattimento** (G-03): spawn di hurtbox/hitbox reali, collegare `CombatSystem`/`HitRegistry`/`DamageResolver` al player e a un primo nemico (consigliato: SCARAB, il più semplice).
6. **Spawnare nemici via Director** (G-03): loop che consuma `Director.canSpawn/commitSpawn`, crea entità ECS, istanzia i runtime nemico esistenti.
7. Scrivere test per la logica AI pura (percezione, decisione, pathfinding) prima di collegarla — è il modo più economico per validare il comportamento prima dell'integrazione visiva.
8. Sostituire `generateSilence()` in `WebAudioEngine` con asset audio reali (anche placeholder minimi) e collegare i cue già dichiarati in `AttackDef.audioCue`/`WeaponDefinition.attacks[].audioCue` (G-06).
9. Collegare `SaveManager` al ciclo di vita (salvataggio a fine piano/morte, caricamento all'avvio) (G-05).
10. Collegare le impostazioni di accessibilità a effetti reali (a partire da quelle più semplici: `textScale` sull'HUD, `disableMotionBlur`/`reduceCameraShake` sul renderer) (G-07).
11. Aggiungere una pipeline CI minima (GitHub Actions) che esegua `npm run verify` a ogni push/PR, con run count crescente per fast-check come dichiarato nei commenti (G-21).
12. Scrivere test di integrazione (Playwright) per i flussi critici: avvio, movimento, primo combattimento, morte/retry (G-22).

Per il piano gap-per-gap completo (grafica, audio, design/UX, librerie, playbook AI, skill richieste), vedere `PIANO_COLMATURA_GAP.md`.

---

*Documento aggiornato incrementalmente ad ogni gap chiuso — vedi `PIANO_COLMATURA_GAP.md` per il registro di implementazione dettagliato.*
