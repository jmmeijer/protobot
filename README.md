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

De programmeeromgeving gebruikt nu **Blockly**: Nederlandstalige sleepbare blokken, een vast startblok, lokale Blockly-JSON-opslag en automatische migratie van oude instructielijsten. Missie 1 heeft bewegen en scannen; missie 2 heeft ook sensorvoorwaarden, als/anders en herhalingen. De testmodus toont de huidige en volgende instructie, met afspelen, pauzeren, stap en herstart. De interpreter voert uitsluitend eigen robotinstructies uit, geen gegenereerde JavaScript.

Voortgang en Blockly-programma worden per missie lokaal bewaard. Meerdere kaartvarianten en definitieve animaties zijn vervolgstappen.

Lees [het technisch ontwerp](docs/technisch-ontwerp.md) en [het schermentraject](docs/schermen.md).

## Publiceren

De workflow bouwt en test iedere pull request gericht op `main`. **Elke push naar `main` (waaronder een merge) publiceert na geslaagde build en tests automatisch de inhoud van `dist/` naar GitHub Pages.** Handmatig starten via `workflow_dispatch` op `main` blijft ook mogelijk. Stel onder Settings → Pages de bron in op **GitHub Actions**; er hoeft geen map te worden geselecteerd.

## Kaartlab (grafisch prototype)

Open de app en kies op het missieoverzicht **KAARTLAB: TEST TERREINEN**, of ga rechtstreeks naar `#/map-prototype`. Het Kaartlab is een afzonderlijke testomgeving en verandert bestaande missies of programma's niet.

- Eén WebP texture atlas (`src/assets/terrain-atlas.webp`) met zes basissoorten: gras, steen, aarde, zand, water en lava. De pixels worden op de gewenste schermgrootte getekend.
- Responsieve Canvas-renderer met `devicePixelRatio`, zonder beeldvervaging (`imageSmoothingEnabled = false`).
- **8-neighbor autotiling** met 47 herbruikbare pixelmaskers voor randen en hoeken. Via een visuele terreinprioriteit wordt iedere grens maar aan één kant als overlay getekend, zodat dubbele randen verdwijnen.
- Terreinen schilderen door eerst een type en daarna een vak te kiezen; de raster- en overgangslaag zijn aan/uit te zetten.
- Twee voorbeeldkaarten en een transparante top-down robotafbeelding om schaal en rotatie te beoordelen.

De atlas is geoptimaliseerde **lossless WebP** (palet beperkt voor pixelart). De originele gegenereerde illustraties blijven buiten de bundle; definitieve handgetekende maskers, extra terreindecoraties en robuuste keyboardbewerking volgen later.

Meer technische details: [autotiling en overgangsmaskers](docs/autotiling.md).

Meer details over de editor: [Blockly-integratie](docs/blockly.md).
