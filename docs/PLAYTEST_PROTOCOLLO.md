# 🎮 Protocollo di Playtest — La Piramide Perduta (A-03)

> Documento operativo per le sessioni di calibrazione COBRA/SHABTI (PIANO_COMPLETAMENTO A-03).
> Creazione: 2026-08-16. Da usare OGNI volta che un tester esterno prova il VS.

## Obiettivi della sessione

1. Verificare che un tester esterno completi il piano 1 senza softlock.
2. Misurare il tasso di successo della parata vs COBRA (target: 30-50% ai primi tentativi).
3. Misurare la leggibilità del telegrafo della carica SHABTI (target: "difficile ma leggibile").
4. Registrare il feedback "non capisco quando devo parare" (deve NON emergere in 3/3 sessioni).

## Setup

- URL: `http://localhost:5175/?seed=<seed>` — usare SEMPRE lo stesso seed tra tester
  per confrontare i dati (consigliato `?seed=42`, floor 1 con COBRA/SHABTI raggiungibili).
- Hardware: annotare GPU/CPU e backend rilevato (WebGPU/WebGL2) dal DebugOverlay (F3).
- Durata: 20-30 min a sessione, max 3 run per tester (evitare la curva di apprendimento).

## Check-in pre-run (2 min)

- [ ] Volume audio a livello confortevole (i cue parry/telegrafo sono udibili?).
- [ ] Impostazioni accessibilità: chiedere se servono (telegrafi amplificati, contrasto alto).
- [ ] Spiegare SOLO i controlli base (WASD+mouse, E interagisci, F torcia, click sx attacca,
      click dx para, Spazio schivata) — NIENTE spiegazioni sulle meccaniche avanzate.

## Durante la run (osservazione, non guida)

Annotare (taccuino o tabella):

| # | Timestamp | Evento osservato | Esito |
|---|---|---|---|
| 1 | | Parata tentata vs COBRA | riuscita / mancata / non tentata |
| 2 | | Morso COBRA subito | letto il telegrafo? sì / no |
| 3 | | Carica SHABTI | leggibile / il tester è stato colpito a sorpresa |
| 4 | | Scontro 2vs1 (floor 3) | HP residui dopo lo scontro |
| 5 | | Scavo completato | reazione al loot bonus (sorpresa positiva?) |
| 6 | | Braciere acceso | il tester nota la riduzione della pressione? |

Note speciali:
- "Non capisco quando devo parare" → registrare VERBATIM e l'istante.
- Softlock o blocco > 60s → registrare posizione/stanza e seed.

## Check-out post-run (3 min)

- [ ] Piano 1 completato senza guida? sì / no (e dove si è fermato)
- [ ] Qual è stato il momento più frustrante? 
- [ ] Il telegrafo d'attacco dei nemici era sempre leggibile?
- [ ] La parata è risultata utile o opzionale?

## Output della sessione

- Compilare la tabella `docs/playtest_sessions.md` (o `sessioni-playtest-<data>.md`).
- Dopo 3 sessioni: aggiornare le costanti in `src/content/balance.ts` e
  `src/content/enemyTemplates.ts` (MAI valori magici fuori da quei file) —
  `npm run verify:content` valida i range.

## Criteri di completamento A-03

1. 3/3 tester completano il piano 1 senza guida.
2. Il feedback "non capisco quando devo parare" NON emerge in 3/3 sessioni osservate.
3. Tasso parata COBRA misurato: 30-50% nei primi tentativi (se < 30% → finestra a 400ms;
   se > 50% → danno o velocità COBRA da rivedere).
