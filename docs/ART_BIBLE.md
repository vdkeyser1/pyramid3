# 🎨 LA PIRAMIDE PERDUTA — Art Bible (G-12)

> **Scopo**: definire la direzione artistica del gioco in modo operativo —
> palette, silhouette, linguaggio visivo dei nemici, regole di leggibilità,
> illuminazione e mood. È il contratto tra design, rendering e asset pipeline.
> Data: 2026-08-13. Stato: v1 (allineata al vertical slice attuale).

---

## 1. IDENTITÀ VISIVA — "Egyptian Noir"

Non un dungeon fantasy con skin egizia: un **thriller archeologico**. Ogni frame
comunica tre cose:

1. **Antichità** — pietra, sabbia, ossidazione (rugosità alta, colori spenti)
2. **Mistero** — oscurità selettiva, informazione rivelata solo dalla torcia
3. **Pericolo** — contrasto tra luce sacra (oro caldo) e ombre corrotte (blu-notte)

**Regola dei 3 secondi**: uno screenshot qualsiasi deve far pensare
"questo è La Piramide Perduta", non "un altro dungeon crawler".

### Palette canonica (già in uso nel progetto)

| Ruolo | Esadecimale | Uso |
|---|---|---|
| Oro sabbia | `#D4A05A` | Luce torcia, geroglifici attivi, ricompense, UI primaria |
| Rame spento | `#9A5A38` | Combustibile basso, bracieri, meccanismi |
| Turchese vivo | `#2E8B8B` | Conoscenza, mappe, interazioni sicure (Ka Echo) |
| Porpora secca | `#6A334D` | Sangue antico, danno, tessuti mummificati |
| Blu notte | `#18243A` | Maledizioni, segreti, rischio elevato |
| Nero caldo | `#0B0908` | Vuoto, fondo, morte |
| Edge dark | `#1A1512` | Silhouette minima al buio assoluto |
| Sabbia | `#8A7350` | Pavimento (texture granulare procedurale) |

**Regola**: 1 materiale dominante + max 2 accenti per stanza. Mai più.

---

## 2. LINGUAGGIO DELLE FORME (silhouette)

La silhouette è il primo canale di informazione — deve funzionare **anche al buio
assoluto** (edge detection `#1A1512`). Ogni famiglia ha una firma di forma unica:

| Famiglia | Forma | Esempio |
|---|---|---|
| Umanoide eretto | Capsula alta 1.6-2.2 unità | MUMMY, SHABTI, PRIEST |
| Basso e largo | Capsula schiacciata, <1 unità | SCARAB |
| Strisciante | Cilindro basso e lungo | COBRA |
| Anfibio massiccio | Capsula tozza 1.8 unità | SOBEK |
| Altissimo e magro | Cilindro sottile 3+ unità | WITNESS, obelischi |
| Sarcofago | Box 1.9×1.0×0.95 | Tesoro/rischio |
| Portale | Extrude a forma di arco + sfera accesa | Uscita |

**Vincolo**: nessun nemico condivide la silhouette di un landmark critico
(uscita/tesoro/mappa) — per evitare ambiguità al buio.

---

## 3. LINGUAGGIO DEL COLORE (semantica per ruolo)

Il colore **comunica prima del testo** — invariante già verificato in
`AccessibilityPalette` (contrasto alto/daltonismo):

| Stato | Colore emissivo | Significato |
|---|---|---|
| Nemico dormiente | Nessuno (materiale spento) | Non attivo |
| Risveglio | `#D4A05A` occhi + bende | Allarme imminente |
| Telegrafo d'attacco | `#4A180C` intensità 0.7→1.6 | Pericolo — schiva |
| Hit flash | `#A23F16` | Colpo ricevuto |
| Punish window (amplificato) | `#7A1F16` pulsante (Occhio del Ladro) | Occasione di colpo |
| Sito di scavo pericoloso | `#7A1F16` pulsante | Rischio/reward |

**Regola**: l'emissivo rosso = pericolo attivo, MAI decorazione. L'emissivo
turchese = conoscenza/interazione sicura. L'oro = ricompensa.

---

## 4. ILLUMINAZIONE — La torcia è il personaggio

| Livello | Tecnica | Mood |
|---|---|---|
| Base (bracieri) | PointLight 18, warm `#FF9B3D` | Rifugio sicuro |
| Torcia in mano | SpotLight 80 + fiamma procedurale | Esplorazione attiva |
| Buio assoluto | Edge detection + occhi emissivi | Tensione massima |
| Momento narrativo | (futuro) god rays volumetrici | Cinema — boss/tesoro |

Regole:
- La **luce rivela il percorso E il giocatore** (nemici vedono la luce)
- Il flicker è a **3 onde di Perlin** (0.7/3.1/11.3 Hz) — organico, mai nervoso
- `reduceTorchFlicker` (accessibilità) attenua del 65% senza cambiare l'AI

