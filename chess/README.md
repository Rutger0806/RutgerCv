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
