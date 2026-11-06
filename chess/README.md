# Rutger Schaak

Eigen schaaktrainer (Vite + TypeScript, Stockfish 19 in WebAssembly, chessground, chess.js). Geen server nodig; data staat in je browser (`localStorage`, back-up via Instellingen).

```bash
npm install
npm run dev      # ontwikkelen
npm run build    # statische site in dist/ (werkt vanaf elke host)
```

- **Analyse**: PGN plakken, of partijen ophalen van Chess.com/Lichess. Per zet: evaluatie, classificatie (beste … blunder), nauwkeurigheid, evaluatiegrafiek, live engine-lijnen en een proefmodus. Fouten opslaan als puzzels.
- **Openingen**: ~3.900 ECO-openingen (Lichess-data). Verkennen met boekzetten, repertoire samenstellen (wit/zwart) en oefenen met willekeurige tegenstander-zetten en hints.
- **Theorie & puzzels**: eindspelen spelen tegen Stockfish (Lucena, Philidor, matpatronen…), eigen fouten met spaced repetition, Lichess-puzzels importeren.

Openingsdata verversen: `node scripts/build-openings.mjs`.