---

## 5. LINGUAGGIO DEL MOVIMENTO (telegrafi)

Ogni attacco comunica **intento → finestra → controgioco** con il corpo prima
che con il danno (già in `combat-properties.test.ts` come invariante):

| Nemico | Telegrafo visivo | Durata min | Controgioco |
|---|---|---|---|
| SCARAB | Elitre si aprono + click | 0.4s | Schivata laterale, poi punizione 0.8s |
| MUMMY | Peso sulla gamba destra | 1.0s | Kiting (gira a 60°/s max) |
| COBRA | Sibilo direzionale | 0.25s | Non correre senza ascoltare |
| SHABTI | Polvere dalle giunture | continuo | Solo attacco da dietro |

**Regola d'oro**: nessun danno significativo senza indicatore visivo o sonoro.
`amplifiedTelegraphs` (accessibilità) amplifica scala+emissive ×1.9.

---

## 6. TEXTURE E MATERIALI (già implementati, G-16)

| Superficie | Roughness | Metalness | Nota |
|---|---|---|---|
| Sabbia (pavimento) | 0.92 | 0.08 | Texture granulare procedurale deterministica |
| Pietra calcarea (muri) | 0.88 | 0.05 | Assorbe luce, niente riflessi |
| Oro antico | 0.4 | 0.9 | Riflessi caldi (futuro: asset PBR) |
| Bende mummia | 0.85 | 0.05 | Dissolve dorato alla morte |
| Geroglifici | — | — | Texture procedurale emissiva (futuro: texture CC0 ancient-egypt-0) |

**Dissolve morte nemico** (implementato): clip per soglia + bordo emissivo
`#D4A05A` + noise — la morte è un evento visivo, non un pop.

---

## 7. UI — Papiro annerito (già implementato)

- **Font titoli**: Cinzel (OFL) — da self-hostare via fontsource
- **Font geroglifici**: Noto Sans Egyptian Hieroglyphs (OFL) — decorazioni/messaggi
- **HUD**: HP banda frastagliata in basso a sinistra, torcia cerchio in basso a
  destra (bordo che "brucia"), minimappa papiro
- **Danno**: tremore HUD + vignetta porpora + camera shake (attenuabile)
- **Overlay**: menu principale (G-09), impostazioni, progressione Ka — z-index
  sotto i modali, palette coerente

---

## 8. AUDIO COME ARTE (G-18 — sintesi attuale)

| Categoria | Stato | Direzione |
|---|---|---|
| Cue gameplay (torcia, braciere, scavo, tesoro) | ✅ sintetici (WebAudio) | Da arricchire con foley reale (Kenney/Sonniss) |
| Cue combattimento (swing, hit, dodge, gold) | ✅ nuovi (2026-08-13) | Frequenze distinte per firma unica |
| Ambience per livello di oscurità | ⬜ | Loop desert/cripta (OGA CC0) |
| Musica adattiva | ⬜ | Stati: esplorazione/tensione/combattimento |

**Principio**: l'audio sostituisce parte della vista al buio. Ogni attacco
pericoloso ha una firma sonora unica e direzionale (HRTF panner già in uso).

---

## 9. CHECKLIST DI QUALITÀ VISIVA (per ogni sistema completato)

- [ ] Silhouette riconoscibile in nero puro?
- [ ] Colori comunicano lo stato emotivo della stanza?
- [ ] Sorgente di luce principale credibile (torcia/braciere/occhi)?
- [ ] Superfici "toccabili" (roughness/normal coerenti)?
- [ ] Movimento comunica intento prima dell'azione?
- [ ] Il suono arriva prima del pericolo?
- [ ] Ogni azione del giocatore ha risposta visiva/sonora?
- [ ] Informazioni critiche disponibili senza colore/suono (accessibilità)?
- [ ] Budget frame rispettato (P95 ≤ 16.7ms)?
- [ ] L'elemento "appartiene" alla piramide (coerenza)?

---

## 10. REFERENZE E PROSSIMI PASSI

| Area | Risorsa (vedi `RISORSE_PROFESSIONALI.md`) | Gap |
|---|---|---|
| Modelli ambiente | Quaternius Ruins CC0, ToxSam GLB registry | G-14 (infrastruttura pronta) |
| Modelli nemici | Quaternius Creatures, Mixamo rig | G-13 |
| Texture PBR | ambientCG (sand/stone), ancient-egypt-0 | G-16 (parziale) |
| Font | Cinzel + geroglifici via fontsource | G-09 polish |
| Post-FX | pmndrs/postprocessing (bloom/vignette) | G-15 V5 |

*Questa Art Bible va aggiornata quando un nuovo sistema visivo entra nel gioco
— stessa regola della roadmap: documento vivo, aggiornato a ogni implementazione.*
