# ProtoBot · Rover Protocol

Een Nederlandstalig programmeerspel voor leerlingen van 12–16 jaar. Programmeer ProtoBot met blokken en help hem door verlaten locaties.

## Starten

Gebruik **Node.js 26 LTS** en npm:

```bash
nvm use
npm ci
npm run dev
```

`npm run build` controleert TypeScript en maakt `dist/`. `npm test` test de eerste deterministische uitvoeringsstappen. De app werkt statisch op GitHub Pages met de basisroute `/protobot/`.

## Schermen (eerste skeleton)

1. Splash/start: `#/ ` (zonder spatie: `#/`)
2. Leveloverzicht: `#/levels`
3. Opdracht: `#/level/radiomast`
4. Programmeren: `#/level/radiomast/editor`
5. Testen/spelen: `#/level/radiomast/play`
6. Resultaat: `#/level/radiomast/result`

Ook `rivieroever` bestaat als tweede level. Directe hashlinks werken bij GitHub Pages zonder serverrouter.

De programma-editor biedt nu **klikbare voorbeeldblokken** (toevoegen, volgorde wijzigen, verwijderen) en is bewust nog geen Blockly-workspace. De uitvoermodus laat de **huidige en volgende stap** zien, met pictogrammen voor afspelen, pauzeren, één stap en herstarten. Een kleine, veilige TypeScript-interpreter verwerkt de vier eerste instructies. Er wordt geen gegenereerde JavaScript geëvalueerd.

Voortgang en programma worden per missie lokaal bewaard. De code om Blockly te integreren, condities en lussen te implementeren, kaartenvarianten uit te voeren en definitieve illustraties toe te voegen is een vervolgstap.

Lees [het technisch ontwerp](docs/technisch-ontwerp.md) en [het schermentraject](docs/schermen.md).

## Publiceren

De workflow draait bij push/pull request een build en tests. Kies GitHub Actions als Pages-bron in de repositoryinstellingen en start de Pages-workflow handmatig vanaf `main` om te publiceren.
