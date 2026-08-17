# La Piramide Perduta — Piano di Colmatura Gap Completo

> Documento operativo, complementare a `RESOCONTO_PROGETTO.md`. Dove quel file **descrive** lo stato del progetto, questo file **prescrive** cosa costruire per completarlo: gap di codice, grafica, audio, design/UX, librerie mancanti, e un playbook per un'AI locale senza contesto pregresso.
>
> Leggere prima `RESOCONTO_PROGETTO.md` (architettura, stack, cosa esiste). Questo documento presume quella lettura e non ripete le spiegazioni architetturali di base.
>
> **Questo documento è la roadmap viva del progetto**: viene aggiornato ad ogni gap chiuso (checklist §9, stato per-gap nelle sezioni 1–5, registro sotto). Chi riprende il lavoro deve controllare prima il Registro di Implementazione per sapere cosa è stato fatto realmente rispetto a quanto pianificato.

---

## Registro di implementazione

| Data | Gap | Esito | Note |
|---|---|---|---|
| 2026-08-13 | G-12→G-19 — Ricerca risorse professionali | ✅ **Deliverable** | Nuovo `docs/RISORSE_PROFESSIONALI.md`: guida operativa verificata online (tutti gli URL rispondono 200) con risorse **gratuite/royalty-free** per ogni gap asset: kit modulare CC0 **Quaternius Ultimate Modular Ruins** (ambiente), registry **ToxSam/open-source-3D-assets** (991+ GLB CC0 incl. Egyptian temples, JSON API-friendly per il manifest G-17), **Mixamo** (animazioni), **ambientCG/Poly Haven** (texture PBR sabbia/pietra, HDRI), **OpenGameArt ancient-egypt-0** (geroglifici/papiro/rosetta CC0), **Kenney Audio + Sonniss GDC + freesound** (SFX), **Cinzel + Noto Sans Egyptian Hieroglyphs** (font OFL, self-host via fontsource), **gltf-transform** (ottimizzazione Draco in CI), **pmndrs/postprocessing** (bloom/vignette), tecniche TSL per dissolve/burn/particelle. Il documento include il piano di integrazione in 6 passi con l'ordine consigliato. Nessun costo: tutto CC0/OFL o gratuito. |
| 2026-08-13 | G-21 — Pipeline CI | ✅ **Pronta (deliverable)** | Nuovo `.github/workflows/verify.yml`: job `verify` (ubuntu, Node 22, `npm ci`, gate completo `npm run verify`, property test a 10.000 run via `PROPERTY_RUNS`) + job `e2e` (Playwright chromium). Parametrizzazione run property test: `combat-properties.test.ts` ora legge `PROPERTY_RUNS` dall'ambiente (default 100) come già faceva `floor-invariants.test.ts`. Nota: il repo non è ancora un repository git — il workflow è pronto per il primo push su GitHub. Verificato: `PROPERTY_RUNS=2000` esegue 16/16 property test. |
| 2026-08-13 | G-23 — Placeholder semantici | ✅ **Completato (verifica)** | Verificato sul codice: `ThreeDungeonLayout.addLandmark()` usa già `resolveLandmarkPlaceholder()` con 9 famiglie geometriche distinte (altar, brazier, glyph, obelisk, portal, sarcophagus, statue, well, relic), palette per ruolo, materiali emissivi, sfere di accento luminoso per braciere/portale/glifo e piedistallo. Uscita = portale con sfera accesa, tesoro = sarcofago, mappa = glifo: leggibilità semantica senza testo. Nessun codice aggiuntivo necessario. |
| 2026-08-13 | G-05 — Persistenza: nodi Ka residui cablati | 🟡 **Parziale (avanzato)** | Tutti gli 8 nodi Ka hanno ora effetto runtime dichiarato. Nuovi in questa sessione: **Passo di Bastet** → i-frame 0.12s durante la schivata (`DODGE_IFRAME_MS = 120`, `dodgeIFramesUntilMs` impostata su `ActionKind.Dodge` in `processInput`, check in `applyDamageToPlayer` che annulla il danno con messaggio HUD "Schivata perfetta"); **Occhio del Ladro** → `RendererHandle.setDangerTell()` accende una pulsazione emissiva rossa sul marker del sito di scavo (attivato da `syncProgressionRuntimeBonuses`); **Sangue di Ra** → flag `canDeposeCurse` in `RuntimeBonuses` con descrizione overlay aggiornata (consumo reale arriverà col sistema maledizioni). `RuntimeBonuses` esteso con `hasDodgeIFrames`/`hasLootDangerTell`/`canDeposeCurse`. Test: +1 in `RuntimeBonuses.test.ts` (flag attivi con nodi, false senza). Verificato: `npm run verify` ✓. Restano: effetti meccanici dei graft equipaggiabili, meta-loop multi-floor completo. |
| 2026-08-13 | G-20 — Ambiente di test DOM | ✅ **Completato** | Aggiunto `happy-dom@^20.11.2` come devDependency e nuovo progetto Vitest separato `vitest.config.dom.ts` (environment `happy-dom`, include `tests/dom/**`, alias `@` condiviso) con script `npm run test:dom`; integrato nel gate `npm run verify`. Primo test suite DOM: `tests/dom/MainMenu.test.ts` (8 test: visibilità show/hide, Frammenti profilo, profilo assente, bestiario, callback INIZIA/Impostazioni/Progressione, textScale via applyPresentation, dispose). Verificato: `npm run test:dom` 8/8 ✓, `npm run verify` ✓. |
| 2026-08-13 | G-22 — Test e2e | 🟡 **Parziale (avanzato)** | 8/8 Playwright verdi. Aggiornati i flussi al nuovo avvio con menu principale (G-09): `startPlayableSession` ora passa da `#main-menu` → "INIZIA LA DISCESA" → tutorial → pointer lock; il test del tutorial è stato riscritto come test del menu (progressione mostrata, impostazioni apribili senza far partire il loop, tutorial nascosto finché non si inizia la discesa); il test di persistenza settings ora verifica la palette anche dopo il reload col menu visibile. Nuovo test: "la progressione del profilo alimenta il menu principale" (pre-popolamento IndexedDB con 12 Frammenti + 1 bestiario → verifica `Frammenti di Ka: 12` e `Bestiario: 1 voci` nel menu). Restano scoperti: completamento run end-to-end, variazione/ripetibilità seed, braciere/digSite/combattimento reale. Verificato: `npm run test:e2e` 8/8 ✓. |
| 2026-08-13 | G-03 — Combattimento reale: spawn dinamico | 🟡 **Parziale (avanzato)** | Nuovo `src/simulation/EnemySpawnDirector.ts`: orchestratore runtime che possiede UN `DirectorState` per piano (creato dal seed del floor) e consuma il budget progressivamente con `planNext()` — spawn iniziale + follow-up alla morte di ogni nemico, con scelta deterministica dell'archetipo via `hash32(seed, floorIndex, spawnCount)` e `tick()` per il grace period post-wipe. `GameApplication` ora lo istanzia in init (al posto del planner usa-e-getta), chiama `planNext()` per l'incontro iniziale e, alla morte dello scarabeo nel loop, pianifica il follow-up finché il budget lo consente (materializza SCARAB; gli altri archetipi loggati per l'EnemySpawnSystem completo). Restano aperti: `HurtboxSystem` generale (oggi il wiring è in GameApplication), archetipi non-SCARAB materializzabili e unificazione totale del backbone danno nemico→player (già parzialmente unificata via `applyDamageToPlayer`). Nuovo test file: `tests/simulation/EnemySpawnDirector.test.ts` (7 test: budget consumato, stop a budget zero, determinismo sequenza, fascia piani, esclusione entry/target). Verificato: `npm run verify` ✓. |
| 2026-08-13 | G-08 — Debito tecnico | ✅ **Completato** | Branded type centralizzati: `Ticks` spostato in `src/procedural/Ids.ts` (con factory `ticks()`) e importato da `Director` (era ridichiarato localmente); `EntityId` già centralizzato in `EntityAllocator.ts`, `RoomId` in `Ids.ts`. Gli stub morti `RoomRoleAssigner`/`TreasurePlacer`/`RoomGraph` erano già stati rimossi nelle sessioni precedenti (verificato: non esistono più in `src/procedural/` e nessun import residuo). Restano documentati: `Jump`/`Dodge` condividono `Space` in `ActionMap` (decisione di design: salto context-sensitive, schivata con effetto gameplay reale solo dopo `Passo di Bastet`), `playerHp` morto già rimosso. Verificato: `npm run verify` ✓. |
| 2026-08-13 | G-07 — Impostazioni di accessibilità con effetto reale | 🟡 **Parziale** | Nuovi effetti cablati: `amplifiedTelegraphs` ora amplifica scala/emissive dei telegrafi d'attacco nel renderer (gain 1.9× su `telegraphStrength` in `setEnemyStates`); nuovo camera-shake decadente nel renderer (`addCameraShake` su `RendererHandle`, offset visivo post-`setCameraPose`, ~0.5s di vita) alimentato dal danno subito al player in `applyDamageToPlayer` e attenuato da `reduceCameraShake` (×0.35); `disableMotionBlur` dichiarato nell'interfaccia di presentazione per il futuro post-processing (nessun motion blur attivo oggi). Restano: `torchToggle` ridondante per design (F è già toggle nativo — decisione: mantenere come flag inerte documentato), `sprintToggle`/`textScale`/`showDarknessBar`/`assistedLight`/`reduceTorchFlicker`/`colorBlindMode`/`soundIndicator`/`highContrast` già attivi in sessioni precedenti. Verificato: `npm run verify` ✓ (236 test). |
| 2026-08-13 | G-11 — Curva di difficoltà/onboarding | ✅ **Completato (dati + planner)** | Nuovo `src/content/enemyTemplates.ts`: 7 `EnemyTemplate` reali per gli archetipi combattibili (SCARAB 2, MUMMY 4, COBRA 3 piano 2+, SHABTI 8 e PRIEST 7 piano 3+, SOBEK_SPAWN 12 e ROYAL_MUMMY 16 piano 4+), con flag telegrafo e fasce piano allineate alla tabella §8.5; `validateEnemyTemplates()` come invariante; WITNESS escluso (non attaccabile). Il tipo `EnemyTemplate` ora vive in content (dati immutabili) e viene ri-esportato da `Director` per compatibilità — dipendenza invertita (content non importa più simulation). `InitialEncounterPlanner` generalizzato: `planInitialEncounter()` sceglie deterministicamente l'archetipo via `hash32(seed, floorIndex, salt)` tra i template del piano, mantiene `planInitialScarabSpawn()` come alias back-compat; `GameApplication` materializza solo SCARAB (runtime ECS esistente) e logga gli altri archetipi come riservati a G-03. Test: 10 in `InitialEncounterPlanner.test.ts` (determinismo, fascia piani, esclusione entry/target, tier progressione, WITNESS mai spawnabile). Verificato: `npm run verify` ✓. | |
| 2026-08-13 | G-09 — Menu principale | ✅ **Completato** | Nuovo `src/ui/MainMenu.ts` (DOM puro, palette coerente, z-index 85 sotto settings/progressione/death); nuova reason `'menu'` in `PauseReasons`; `GameApplication.init()` termina mostrando il menu e mettendo il loop in pausa (`localPause('menu')`); `onStartRun` → hide + resume + tutorial + pointer lock; `onOpenSettings`/`onOpenProgression` riaprono gli overlay esistenti (che tornano al menu alla chiusura perché la reason `menu` resta attiva). Il tutorial non appare più all'avvio ma dopo il click su "INIZIA LA DISCESA". Verificato: `npm run verify` ✓ (230 test), flusso browser completo menu → tutorial → gioco con pointer lock, zero errori console. |
| 2026-08-13 | G-10 — Bilanciamento economico | ✅ **Completato** | Nuovo `src/content/economy.ts`: `GOLD_DROP_RANGES` per tier (1: 5-15, 2: 15-40, 3: 50-100), `rollGoldDrop()` deterministico (tier normalizzato, sconosciuti → 1), `convertGoldToFragments()` (20%, cap 15/run, §11.1), `FLOOR_COMPLETE_FRAGMENT_REWARD = 5`. `SaveData.payload.completedFloorIds[]` (default `[]`, retrocompatibile). `RunProgression`: FLOOR_COMPLETE garantito una sola volta per floorId + `convertRunGoldToFragments()`. `RuntimeGameplayState.goldCoins` + applicazione `ENEMY_DIED` con `goldDropped`. `GameApplication`: `rollEnemyGoldDrop(tier, entityId)` via `hash32(floorSeed, entityId)` (nessun `Math.random` — replay-safe), drop su mummia e scarabeo, messaggi HUD oro, conversione oro→Frammenti alla morte prima dell'overlay, oro nella riga piano dell'HUD. Nuovi test: `tests/content/economy.test.ts` (9), +5 in `RunProgression.test.ts`, +2 in `RuntimeGameplayState.test.ts`. Verificato: `npm run verify` ✓ (230/230). |
| Sessione corrente | G-01 — Fisica e player controller reali | ✅ **Completato** | `PhysicsWorld` + `PlayerCharacterController` collegati a `GameApplication`; `PlayerSystem`/`PhysicsSystem` registrati sullo scheduler; `ThreeRendererService` non calcola più movimento/collisioni (rimossi `Box3`/`updateMovement`/`collidesWithAny`), ora accetta `RAPIER.World` e crea collider statici reali per muri/colonne/sarcofago/porta (porta = rigid body kinematic). `RendererService.updateMovement()` → `setCameraPose()`. Corretti anche errori di typecheck/lint preesistenti mai controllati prima (`tsconfig.json` baseUrl deprecato, 9 unused-var/import, 6 errori ESLint type-checked in file toccati). Verificato: `typecheck` ✓, `lint` (sui file toccati) ✓, `verify:boundaries` ✓, `verify:content` ✓, `vitest run` 126/126 ✓, `vite build` ✓ (build in dir alternativa per bypassare un problema di permessi del mount sandbox su `dist/`, non correlato al codice). Dettagli e limiti noti in §1 G-01 qui sotto. |
| 2026-08-13 | G-02 — Layout procedurale e vertical slice runtime | ✅ **Completato** | `GameApplication.generateFloorWithFallback()` usa davvero `GenerationClient.request()` con fallback main-thread; `VerticalSliceRuntime.createVerticalSliceState()` traduce il `FloorModel` in `sceneLayout`; `ThreeRendererService.setFloorLayout()` + `ThreeDungeonLayout.buildDungeonLayout()` costruiscono stanze/corridoi/collider a runtime; spawn player su `entrySpawn`, target guardiana e uscita sul layout generato. Verificato: `typecheck` ✓, `vitest run` 152/152 ✓, `playwright test` 5/5 ✓. I residui emersi dall'analisi del design sono stati spostati nei gap G-04, G-07 e G-23. |
| 2026-08-13 | G-03 — Hit detection e danno reali sul vertical slice | 🟡 **Parziale** | Il combattimento del giocatore non usa più solo `applyAttackToSlice(...)`: `AttackHitResolver` valuta shape contro `HurtboxStore`, `HitRegistry` impedisce doppi colpi nello stesso swing ACTIVE, `DamageResolver` calcola il danno finale, `GameApplication` legge/scrive gli HP del player via `HealthStore`, e il runtime include ora anche uno `ScarabEncounterRuntime` reale con entità ECS, hurtbox propria e renderer multi-nemico (`setEnemyStates(...)`). Lo spawn iniziale dello scarabeo non è più hardcoded puro: passa da un planner che usa davvero `Director.createDirectorState()` + `canSpawn()`/`commitSpawn()` per scegliere una stanza valida del layout procedurale. Verificato: `npm run verify` ✓, `vitest run` ✓. Restano aperti `HurtboxSystem` generale, spawn dinamico continuativo dal `Director` e unificazione completa del danno nemico→player. |
| 2026-08-13 | G-04 — Dorsale eventi per torcia, bracieri e scavo | 🟡 **Parziale** | `GameplayEventBridge` traduce ora effetti torcia (`NOISE`, `LIGHT_PULSE`, `KA_ECHO_PULSE`, `FUEL_LOW`, `FUEL_EMPTY`), accensioni braciere e progresso/completamento scavo in `DomainEvent`; `GameApplication` drena e consuma questi eventi frame-by-frame, li inoltra a feedback HUD/audio tramite `AudioEventDirector`, e lascia il rumore disponibile ai consumer AI/runtime. Verificato: `npm run verify` ✓, `npm run test:e2e` 7/7 ✓, `vitest run` 216/216 ✓. Restano aperti i consumer AI generalizzati oltre il wiring attuale e le ricompense/meccaniche più profonde collegate allo scavo. |
| 2026-08-13 | G-05 — Persistenza runtime di progressione minima | 🟡 **Parziale** | `SaveManager` conserva ora anche `claimedTreasureSiteIds`; `RunProgression` assegna Frammenti al primo `TREASURE_FOUND` senza doppioni, sblocca progressivamente gli innesti del vertical slice in `discoveredGrafts`, e sblocca la prima entry del bestiario su `ENEMY_DIED`; `GameApplication` persiste su `TREASURE_FOUND`, `ENEMY_DIED`, `PLAYER_DIED`, `FLOOR_COMPLETE` e sugli acquisti Ka. L'HUD espone Frammenti + notifiche di sblocco, mentre l'overlay `TAB` mostra mappa testuale, bestiario arricchito, graft e albero Ka con acquisto diretto. I nodi `Respiro Lungo`, `Ka Robusto`, `Mano Ferma`, `Memoria di Thoth` e `Patto di Anubi` modificano ora davvero la run corrente (capacita torcia, HP massimi, sblocco bastone iniziale, stanza mappa forzata nella prima meta del piano, resurrezione 1x run). La morte ha anche una schermata runtime reale con retry abilitato dopo la sincronizzazione del profilo. Verificato: `npm run verify` ✓, `vitest run` ✓. Restano aperti effetti meccanici dei graft, meta-loop multi-floor e gli altri nodi Ka non ancora tradotti in effetti runtime. |
| 2026-08-13 | G-06 — Wiring audio runtime e indicatori accessibili | 🟡 **Parziale** | `GameApplication` istanzia ora `createAudioEngine()`, lo sblocca al primo dismiss/click, sincronizza listener posizione/orientamento con camera/player e converte `DomainEvent` in cue sintetici tramite `AudioEventDirector`; `WebAudioEngine` non genera più silenzio ma cue procedurali udibili, e l'HUD può mostrare `soundIndicator` testuali per i suoni critici. Verificato: `npm run verify` ✓, `npm run test:e2e` 7/7 ✓, nuove suite Vitest per `TorchSystem`, `GameplayEventBridge`, `AudioEventDirector`, `ProceduralCueLibrary`. Restano aperti la copertura dei cue arma/combat completi e una libreria asset/sample finale. |
| 2026-08-16 | **Batch chiusura gap reali (analisi "hai davvero codato tutto?")** | ✅ **10/10 risolti o registrati** | (1) **Parry system**: `ParryResolver.ts` (finestra 350ms, arco 100°, i-frame, stordimento 48 tick) + FSM STAGGERED in Generic/Mummy runtime + wiring GameApplication — 11 test nuovi. (2) **Tutorial graduale**: `showContextualHint` (una volta per id, coda, fade) + 12 hint contestuali — 4 test DOM. (3) **G-19 musica adattiva**: `MusicPreset.ts` 3 stati + `setMusicState` crossfade 1.5s + stato derivato dai nemici — 5 test. (4) **Viewmodel arma 3D**: khopesh procedurale + swing/parata — 5 test DOM. (5) **HDRI/env map**: PMREMGenerator + scena ambiente Egyptian Noir (WebGL2). (6) **Texture PBR**: Ground054/Rock064 color+normal+roughness+AO (uv2 per aoMap) — 1.6MB. (7) **Kenney SFX**: 17 OGG + `AudioAssetLibrary` + `loadAssets()` + branch buffer in play(). (8) **gltf-transform**: 12/12 GLB meshopt (-1MB, PWA 15.9→8.8MB) + MeshoptDecoder registrato ⚠️. (9) **InstancedMesh decor**: 1 draw call per tipo. (10) **Bloom WebGPU**: RenderPipeline + BloomNode TSL, verificato in browser. **Worker simulation**: valutata e RINVIATA con decisione registrata (vedi roadmap §3). Gate: verify verde, 11/11 e2e, browser zero errori. |

---

## 0. Come usare questo documento

Sezioni 1–5: gap concreti, per categoria, ognuno con **cosa manca**, **perché**, **come colmarlo**, **criterio di completamento verificabile**.
Sezione 6: librerie da aggiungere, con motivazione e alternative.
Sezione 7: playbook passo-passo per un'AI locale che riprende il progetto senza aver letto le conversazioni precedenti.
Sezione 8: competenze/skill richieste per completare il progetto (umane e/o AI).
Sezione 9: checklist finale.

Ogni gap è numerato (`G-01`, `G-02`, ...) per essere referenziabile in commit e task tracker.

---

## 1. Gap di codice — collegare ciò che esiste

Questa è la categoria più urgente: **il codice per fisica, combattimento, IA, generazione procedurale, salvataggio e audio esiste, è testato, ma non gira mai nel gioco reale** (vedi `RESOCONTO_PROGETTO.md` §6). Qui sotto il piano di wiring concreto, in ordine di dipendenza.

### G-01 — Collegare fisica e player controller reali — ✅ COMPLETATO

**Stato**: implementato e verificato. `GameApplication.init()` crea `physicsWorld = await createPhysicsWorld()` prima del renderer, istanzia `PlayerCharacterController` su un'entità ECS dedicata, registra `PlayerSystem` (fase `input`) e `PhysicsSystem` (fase `physics`) sullo scheduler. `ThreeRendererService` riceve `physicsWorld.raw` e costruisce collider Rapier reali (fixed body + `createStaticBoxCollider`) allineati a muri/colonne/sarcofago della scena di test; la porta è un rigid body kinematic mosso da `interactDoor()`. Il mouse-look (yaw/pitch) è accumulato una volta per frame di rendering in `GameApplication` (non per tick fisso) e passato come input al controller; la camera riflette la posa calcolata dalla fisica via il nuovo metodo `RendererHandle.setCameraPose(x,y,z,yaw,pitch)`, che sostituisce il vecchio `updateMovement()`.

**Limiti noti residui** (da tenere presente per G-02 e oltre):
- I collider delle colonne sono box che approssimano i cilindri visivi (stessa semplificazione già presente nella versione Box3 precedente) — accettabile per la scena di test, da rifare con collider più precisi (o comunque box, se sufficiente) quando arriverà la geometria procedurale reale (G-02).
- Sprint/crouch/salto sono ora meccanicamente reali (governati da `PlayerCharacterController`, che li implementava già) ma non hanno ancora feedback visivo/HUD dedicato (es. FOV kick per lo sprint, abbassamento camera per il crouch oltre al mero offset d'altezza).
- `EYE_HEIGHT_OFFSET_M` è una costante fissa; con il crouch che cambia `currentHeight` della capsula, l'occhio della camera non si abbassa ancora in proporzione — micro-gap cosmetico da rifinire, non bloccante.
- Il player controller non ha ancora una hurtbox/hitbox associata (arriverà con G-03).

**Cosa mancava (per riferimento storico)**: `GameApplication.ts` non istanziava mai `PhysicsWorld` né `PlayerCharacterController`; il movimento nel browser passava da `ThreeRendererService.updateMovement()`, che testava collisioni con `THREE.Box3` invece di Rapier.

**Come colmarlo**:
1. In `GameApplication.init()`, dopo l'init del renderer, chiamare `await createPhysicsWorld()` (già pronta in `src/physics/PhysicsWorld.ts`).
2. Creare il player: `new PlayerCharacterController(physicsWorld.raw, startX, startY, startZ)`.
3. Creare `world.createEntity()` per il player, salvare l'`EntityId` risultante.
4. Costruire un `InputSource` (interfaccia già definita in `simulation/systems/PlayerSystem.ts`) che legge da `input.frame` e produce un `PlayerInput` (mappare `ActionKind.MoveForward/Backward/Left/Right` su `moveX/moveZ`, `Jump`→`jump`, `Sprint`→`sprint`, `Crouch`→`crouch`, yaw/pitch dalla camera).
5. `simulation.scheduler.register(createPlayerSystem({ world, controller, playerEntityId, inputSource }))`.
6. `simulation.scheduler.register(createPhysicsSystem(physicsWorld))`.
7. Nel loop di render, leggere `controller.getState().position` invece di muovere la camera con la logica ad-hoc; rimuovere `_colliders`/`collidesWithAny`/`_testPos` da `ThreeRendererService.ts`.
8. Creare i collider statici per pavimento/muri/colonne con `ColliderFactory.createStaticBoxCollider`/`createStaticTrimeshCollider` invece delle mesh Three "decorative senza fisica" attuali.

**Criterio di completamento** (soddisfatto): il giocatore si muove nel browser tramite Rapier; sprint e crouch hanno effetto visibile sulla velocità/altezza; `PlayerSystem`/`PhysicsSystem` sono registrati sullo scheduler (verificabile leggendo `GameApplication.init()`).

### G-02 — Sostituire la scena di test con la generazione procedurale reale — ✅ COMPLETATO

**Stato**: implementato e verificato. `GameApplication` genera davvero il floor all'avvio (worker con fallback main-thread), lo trasforma in `VerticalSliceState` e passa `sceneLayout` al renderer; `ThreeDungeonLayout` costruisce stanze, corridoi, muri e collider a partire dal `FloorModel`; player, target e uscita nascono in posizioni derivate dal layout generato, non più da coordinate hardcoded di una stanza fissa.

**Limiti noti residui** (emersi leggendo il design reale del progetto):
- I landmark sono ancora **placeholder non semantici**: `ThreeDungeonLayout.addLandmark()` usa hash del `landmarkId` per scegliere fra 3 primitive e un colore HSL, quindi `braciere-eterno`, `statua-anubi` e altri landmark restano difficili da distinguere a colpo d'occhio. Questo è ora tracciato esplicitamente in **G-23**.
- La guardiana, il beacon di uscita e la porta sono ancora primitive generiche (`CapsuleGeometry`, `BoxGeometry`) sufficienti per il wiring ma non per la leggibilità finale del vertical slice.
- Il layout viene generato una sola volta al bootstrap: manca ancora il round-trip completo di fine piano → transizione → nuovo piano/persistenza (G-05/G-09).

**Come colmarlo**:
1. Creare un nuovo modulo `src/rendering/FloorMeshBuilder.ts` (layer `rendering`, può importare `three` e il `FloorModel` da `procedural`) che:
   - riceve un `FloorModel` (rooms con `bounds`, `doors`, `role`, `landmarkId`);
   - per ogni `RoomNode` genera un volume (pavimento + muri perimetrali, con varchi nei punti di porta verso `doors`) usando `RoomBounds` per posizione/dimensione;
   - per ogni coppia di stanze collegate crea un corridoio di raccordo;
   - ritorna sia le mesh Three.js sia i `ColliderDesc` Rapier corrispondenti (usare `createStaticTrimeshCollider` o box multipli per semplicità nella prima iterazione).
2. In `GameApplication.init()`, dopo aver creato `generationClient`, chiamare `generationClient.request({ seed, generationVersion: 1, isTutorial: true, floorIndex: 1 }, onReady, onError)`.
3. In `onReady(floor)`, passare il `FloorModel` a `FloorMeshBuilder` e sostituire la scena hardcoded.
4. Posizionare il player nello spawn della stanza `floor.entryRoomId` (calcolare il centro di `bounds`).
5. Usare `floor.rooms[].landmarkId` per selezionare quale mesh/prop decorativo istanziare per stanza (richiede asset, vedi G-10).

**Criterio di completamento**: ogni avvio con lo stesso seed produce lo stesso layout (verificabile da log/screenshot); layout diversi con seed diversi; il player spawna sempre in una stanza `ENTRY` con clearance libera; nessuna geometria hardcoded residua in `ThreeRendererService.ts`.

**Nota**: `RoomRoleAssigner.assignRoomRoles()` e `TreasurePlacer.placeTreasure()` sono **stub morti** — non fanno nulla o restituiscono valori hardcoded (`mapRoomId: 3, treasureRoomId: 4`). La logica reale di assegnazione ruoli e posizionamento tesoro vive **duplicata** dentro `FloorGenerator.ts` (funzioni interne `assignRoles`/`placeTreasure`, non esportate). Prima o durante G-02, decidere: (a) eliminare gli stub morti e i tipi `RoomGraph`/`RoomGraphNode` mai istanziati, oppure (b) refactorare `FloorGenerator` per usare davvero questi moduli invece di duplicare la logica al suo interno. Consigliata l'opzione (a): meno superficie di codice morto da mantenere.

### G-03 — Combattimento reale: hurtbox/hitbox e nemici in scena

**Aggiornamento 2026-08-13**: gap **parzialmente colmato**. Il vertical slice ora usa davvero `HurtboxStore`, `HitRegistry` e `DamageResolver` per il combattimento del giocatore: la hurtbox della guardiana viene sincronizzata dal runtime, il colpo del giocatore viene valutato geometricamente per shape (`ARC`/`LINE`/`SPHERE`/`CONE`), il danno passa dal resolver unico, gli HP del player vivono in `HealthStore`, e il runtime browser gestisce anche un secondo nemico reale (`ScarabEncounterRuntime`) con entità ECS e rappresentazione renderer simultanea.

**Residui reali**: manca ancora la parte “nemici in scena” in senso pieno:
- `HurtboxStore` non è più limitato alla sola guardiana, ma viene ancora popolato manualmente da `GameApplication` (`syncGuardianEntityState()`/`syncScarabEntityState()`), non da un `HurtboxSystem` generale.
- `CombatSystem`/`HitRegistry`/`DamageResolver` non pilotano ancora uno spawn ECS dinamico governato dal `Director`: oggi esiste la guardiana fissa e un solo scarabeo iniziale selezionato dal `Director`, non un sistema generale di archetipi (`Scarab`, `Mummy`, ecc.) o spawn continui.
- Il danno nemico→giocatore converge ora in `applyDamageToPlayer()` + `HealthStore`, ma la decisione del colpo resta nei runtime specifici (`tickVerticalSlice`, `tickScarabEncounter`) invece di passare da un backbone hitbox/hurtbox condiviso anche lato nemici.
- Gli archetipi dati esistono ancora senza wiring runtime completo: manca `EnemySpawnSystem` e mancano gruppi/sciami reali pilotati dal `Director` oltre al solo scarabeo iniziale.

**Come colmarlo** (dopo G-01 e G-02):
1. Estrarre il wiring attuale di guardiana + scarabeo in un vero `HitDetectionSystem`/`HurtboxSystem`, così il backbone non resta appeso a `GameApplication`.
2. Creare `src/simulation/systems/EnemySpawnSystem.ts`: consumare `Director.canSpawn`/`commitSpawn`, creare entità ECS e istanziare runtime `createMummy`/`createScarab` con posizionamento nel layout procedurale.
3. Collegare anche il danno nemico→giocatore allo stesso backbone shape/hurtbox, eliminando il doppio binario con `tickVerticalSlice`/`tickScarabEncounter`.
4. Espandere l'attuale scarabeo iniziale pianificato dal `Director` a spawn multipli e archetipi diversi, inclusi limiti di gruppo/sciame reali.
5. Agganciare audio/VFX/telegraph readability ai nuovi runtime multi-nemico, ora che il renderer supporta già più marker simultanei.

**Criterio di completamento**: attaccare un nemico (SCARAB, il più semplice) ne riduce gli HP fino alla morte; l'HUD mostra HP reali che cambiano quando il giocatore viene colpito; `HitRegistry` impedisce doppio danno nello stesso swing (osservabile: un fendente ad arco largo non uccide istantaneamente un gruppo con danno moltiplicato per frame).

### G-04 — Torcia, braciere, scavo, Ka Echo: collegare i comandi mancanti

**Aggiornamento 2026-08-13**: il wiring base di `Q/G/R` non è più un placeholder. `GameApplication` usa ora `TorchActions` + `TorchSystem` per `WAVE`, `PLACE_OR_PICK_UP` e `KA_ECHO`, con feedback HUD coerente, check di cooldown/carburante e stato torcia sincronizzato. In più, `FloorSceneLayout` espone davvero `braziers` e `digSite`, `GameApplication` istanzia `BrazierState`/`DigSite` dal layout procedurale, il renderer materializza torcia posata e bracieri nel mondo, e `GameplayEventBridge` converte gli effetti ambientali in `DomainEvent` consumabili dal loop runtime.

**Gap residui**:
- Gli eventi ora esistono, ma **non hanno ancora consumer dedicati completi** per audio/AI: HUD e persistenza consumano una parte del flusso, e `NOISE_PULSE` / `KA_ECHO_PULSE` pilotano ora almeno un consumer AI minimo (lo scarabeo reagisce al rumore), ma manca ancora un backbone generale per archetipi multipli e audio reale.
- Lo scavo completa il sito e genera eventi, e `TREASURE_FOUND` assegna già `fragments` persistenti più uno sblocco progressivo di `discoveredGrafts`, ma **mancano ancora** effetti meccanici dei graft, loot equipaggiabile vero e consumer audio/AI generalizzati del rumore.
- Il braciere non si ferma più alla luce locale: `DARKNESS_RELIEF` riduce ora davvero l'oscurità runtime dell'HUD, `MAP_REVEAL` traccia stanze rivelate e l'HUD disegna ora una minimappa schematica reale. **Mancano ancora** un impatto su Director/AI e la persistenza multi-floor del controllo territoriale.

**Come colmarlo**:
1. Collegare `simulation.events.flush()` a consumer runtime dedicati completi: audio (`NOISE_PULSE`, `LIGHT_PULSE`, `KA_ECHO_PULSE`) e AI/Director generalizzati oltre l'attuale reazione minima dello scarabeo.
2. Estendere la ricompensa dello scavo oltre i Frammenti già persistiti: loot, aggiornamento profilo Ka e/o bestiario.
3. Estendere l'effetto sistemico dei bracieri oltre HUD/runtime locale: Director/AI e persistenza multi-floor.
4. Valutare se mantenere `KaEchoSystem` come modulo separato o convergere definitivamente sulla macchina a stati della torcia, evitando doppio modello per gli stessi cooldown/costi.

**Criterio di completamento**: G posa/raccoglie davvero la torcia (la luce resta nel mondo quando il giocatore si allontana); R attiva il Ka Echo rispettando cooldown/costo reali (osservabile da HUD/log); esiste almeno un `DigSite` raggiungibile e completabile in game; esiste almeno un braciere accendibile che illumina l'area anche a torcia spenta.

### G-05 — Persistenza reale

**Aggiornamento 2026-08-13**: gap **parzialmente colmato**. `GameApplication` istanzia ora `SaveManager`, carica il profilo IndexedDB all'avvio, reidrata le impostazioni runtime salvate (`payload.settings.runtimeSettings`) e le risalva quando l'utente applica il `SettingsMenu`, inclusi i rebind dei controlli. Inoltre, il profilo salva ora anche `claimedTreasureSiteIds`, assegna Frammenti al primo `TREASURE_FOUND` via `RunProgression`, sblocca la prima entry del bestiario su `ENEMY_DIED`, e persiste su `TREASURE_FOUND`, `ENEMY_DIED`, `PLAYER_DIED` e `FLOOR_COMPLETE`. Verificato anche su reload browser con smoke Playwright dedicato e con `npm run verify` completo.

**Residui reali**:
- Lo stato di progressione avanzata non e piu solo persistito: `kaNodes` alimenta gia overlay runtime e bonus concreti per torcia/HP, sblocco del bastone iniziale, `Memoria di Thoth` e resurrezione `Patto di Anubi`; il bestiario ha una schermata runtime piu informativa e i tesori sbloccano davvero `discoveredGrafts`, anche se gli innesti restano solo scoperti e non ancora equipaggiabili/applicati. Restano pero senza effetto runtime gli altri nodi Ka e i graft come meccaniche attive.
- Mancano ancora i trigger di save legati agli innesti e a un vero cambio piano multi-floor.
- La UI runtime di meta-progressione esiste (`TAB`), ma e ancora una schermata testuale minima: manca un hub/fucina strutturata e una presentazione piu leggibile del bestiario.

**Come colmarlo**:
1. Estendere gli effetti runtime oltre i nodi gia cablati, cosi che `occhio-del-ladro`, `passo-di-bastet` e `sangue-di-ra` smettano di essere solo persistiti.
2. Collegare il salvataggio a un cambio piano reale e agli innesti, evitando che la persistenza resti limitata alla singola run verticale.
3. Evolvere l'overlay `TAB` da schermata testuale minima a UI meta piu leggibile, con hub/fucina/bestiario piu strutturati.
4. Decidere il formato persistente del bestiario/profili Ka (ids, livelli, duplicati) prima di estendere altre reward.

**Criterio di completamento**: chiudere e riaprire il browser preserva almeno impostazioni runtime, Frammenti e nodi Ka acquistati (verificabile via DevTools → Application → IndexedDB → `la-piramide-perduta`).

### G-06 — Audio reale

**Aggiornamento 2026-08-13**: gap **parzialmente colmato**. Il wiring minimo di sistema esiste davvero:
1. `GameApplication` istanzia `createAudioEngine()` e richiama `unlock()` al dismiss del tutorial e al primo click utile sul canvas.
2. Gli eventi runtime passano da `AudioEventDirector`, che mappa `TORCH_FUEL_LOW`, `TORCH_FUEL_EMPTY`, `LIGHT_PULSE`, `BRAZIER_LIT`, `KA_ECHO_PULSE`, `DIG_PROGRESS`, `TREASURE_FOUND`, `PLAYER_DAMAGED`, `ENEMY_DIED`, `FLOOR_COMPLETE` a cue e indicatori testuali.
3. `WebAudioEngine` genera ora cue sintetici udibili via oscillatori Web Audio invece del vecchio placeholder silenzioso, con listener 3D sincronizzato a posizione/orientamento del player.
4. L'opzione di accessibilità `soundIndicator` ha effetto reale sull'HUD e rende i suoni critici leggibili anche senza audio.

**Residui reali**:
- `AttackDefinition.audioCue` / `WeaponDefinition.attacks[].audioCue` non sono ancora cablati in modo sistematico per tutte le armi/azioni di combattimento.
- Non esiste ancora una libreria di sample/asset audio finale; il progetto usa sintesi procedurale deterministica, non asset authored.
- Mancano ancora mix/bus dedicati per classi di contenuto più ricche (musica, ambience persistente, layering per archetipi multipli).

**Criterio di completamento**: almeno un suono udibile e contestuale esiste in game per torcia/colpo/pericolo; per chiudere davvero il gap resta da coprire anche arma/combat completi e decidere se la sintesi procedurale basta o va sostituita/integrata con sample reali.

### G-07 — Impostazioni di accessibilità con effetto reale

**Aggiornamento 2026-08-13**: gap **parzialmente colmato**. Sono già osservabili senza refresh:
- `textScale`, `highContrast`, `showDarknessBar` su HUD e `SettingsMenu`;
- `assistedLight` e `reduceTorchFlicker` sul renderer.
- `colorBlindMode` su HUD, `SettingsMenu` e palette renderer.
- `sprintToggle` sull'input runtime del player (press-once-to-toggle reale).
- `soundIndicator` su HUD come feedback testuale dei suoni runtime critici.

**Residui reali**:
- `torchToggle` resta ridondante a livello di design: il controllo base `F` e gia un one-shot `Torcia ON/OFF`, quindi il setting non puo cambiare la semantica senza ridefinire il modello di input della torcia.
- `amplifiedTelegraphs` non modifica ancora la presentazione degli attacchi nemici.
- `disableMotionBlur` e `reduceCameraShake` restano toggle senza implementazione.

**Come colmarlo** (in ordine di facilità):
1. `textScale` → CSS custom property `--hud-scale` letta da `HUD.ts`/`SettingsMenu.ts` per scalare font-size.
2. `disableMotionBlur`/`reduceCameraShake` → flag letti da `ThreeRendererService`/futuro sistema camera-shake prima di applicare effetti.
3. `reduceTorchFlicker` → riduce l'ampiezza delle 3 onde sinusoidali in `ThreeRendererService.render()`.
4. `colorBlindMode` → palette/accessibility mapping coerente fra HUD, menu e renderer; eventuale post-processing resta un miglioramento successivo, non piu il primo wiring.
5. `sprintToggle` → cambia la logica di `processInput`/`InputSource` da "hold" a "press-once-to-toggle" per lo scatto.
6. `torchToggle` → richiede una decisione di design prima del wiring: oggi `F` e gia un toggle nativo, quindi il setting va o rimosso oppure ridefinito come controllo distinto.
7. `showDarknessBar` → mostra/nasconde l'elemento `darknessEl` nell'HUD.
8. `assistedLight`/`amplifiedTelegraphs` → dipendono da G-03/G-04 essere completati prima (serve un vero telegrafo di attacco da amplificare).

**Criterio di completamento**: almeno `textScale`, `sprintToggle`, `showDarknessBar` hanno effetto osservabile senza refresh della pagina; `torchToggle` va prima chiarito o rimosso come setting ridondante.

### G-08 — Debito tecnico da ripulire durante il wiring

- Centralizzare i branded type `EntityId`/`RoomId`/`Ticks` (oggi ridichiarati localmente in `simulation/Director.ts`, `gameplay/combat/*.ts`, `gameplay/enemies/*.ts`) in un unico modulo (`src/ecs/EntityAllocator.ts` per `EntityId`, un nuovo `src/procedural/Ids.ts` per `RoomId`/`FloorId`) e importarli ovunque.
- Decidere il destino di `RoomRoleAssigner.ts`, `TreasurePlacer.ts`, `RoomGraph.ts` (stub/non usati, vedi G-02).
- `Jump` e `Dodge` condividono di nuovo `Space` in `ActionMap.ts`: il salto e tornato raggiungibile e il tutorial lo dichiara, ma la semantica finale resta da chiarire quando la schivata avra un effetto gameplay reale.
- Rimuovere la variabile morta `playerHp` in `GameApplication.ts` una volta che G-03 la sostituisce con letture da `HealthStore`; `darknessLevel` statico e stato sostituito da un runtime event-driven minimo, in attesa di un vero `DarknessSystem`.

---

## 2. Gap di design/UX non ancora codificati

Queste sono funzionalita che il codice **presuppone** (via dati, commenti, o riferimenti come "hub", "fucina", "bestiario") ma che sono ancora senza schermata dedicata completa oppure hanno solo una UI runtime minima.

### G-09 — Schermate mancanti

| Schermata | Stato | Dati già pronti | Cosa serve |
|---|---|---|---|
| Menu principale | **assente** — il gioco entra direttamente in partita | — | Nuova vista: Nuova Run / Continua / Impostazioni / Crediti. Componente DOM coerente con lo stile HUD esistente (font monospace, palette §8.1 di `RESOCONTO_PROGETTO.md`). |
| Schermata morte / retry | **parziale** — overlay runtime con retry sicuro via reload | `DomainEvent 'PLAYER_DIED'` già nel tipo `DomainEventKind` | Estendere l'overlay con recap più ricco, Frammenti guadagnati in run e vero ritorno all'hub; collegare anche il grace period del `Director`. |
| Hub / selezione piramide | **assente** | `SaveData.payload.pyramidsUnlocked` già nello schema | Vista fra le run: mostra piramidi sbloccate, permette di entrare nella fucina e nell'albero Ka prima di iniziare. |
| Fucina (upgrade shop) | **assente** | `UpgradeSystem.previewUpgrade/applyUpgrade`, `content/upgrades.ts` (3 innesti nel VS) | UI che mostra gli innesti disponibili, l'anteprima numerica (`UpgradePreview.statChanges`) prima della conferma, costo in oro. |
| Albero Ka (progressione) | **parziale** — overlay `TAB` testuale con acquisto diretto | `KaProgression.KA_TREE`, `canPurchase`, `getNodeLevel` | UI ad albero/lista piu leggibile con gli 8 nodi, costo, livello attuale/max, stato acquistabile/bloccato e feedback dei bonus applicati. |
| Bestiario | **parziale** — overlay `TAB` con schede runtime sintetiche | `SaveData.payload.bestiaryEntries[]` già nello schema, 8 archetipi in `content/enemies.ts` | Galleria/entry più ricche con silhouette, descrizione estesa e progressione per archetipo. |
| Minimappa reale | **parziale** — HUD con minimappa SVG schematica runtime | `FloorModel.rooms[].bounds`, stanze rivelate tracciate da `MAP_REVEAL`, posizione player runtime | Raffinare la minimappa con landmark/tesoro, stanze adiacenti viste e semantica più ricca del semplice schema stanze+player. |
| Rebind controlli | **parziale** — sezione reale nel `SettingsMenu` con cattura del prossimo tasto, reset al default e persistenza nel profilo | `ActionMap`, `InputSystem.setActionMap()`, `payload.settings.runtimeSettings.controls.bindings` | Rifinire eventuale supporto mouse avanzato e aggiungere test DOM/e2e dedicati per la UI di cattura. |
| Schermata di caricamento piano | **parziale** (solo il loading screen iniziale in `main.ts`) | `GenerationClient` ha già un timeout di 30s | Overlay "Generazione in corso..." fra un piano e l'altro, non solo al primo avvio. |

### G-10 — Bilanciamento economico non definito

Il codice ha costi (armi/innesti in oro, nodi Ka in Frammenti) ma **nessuna fonte di reddito è implementata**:
- Nessun nemico droppa oro alla morte (`treasureTables.ts` copre solo il tesoro scavato, non i drop da combattimento).
- Nessun tasso di conversione Frammenti-per-piano-completato è definito nel codice.
- `computePowerBand`/`computeExtraBudgetFactor` presuppongono che il giocatore acquisti progressivamente nodi Ka, ma senza una fonte di Frammenti bilanciata il loop economico è vuoto.

**Da decidere e implementare**: tabella drop-oro per tier nemico (es. tier1: 5-15, tier2: 15-40, tier3: 50-100), Frammenti guaranteed a fine piano + bonus da bestiario/obiettivi, curva di prezzo percepita (i nodi Ka vanno da 10 a 200 Frammenti — verificare che il tasso di guadagno stimato renda l'ultimo nodo raggiungibile in un numero di run ragionevole, es. 15-30).

### G-11 — Curva di difficoltà e onboarding non definiti

- `isTutorial` esiste come flag in `FloorGenerationInput` e altera alcuni parametri di generazione (distanza mappa-tesoro minima 1 invece di 2, `startRow` fisso), ma non esiste una vera sequenza di tutorial in-game (l'unico tutorial è l'overlay statico con l'elenco dei comandi).
- Nessuna curva esplicita di quali archetipi nemici compaiono a quale piano oltre a `minFloor`/`maxFloor` in `Director` (dati presenti solo per `EnemyTemplate`, mai popolati con istanze reali per gli 8 archetipi — oggi `Director` non ha nessun `EnemyTemplate` concreto passato).

**Da fare**: popolare `availableTemplates` con `EnemyTemplate` reali per tutti gli 8 archetipi (oggi solo esempi nei test); progettare i primi 3 piani come sequenza didattica guidata (piano 1: solo SCARAB in spazi aperti; piano 2: introduce MUMMY in spazi stretti; piano 3: combina i due).

---

## 3. Gap grafici e asset — nessun asset reale esiste

`public/` contiene solo `favicon.svg` e `icons.svg`. **Zero modelli 3D, texture, sprite, font custom, VFX** esistono nel repository. Tutta la geometria visibile oggi è primitive Three.js generate a codice (piani, cilindri, box).

### G-12 — Direzione artistica (da fissare prima di produrre asset)

Elementi già impliciti nel codice, da formalizzare in un vero moodboard/art bible:

- **Palette**: nero caldo (`#0B0908`) come base, ambra/oro (`#D4A05A`) come colore di luce/interazione, bordi bronzo (`#4A2F1A`), accento freddo teal (`#2E8B8B`) per elementi "magici/Ka". Materiali di riferimento nel codice: pietra (roughness 0.7-0.9), metallo/oro (roughness 0.4, metalness 0.6), legno (roughness 0.8).
- **Tono**: "Egyptian Noir" — richiede di bilanciare iconografia egizia autentica (geroglifici, anubi, scarabei, sarcofagi, ankh, occhio di Horus, piuma di Maat) con un'estetica cupa/contrastata da noir (luci dure, ombre nette, poca luce ambientale).
- **Font**: attualmente `Courier New` monospace per tutta la UI — da sostituire con un font custom (serif egizio/geroglifico-ispirato per i titoli, monospace pulito per HUD) o mantenere come scelta stilistica definitiva se piace il tono "terminale/papiro".

**Da produrre**: un documento `docs/ART_BIBLE.md` con moodboard (o riferimenti a immagini esterne), palette definitiva in HEX, regole di silhouette per nemici (leggibilità in controluce/buio — critico per un gioco dove la luce è meccanica di gameplay), regole di leggibilità dei telegrafi d'attacco (colore/VFX distintivo per anticipazione).

### G-13 — Asset 3D personaggio e nemici mancanti

| Asset | Riferimento dati esistente | Note tecniche minime |
|---|---|---|
| Player (mani/arma in prima persona) | `PLAYER.capsuleHeightM/RadiusM` in `balance.ts` | Solo viewmodel (mani + arma), no mesh corpo intero necessaria per FPS puro |
| SCARAB | `content/enemies.ts`, HP 20, veloce, gruppi 3-6 | Piccolo, silhouette leggibile in gruppo, deve reggere charge/tell (apertura elitre) |
| MUMMY | HP 60, lento, torch-avoiding | Bende (per shader "infiammabile", vedi G-16), animazione risveglio 2.5s da telegrafare chiaramente |
| COBRA | HP 25, veloce, morso rapido | Basso profilo, probabilmente serpente/umanoide-serpente |
| SHABTI | HP 120, tier 2, statua-guardiano | Grande, "di pietra", carica a lungo raggio (8m) |
| PRIEST | HP 80, corrotto, attacco a distanza | Silhouette diversa (magico, non da mischia), dardo d'ombra come VFX proiettile |
| SOBEK_SPAWN | HP 200, coccodrillo-derivato | Grande, morso rotante + colpo di coda 360° (deve leggersi lo spazio di pericolo circolare) |
| ROYAL_MUMMY | HP 300, tier 3, mini-boss | Variante elaborata di MUMMY, arco d'attacco ampio (140°) |
| WITNESS | HP ∞, tier 3, corrotto | Probabile entità ambientale/non-combattibile — il design deve chiarire visivamente che non è attaccabile |

Ogni nemico richiede minimo: mesh + rig + idle/walk/attack(i)/hit-react/death, più una **hitbox visiva chiara per il tell di anticipazione** (requisito di design esplicito nei dati: `punishWindowTicks`, `interruptibleUntilTick`).

### G-14 — Asset ambiente

Necessario un **kit modulare** (non stanze uniche disegnate a mano, dato che la generazione è procedurale): moduli pavimento/muro/soffitto/porta/corridoio con varianti, dimensionati sulla griglia `ROOM_SIZE_M = 12` / `CORRIDOR_LENGTH_M = 8` già hardcoded in `FloorGenerator.ts`. Più:
- 18 landmark unici (statua-anubi, obelisco-spezzato, braciere-eterno, colonna-scarabeo, sarcofago-aperto, pozzo-oscuro, altare-thoth, coccodrillo-pietra, vaso-canopo-gigante, geroglifico-luminoso, catena-ancestrale, specchio-ossidiana, portale-sigillato, scale-infrante, occhio-horus, piuma-maat, scettro-was, ankh-murale) — nomi già definiti in `FloorGenerator.ts`, zero asset associati.
- Props generici per stanze COMBAT/OPTIONAL (casse, urne, detriti) per varietà visiva senza landmark dedicato.
- Braciere (asset + luce, vedi G-04) e porta modulare compatibile col sistema di apertura esistente.

### G-23 — Affordance visive e placeholder semantici del layout procedurale

**Cosa manca**: la piramide è oggi leggibile **spazialmente** ma non abbastanza **semanticamente**. `ThreeDungeonLayout` costruisce stanze e landmark deterministici, ma i landmark usano 3 primitive hashate e colori generici; il giocatore non può riconoscere bene, senza HUD o conoscenza pregressa, cosa sia un `braciere-eterno`, una stanza critica, un landmark di tesoro o un punto d'uscita. Anche guardiana ed exit-beacon sono placeholder geometrici molto neutri.

**Perché è un gap distinto da G-13/G-14**: non serve aspettare gli asset finali per risolverlo. Anche i placeholder devono preservare silhouette, colore e affordance coerenti col gameplay, altrimenti il vertical slice non comunica il design reale della piramide.

**Come colmarlo**:
1. Mappare famiglie placeholder stabili `landmarkId/role -> geometry/material`, invece di derivarle solo da hash casuale.
2. Dare silhouette e palette chiaramente distinte almeno a: `EXIT`, `TREASURE`, `MAP`, `braciere-eterno`, target guardiana e beacon di uscita.
3. Allineare questi placeholder alla palette già implicita nel progetto (`ambra/oro`, bronzo, teal Ka, nero caldo) e alle opzioni `highContrast`/`assistedLight`.
4. Se necessario, introdurre un piccolo manifest (`content/landmarkPlaceholders.ts`) così la leggibilità non dipenda da euristiche sparse nel renderer.

**Criterio di completamento**: osservando solo il mondo 3D, senza testo sovraimpresso, un tester capisce quali elementi sono uscita, target, landmark importanti e punti di interazione luce/obiettivo.

### G-15 — VFX mancanti

| Effetto | Trigger nel codice (già presente) |
|---|---|
| Torcia: fiamma reale (oggi solo una `SpotLight`, nessun fuoco visivo) | `TorchState !== 'OFF'` |
| Pulse Ka Echo | `TorchEffect.kind === 'KA_ECHO_PULSE'` |
| Colpo/impatto armi | `AttackDefinition.effectCue` (es. `'vfx_slash_trail'`) |
| Polvere/detriti scavo | `DigEvent.kind === 'SEGMENT_COMPLETE'/'DIG_COMPLETE'` |
| Dissolvenza morte nemico | `DomainEvent 'ENEMY_DIED'` |
| Dardo d'ombra (PRIEST) | proiettile a distanza, nessun sistema proiettili esiste ancora — va progettato insieme al VFX |
| Segnale finestra di punizione | `feature.punishWindowSignal` (già `true` di default) — outline/glow sul nemico durante `punishWindowTicks` |

### G-16 — Shader/materiali custom mancanti

- **Flicker torcia su materiali**: oggi il flicker è solo sull'intensità della `SpotLight`; per un effetto convincente serve modulare anche l'emissive/albedo delle superfici vicine (richiede shader custom o `onBeforeCompile` su `MeshStandardMaterial`, oppure passaggio a Three.js Node Materials/TSL se si resta su WebGPU).
- **Geroglifici luminosi** (landmark dedicato): materiale con texture emissive pulsante.
- **Bende infiammabili MUMMY**: shader di dissolve/burn quando colpita da danno da fuoco (`fireDamageMultiplier: 2.0` già in `MUMMY_STATS`, nessun tipo di danno "fuoco" ancora esiste in `DamageResolver`).
- **Dissolve morte nemico**: shader a soglia (noise texture + threshold animato) invece di un semplice pop/scale-to-zero.
- **Materiale sabbia/polvere** per il pavimento (oggi materiale piatto marrone).

### G-17 — Pipeline di importazione asset (codice mancante)

**Nessun caricatore di asset esiste nel codice.** Serve:
1. Aggiungere `GLTFLoader` (fa parte del pacchetto `three/examples/jsm/loaders/`, nessuna nuova dipendenza npm richiesta oltre `three` già presente) in un nuovo modulo `src/rendering/AssetLoader.ts`.
2. Definire una convenzione di naming/manifest (es. `content/assets.ts` con mappa `archetype → percorso .glb`) analoga a `content/enemies.ts`.
3. Gestire il caching (`Map<string, Promise<GLTF>>`) per evitare ricaricamenti.
4. Se si useranno texture compresse (KTX2/Basis) per performance, serve anche `KTX2Loader` + `THREE.WebGLRenderer.extensions` (o l'equivalente WebGPU) — da valutare solo se il progetto avrà molti asset ad alta risoluzione.

---

## 4. Gap audio — libreria sample assente

`WebAudioEngine.ts` è architetturalmente completo (bus, pooling, HRTF) ma `generateSilence()` sostituisce ogni sample reale. **Zero file audio esistono nel repository.**

### G-18 — Lista suoni necessari (da cue già dichiarati nel codice)

Estratti da `AttackDef.audioCue`/`WeaponDefinition.attacks[].audioCue`/`TorchEffect`:

- SFX combattimento: `sfx_fist_swing`, `sfx_khopesh_slash`, `sfx_staff_sweep`, `sfx_shovel_swing`, `scarab_click`, `mummy_creak`, `mummy_grab`, `snake_hiss`, `shabti_swing`, `shabti_charge`, `priest_dart`, `sobek_bite`, `sobek_tail`, `royal_swing`.
- SFX torcia: accensione, spegnimento, agitazione, esaurimento combustibile, accensione braciere, Ka Echo pulse.
- SFX scavo: colpo pala, completamento segmento (4 varianti crescenti), completamento tesoro.
- SFX UI: apertura/chiusura menu, hover/click bottoni, notifica messaggio HUD.
- Ambience: loop per corridoio/stanza (variazione per tensione/oscurità — 4 livelli già definiti da `DARKNESS.thresholds`), stinger per transizione di livello di oscurità.
- Musica: nessun sistema musicale dinamico esiste nel codice — da progettare (adaptive music a strati per livello di allerta/oscurità è lo standard per questo genere).
- Voci/sottotitoli: `SettingsMenu` ha `subtitleNames`/`subtitleDirections` già previsti — implica che sia previsto del dialogo/narrazione vocale, oggi totalmente assente sia come sistema che come asset.

### G-19 — Come colmarlo

Due strade, non mutuamente esclusive:

1. **Sample reali**: librerie audio royalty-free (es. da fonti come freesound.org con licenza compatibile, o pacchetti commerciali) convertiti in formato compresso web (`.ogg`/`.webm` opus per dimensione, con fallback `.mp3` per compatibilità Safari) e caricati via `fetch` + `AudioContext.decodeAudioData` al posto di `generateSilence`.
2. **Sintesi procedurale**: dato il tono "diario/papiro" retro-tecnologico già presente nella UI, valutare la sintesi runtime (oscillatori/noise via Web Audio nativo, o con **Tone.js** per semplificare la scrittura di sintetizzatori/sequencer) per SFX semplici (click UI, hit, ambience) — riduce drasticamente il peso di asset scaricati ed è coerente con un progetto che già genera tutto proceduralmente (livelli, RNG).

**Raccomandazione**: sintesi procedurale per SFX brevi e UI (basso costo, alta coerenza col resto del progetto proceduralmente generato), sample reali solo per ambience/musica dove la sintesi runtime è più costosa da rendere convincente.

---

## 5. Gap di test, CI e strumenti di sviluppo

Già elencati in dettaglio in `RESOCONTO_PROGETTO.md` §11.2; qui solo le azioni concrete mancanti:

### G-20 — Ambiente di test DOM

`vitest.config.ts` usa `environment: "node"`. Per testare `HUD.ts`, `SettingsMenu.ts`, e in futuro le nuove schermate (G-09), serve `environment: "happy-dom"` (più leggero di `jsdom`, sufficiente per manipolazione DOM sintetica) — richiede aggiungere `happy-dom` come devDependency e o un secondo file `vitest.config.dom.ts` con progetto separato, o cambiare l'ambiente globale se tutti i test possono girare sotto `happy-dom` senza penalità di performance.

### G-21 — CI

Nessuna pipeline esiste. Creare `.github/workflows/verify.yml` (o equivalente per altro provider) che esegua `npm run verify` a ogni push/PR. Aggiungere un secondo workflow schedulato (nightly) che esegua i property test con run count elevato (100.000, come dichiarato nei commenti del progetto ma mai implementato) passando un override a `fast-check` (`numRuns` nei singoli test, oggi hardcoded a 100 — da parametrizzare via variabile d'ambiente `FC_NUM_RUNS`).

### G-22 — Test e2e

**Aggiornamento 2026-08-13**: il gap iniziale "zero test Playwright" è stato **parzialmente colmato**. Esistono già 7 smoke test su bootstrap, tutorial accessibile, pointer-lock recovery, pause/resume per visibility, persistenza impostazioni runtime e aggiornamento live della palette accessibile.

**Gap residuo**: manca ancora la copertura e2e del gameplay reale del vertical slice:
- completamento run (`guardiana -> uscita -> stato completed`);
- feedback delle impostazioni runtime che oggi hanno effetto (`highContrast`, `showDarknessBar`, `assistedLight`);
- variazione del layout per seed diversi / ripetibilità per seed uguale;
- future interazioni `braciere`, `digSite`, combattimento reale e persistenza.

---

## 6. Librerie da aggiungere (raccomandazioni)

| Libreria | Categoria | Perché | Alternativa |
|---|---|---|---|
| *(nessuna nuova dipendenza)* — `GLTFLoader`/`KTX2Loader` | Asset 3D | Già parte del pacchetto `three`, sotto `three/examples/jsm/` | — |
| `happy-dom` (dev) | Testing | Ambiente DOM leggero per testare HUD/SettingsMenu senza browser reale | `jsdom` (più pesante, più compatibile con edge case) |
| `tone` | Audio | Sintesi procedurale SFX/musica coerente con l'approccio "tutto generato" del progetto | Restare su Web Audio API nativo (più controllo, più codice da scrivere a mano) |
| `stats.js` o `three/examples/jsm/libs/stats.module` (dev) | Debug performance | Overlay FPS/frame-time per validare i target dei `QualityProfile` (30/60/120 fps) | Contatore custom (già presente parzialmente in `GameApplication.loop`) |
| `simplex-noise` o equivalente puro | Procedurale/VFX | Noise per shader di dissolve (G-16), variazione terreno, distribuzione props | Implementare Perlin/Simplex a mano (poche righe, evita dipendenza) |
| *(nessuna)* — `postprocessing` (npm) o Three.js `EffectComposer` nativo | Rendering | Necessario per `highContrast`/`colorBlindMode`/eventuale bloom/vignette | `EffectComposer` è già incluso in `three/examples/jsm/postprocessing/`, spesso sufficiente senza librerie esterne |
| `@react-three/fiber` + React | UI/Rendering | **Sconsigliata**: il progetto ha scelto esplicitamente DOM/CSS puro per la UI e Three.js imperativo per il rendering; introdurre React romperebbe la filosofia "nessun framework" dichiarata nei commenti | — |

**Nota generale**: il progetto privilegia zero-dipendenze-extra dove Three.js già offre l'occorrente (loader, postprocessing) — coerente con lo stile minimalista osservato in tutto il codice (nessun framework UI, RNG scritto a mano invece di una libreria, hash scritto a mano invece di una libreria crypto). Rispettare questa filosofia quando si valutano nuove dipendenze: preferire "poche righe scritte a mano" a "nuovo pacchetto npm" quando il gap è piccolo.

---

## 7. Playbook per un'AI locale (nessun contesto pregresso)

Istruzioni sequenziali per un'AI (o sviluppatore) che riceve solo questo repository + questo file + `RESOCONTO_PROGETTO.md`, senza aver letto le conversazioni di sviluppo precedenti.

### 7.1 Setup iniziale (sempre, ad ogni ripresa di lavoro)

```bash
npm install                       # se node_modules manca o dà errori di binding nativi:
                                   # rm -rf node_modules package-lock.json && npm install
npm run verify                    # deve essere tutto verde prima di iniziare qualunque modifica
node scripts/export-diagnostics.mjs   # fotografia aggiornata: file/righe per layer, errori tsc
```

Se `npm run verify` non è verde, **non procedere** con nuove feature: prima capire e correggere la regressione (probabilmente causata da modifiche non salvate o da un binding nativo mancante nella sandbox, vedi `RESOCONTO_PROGETTO.md` §2).

**Nota storica (risolta durante G-01)**: `npm run typecheck` e `npm run lint` non erano mai stati eseguiti prima di questa sessione — `RESOCONTO_PROGETTO.md` §11.2 lo segnalava come gap. Eseguendoli per la prima volta sono emersi 1 errore di configurazione (`tsconfig.json` con `baseUrl` deprecato in TS 6, corretto con `"ignoreDeprecations": "6.0"`) e ~9 variabili/import inutilizzati preesistenti in file non toccati da questa sessione (`SwarmSteering.ts`, `CombatSystem.ts`, `DiggingSystem.ts`, `WeaponSystem.ts`, `Director.ts`, `PhysicsSystem.ts`, `PlayerSystem.ts`, più 2 file di test) — tutti corretti. `npm run lint` su tutto il progetto è lento (>45s, oltre i limiti del sandbox di sviluppo di questa sessione) perché ESLint con `strictTypeChecked`/`projectService` ricostruisce l'intero grafo di tipi del progetto; se serve linting completo in un ambiente con più tempo a disposizione, eseguirlo con pazienza (o in CI, vedi G-21) invece di limitarsi ai file appena modificati come fatto qui.

### 7.2 Ordine di esecuzione consigliato

Segue le dipendenze reali fra i gap (non un ordine arbitrario):

1. **G-01** (fisica/player) — ✅ **completato**. Tutto il resto del gameplay dipende da un player reale nel mondo fisico, ora disponibile.
2. **G-02** (generazione procedurale → mesh reale) — ✅ **completato**.
3. **G-04** (torcia completa/scavo/braciere/Ka Echo) — **prossimo gap da affrontare** sul lato interazione ambientale: ora che il layout esiste, va reso vero il contratto di design "luce nel mondo", scavo e bracieri.
4. **G-03** (combattimento + nemici) — procede in parallelo a G-04: richiede lo spazio reale già fornito da G-02 e completa il loop guardiana/combattimento oltre l'attuale vertical slice singolo bersaglio.
5. **G-23** (placeholder semantici/affordance) — da affrontare presto insieme a G-04/G-14, altrimenti il vertical slice resta leggibile solo via HUD e conoscenza del codice.
6. **G-08** parziale (pulizia branded type, decisione su stub morti) — farlo durante G-03/G-04 e ogni refactor del layout/procedural.
7. **G-09** (schermate: menu, morte, hub, fucina, albero Ka, bestiario, minimappa) — richiede che gli eventi che le alimentano (morte, uccisioni, Frammenti) esistano già da G-03/G-05.
7. **G-05** (persistenza) — collegabile appena esistono dati reali da salvare (Frammenti da G-10, bestiario da G-03).
8. **G-10** (bilanciamento economico) — decisione di design da prendere prima o durante G-05, non dopo (altrimenti si salvano dati con valori placeholder).
9. **G-06** (audio) e **G-12–G-17** (grafica/asset) — possono procedere in parallelo a tutto il resto una volta che i *trigger* di gioco esistono (senza G-03/G-04 completati, non c'è nulla a cui agganciare i suoni/VFX).
10. **G-07** (accessibilità reale) — ultimo, perché richiede che le funzionalità a cui si applica esistano già (es. `amplifiedTelegraphs` richiede che i telegrafi d'attacco da G-03 esistano).
11. **G-20/G-21/G-22** (test/CI) — da costruire progressivamente insieme a ogni gap, non come fase finale isolata: ogni nuovo sistema wired (G-01…G-07) dovrebbe guadagnare almeno un test prima di considerarsi "fatto".

### 7.3 Criterio di "fatto" per ogni modifica

Prima di considerare chiuso un gap:

1. `npm run typecheck` pulito.
2. `npm run lint` pulito.
3. `npm run verify:boundaries` pulito — **attenzione particolare** quando si crea codice che collega layer diversi (es. un nuovo `EnemySpawnSystem` in `simulation/systems/` non può importare `three` direttamente; deve passare per l'interfaccia `RendererHandle` o produrre eventi che il layer `rendering` consuma).
4. `npm run verify:content` pulito se si toccano valori in `balance.ts`.
5. `npm run test` pulito, con almeno un nuovo test per la logica pura aggiunta (i sistemi con stato testabile senza DOM/Rapier/Three vanno sempre testati in isolamento, seguendo lo stile già presente in `tests/gameplay/`).
6. Verifica manuale in browser (`npm run dev`) del comportamento atteso — i test unitari non sostituiscono la verifica visiva per un gioco.

### 7.4 Convenzioni da rispettare (osservate in tutto il codice esistente, non negoziabili senza motivo)

- Ogni nuovo file inizia con un header JSDoc: `Scopo`, `Ownership`, `Invarianti`, `Failure mode` (vedi qualunque file esistente come esempio, es. `src/gameplay/torch/TorchSystem.ts`).
- Commenti e nomi di dominio in italiano, identificatori di codice in inglese.
- Nessun valore magico di gameplay fuori da `content/balance.ts`.
- Tutte le durate di simulazione in **tick interi** (`secondsToTicks()` alla creazione, mai secondi float nella logica).
- Import relativi con estensione `.js` esplicita (richiesto dal tsconfig, vedi `RESOCONTO_PROGETTO.md` §3.3).
- Funzioni pure dove possibile: stato in ingresso + comando → nuovo stato + effetti, non mutazione nascosta (le eccezioni già presenti — `Director`, `MummySystem`, `ScarabSystem`, `KaEchoSystem` — mutano per riferimento; nuovo codice dovrebbe preferire lo stile immutabile usato da `TorchSystem`/`DamageResolver` a meno di motivo di performance documentato).
- Mai `Math.random()`, `Date.now()`, `performance.now()` dentro `simulation/`, `procedural/`, `ai/` — lo script `verify-boundaries.mjs` fallisce la build se li trova.
- Rispettare le regole di boundary fra layer (tabella in `RESOCONTO_PROGETTO.md` §4.1) — se un nuovo modulo sembra richiedere un import vietato, è quasi sempre un segnale che va diviso in due moduli (uno puro in un layer, un adapter nell'altro), come già fatto per `PlayerCharacterController.ts` (eccezione esplicita e documentata, non un'infrazione silenziosa).

### 7.5 Comandi diagnostici utili durante il lavoro

```bash
node scripts/verify-boundaries.mjs     # dopo ogni nuovo import cross-layer
node scripts/verify-content.mjs        # dopo ogni modifica a balance.ts
npx vitest run tests/gameplay/         # ciclo rapido durante lo sviluppo di un sistema gameplay
npx vitest run tests/property/         # dopo modifiche a DamageResolver o SeedRng
node scripts/export-diagnostics.mjs    # panoramica prima/dopo una sessione di lavoro lunga
```

---

## 8. Competenze/skill richieste per completare il progetto

Elenco realistico di cosa serve, per pianificare risorse (umane, AI specializzate, o entrambe):

| Area | Competenza specifica | Dove serve |
|---|---|---|
| **Programmazione** | TypeScript avanzato (strict mode, branded types, discriminated union) | Tutto il codebase |
| | Design di sistemi ECS (Entity-Component-System) | Estensione di `src/ecs/`, nuovi sistemi in `simulation/systems/` |
| | Three.js (scene graph, materiali, luci, geometrie custom, `three/examples/jsm`) | G-02, G-12–G-17 |
| | WebGPU / shader (WGSL) o quantomeno GLSL via `onBeforeCompile` | G-16 |
| | Fisica per videogiochi (character controller, collision layers, Rapier/PhysX-family API) | G-01 |
| | Web Audio API (o Tone.js) | G-06, G-18–G-19 |
| | Testing (Vitest, property-based testing con fast-check, idealmente Playwright) | G-20–G-22 |
| | Web Workers e comunicazione message-passing | già presente in `workers/`, da estendere se serve parallelizzare altro |
| **Game design** | Bilanciamento numerico (curve di progressione, economia in-game) | G-10, G-11 |
| | Level design procedurale (regole di generazione, leggibilità dei layout) | G-02, tuning di `FloorGenerator` |
| | Combat design (telegrafo/lettura, i-frame, finestre di punizione) | G-03, G-04 |
| | Accessibility design (non solo checkbox, ma cosa cambia davvero per l'utente) | G-07 |
| **Arte** | Concept art / art direction (per fissare G-12 prima di produrre asset) | G-12 |
| | Modellazione 3D low/mid-poly + rigging + animazione per game engine | G-13, G-14 |
| | Texturing / material authoring (PBR: albedo/roughness/metalness/normal) | G-13, G-14, G-16 |
| | VFX artist (particellari, shader di dissolve, trail) | G-15, G-16 |
| | UI/UX design (per le schermate mancanti in G-09, mantenendo coerenza con la palette/font esistenti) | G-09 |
| **Audio** | Sound design (SFX) | G-18 |
| | Composizione musicale adattiva (a strati, per stato di allerta/oscurità) | G-18 |
| | Voice direction (se si conferma la necessità di dialoghi, vedi nota in G-18 su `subtitleNames`) | G-18 |
| **Produzione/Direzione** | Capacità di prioritizzare fra i gap (questo documento dà un ordine di dipendenza tecnica in §7.2, ma le priorità di prodotto — es. "vogliamo prima un video giocabile 5 minuti" vs "vogliamo prima l'intero loop economico" — restano una decisione umana) | Tutto |

### Skill/tool di sviluppo assistito (per un'AI o sviluppatore che usa strumenti AI)

- **Lettura/scrittura file e shell** (Read/Write/Edit + bash) — sufficiente per tutto il lavoro di wiring codice (G-01–G-08).
- **Nessuno skill/plugin specializzato del catalogo Cowork è strettamente necessario** per i gap di codice: sono TypeScript puro, risolvibili con gli strumenti generici già in uso in questa sessione.
- Per i gap di **asset grafici/audio** (G-12–G-19): servono strumenti esterni al codice (software di modellazione 3D tipo Blender, DAW per audio, editor di immagini) che un'AI di coding non può produrre direttamente — al più può generare placeholder proceduralmente (primitive geometriche, sintesi audio via Tone.js/Web Audio) come già fa oggi `ThreeRendererService`/`WebAudioEngine`, utile per iterare sul gameplay prima che gli asset finali siano pronti.
- Se disponibile, uno skill di **generazione immagini** può produrre concept art di riferimento per G-12 (moodboard) ma non asset 3D direttamente utilizzabili in game (richiede comunque una fase di modellazione/retopology umana o con tool 3D dedicati).

---

## 9. Checklist riassuntiva

Copiare in un tracker (task manager, issue tracker) mantenendo la numerazione `G-NN` per riferimento incrociato con questo documento.

- [x] G-01 — Fisica e player controller reali collegati
- [x] G-02 — Generazione procedurale sostituisce la scena di test
- [x] G-03 — Combattimento reale con nemici in scena (hurtbox, hit-once, parry, spawn dinamico — TUTTI gli archetipi)
- [ ] G-04 — Torcia/scavo/braciere/Ka Echo completamente collegati — residui in PIANO_COMPLETAMENTO A-01 (consumer rumore generalizzato, loot scavo, impatto braciere su Director)
- [x] G-05 — Persistenza reale (save/load) — graft equipaggiabili (UpgradeResolver) + oro→Frammenti + meta-loop multi-floor 10 piani
- [x] G-06 — Audio reale (17 OGG Kenney CC0 + 13 cue sintetici + drone ambience + musica adattiva 3 stati)
- [ ] G-07 — Accessibilità: 11/14 con effetto (residuo: amplifiedTelegraphs su tutti gli archetipi + decisione torchToggle — A-02)
- [x] G-08 — Debito tecnico (branded type centralizzati, stub morti rimossi/decisi)
- [x] G-09 — Schermate mancanti (menu principale ✅; morte ✅ con run summary; hub/fucina = Priorità C-04)
- [x] G-10 — Bilanciamento economico definito e implementato
- [x] G-11 — Curva di difficoltà/onboarding definita (template nemici + planner; calibrazione playtest = A-03)
- [x] G-12 — Art bible/direzione artistica formalizzata (docs/ART_BIBLE.md)
- [x] G-13 — Asset 3D: 7/7 nemici GLB (ToxSam + Poly Pizza) + runtime data-driven
- [x] G-14 — Ambiente: 5/5 landmark GLB + decor procedurali InstancedMesh + texture PBR (Ground054/Rock064)
- [x] G-15 — VFX principali (fiamma, trail, polvere, dissolve, vignette+grana, bloom WebGL2 E WebGPU, god rays)
- [x] G-16 — Shader/materiali custom (geroglifici emissivi, sabbia PBR, dissolve onBeforeCompile, env map)
- [x] G-17 — Pipeline importazione asset (AssetLoader + manifest + gltf-transform meshopt, 12/12 GLB -44%)
- [x] G-18 — Libreria suoni/musica (Kenney CC0 + drone procedurale + musica adattiva)
- [x] G-19 — Sistema di caricamento audio collegato (loadAssets + fallback procedurale)
- [x] G-20 — Ambiente di test DOM (happy-dom, `npm run test:dom`, 43 test)
- [x] G-21 — Pipeline CI (workflow `.github/workflows/verify.yml` pronto; serve `git init` + push)
- [x] G-22 — Test e2e (Playwright) — 11/11 verdi (menu, tutorial, persistenza, palette, fallback WebGL2, riproducibilità/varianza seed)
- [x] G-23 — Placeholder semantici e affordance del layout procedurale (9 famiglie visive distinte in `ThreeDungeonLayout.addLandmark` via `LandmarkPlaceholders`)

---

*Fine documento. Complementare a `RESOCONTO_PROGETTO.md` — leggere entrambi prima di iniziare a modificare il codice.*
