# Rutger Schaak

Eigen schaaktrainer (Vite + TypeScript, Stockfish 19 in WebAssembly, chessground, chess.js). Geen server nodig; data staat in je browser (`localStorage`, back-up via Instellingen).

```bash
npm install
npm run dev      # ontwikkelen
npm run build    # statische site in dist/ (werkt vanaf elke host)
```

- **Analyse**: PGN plakken of partijen ophalen van je Chess.com/Lichess-account (met filters en winst/verlies-kleuren). Game review met coach: briljante/geweldige zetten, gemiste kansen, uitleg per zet, "Probeer opnieuw" en sprongen tussen sleutelmomenten. Plus evaluatiegrafiek, live engine-lijnen en proefmodus.
- **Openingen**: ~3.900 ECO-openingen (Lichess-data). Verkennen met boekzetten, repertoire samenstellen (wit/zwart) en oefenen met willekeurige tegenstander-zetten en hints.
- **Theorie & puzzels**: eindspelen spelen tegen Stockfish (Lucena, Philidor, matpatronen…), eigen fouten met spaced repetition, Lichess-puzzels importeren.

Openingsdata verversen: `node scripts/build-openings.mjs`.
- **Dagtraining**: kies een dag, haal je Chess.com/Lichess-partijen van die dag op, analyseer ze en krijg een rapport met je meest gemaakte soorten fouten (mat toegestaan, stukken weggegeven, gemiste tactiek, opening/eindspel…), een oefenplan, openingslekken en automatisch aangemaakte puzzels per thema.

## Kalibratie op Chess.com Game Review

De publieke Chess.com-API geeft bij gereviewde partijen het veld `accuracies`. Daarmee zijn de drempels in `src/analysis.ts` (`T`) afgesteld:

- 13 gereviewde partijen (26 kanten, rating ~1000–1100): nauwkeurigheid = gemiddelde van `100·exp(−0,16·winkansverlies)`. Fout t.o.v. Chess.com: 14,7 → 5,1 punten.
- Labels (onnauwkeurig ≥5%, fout ≥12%, blunder ≥26%, geweldig = enige zet met ≥25% verschil, Miss na een fout van de tegenstander) zijn afgesteld op één partij met bekende labelaantallen. Dat is een kleine steekproef: meer voorbeelden (screenshot van de labeltelling + link) maken het beter.
- Scripts: `scripts/calibrate/` (`harvest.mjs` draait Stockfish over `cal.json`, `fit.py` fit de formule).
