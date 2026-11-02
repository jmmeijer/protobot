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

De workflow bouwt en test iedere pull request gericht op `main`. **Elke push naar `main` (waaronder een merge) publiceert na geslaagde build en tests automatisch de inhoud van `dist/` naar GitHub Pages.** Handmatig starten via `workflow_dispatch` op `main` blijft ook mogelijk. Stel onder Settings → Pages de bron in op **GitHub Actions**; er hoeft geen map te worden geselecteerd.

## Kaartlab (grafisch prototype)

Open de app en kies op het missieoverzicht **KAARTLAB: TEST TERREINEN**, of ga rechtstreeks naar `#/map-prototype`. Het Kaartlab is een afzonderlijke testomgeving en verandert bestaande missies of programma's niet.

- Eén WebP texture atlas (`src/assets/terrain-atlas.webp`) met zes basissoorten: gras, steen, aarde, zand, water en lava. De pixels worden op de gewenste schermgrootte getekend.
- Responsieve Canvas-renderer met `devicePixelRatio`, zonder beeldvervaging (`imageSmoothingEnabled = false`).
- Automatische, voorlopig procedurale overgangen aan vier randen van verschillende terreintypen. Geen definitief 47-tile autotile-systeem.
- Terreinen schilderen door eerst een type en daarna een vak te kiezen; de raster- en overgangslaag zijn aan/uit te zetten.
- Twee voorbeeldkaarten en een transparante top-down robotafbeelding om schaal en rotatie te beoordelen.

De atlas is geoptimaliseerde **lossless WebP** (palet beperkt voor pixelart). De originele gegenereerde illustraties blijven buiten de bundle; definitieve varianten, nette hoekovergangen en robuuste keyboardbewerking volgen later.
