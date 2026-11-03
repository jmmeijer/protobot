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

## Schermen

- Start: `#/`
- Missieoverzicht: `#/levels`
- Opdracht: `#/level/radiomast`
- Geïntegreerde Blockly-werkruimte en testen: `#/level/radiomast/workspace`
- Resultaat: `#/level/radiomast/result`

De oude `/editor`- en `/play`-routes blijven als verwijzing werken. Missie 1 is direct toegankelijk. Elke volgende missie opent zodra alle eerdere missies zijn behaald. Een directe link naar een gesloten missie leidt naar het missieoverzicht.

De programmeeromgeving gebruikt nu **Blockly**: Nederlandstalige sleepbare blokken, een vast startblok, lokale Blockly-JSON-opslag en automatische migratie van oude instructielijsten. Blockly-blokken worden nu per missie ontgrendeld: rijden en draaien (1), scannen (3), getelde herhaling (4), als/anders en terrein vóór mij (6), pad vrij (7), herhaal totdat en terrein onder mij (8), en op doel? (10). De testmodus toont de huidige en volgende instructie, met afspelen, pauzeren, stap en herstart. De interpreter voert uitsluitend eigen robotinstructies uit, geen gegenereerde JavaScript.

Voortgang en Blockly-programma worden per missie lokaal bewaard. Vanaf missie 6 zijn er meerdere kaartvarianten: hetzelfde Blockly-programma wordt op elke variant getest. De voltooiingsstatus wordt pas toegekend als alle varianten slagen.

Lees [het technisch ontwerp](docs/technisch-ontwerp.md) en [het schermentraject](docs/schermen.md).

## Campaign-ontwikkeling — 10 missies (november 2026)

Alle missies staan in `src/levels.ts`. `src/game.ts` bevat de gedeelde leveltypen en functies `levelVariant`, `variantCount` en `blockAllowed`. Een level beschrijft de basiskaart, optionele kaartvarianten, veilige start- en doelpositie, losstaande objecten, hints, leerdoelen, toegestane Blockly-types, een eventuele bloklimiet en een missielog.

De volgende missies zijn speelbaar: De verlaten radiomast, De laatste wacht, Reparatieprotocol, De lange gang, De meetpost, De overstroomde oever, De lavagrot, De oude waterleiding, Inspectieprotocol en Het tegenstation.

**Meerdere kaarten:** de Blockly-werkruimte compileert één keer. Bij succes op kaart A behoudt de uitvoeringscontroller dezelfde instructies, schakelt de Canvas-kaart om en herstart uitsluitend de robottoestand op kaart B. De speler mag het programma tussentijds niet aanpassen. Pas bij succes op de laatste kaart wordt `completed` opgeslagen. Een eerdere winst wordt bij een levelrevisie opnieuw getoetst; opgeslagen Blockly-JSON blijft bewaard.

**Controle:** `src/level-validation.ts` verifieert rechthoekigheid, bekende terraintegels, veilige start/doelpunten, objectlocaties, unieke ID's en de bereikbaarheid van het doel. Daarnaast voert `tests/campaign-solutions.test.mjs` per missie een referentieprogramma op iedere variant uit. De pure Blockly-interpreter weigert geïnjecteerde, nog niet vrijgegeven blokken en overschrijdingen van de limiet.

**Terrein en objecten:** gras, steen, aarde en zand zijn veilig; water en lava beëindigen een poging; muren zijn onbegaanbaar. Radioposten, sensoren, geigerteller en pomp zijn onafhankelijke kaartobjecten die boven op het terrein worden getekend. Beide typen veroorzaken geen onbedoelde wijziging van de terreinsensor.

Zie [het missieontwerp](docs/leveldesign.md) voor de complete didactische reeks.

## Publiceren

De workflow bouwt en test iedere pull request gericht op `main`. **Elke push naar `main` (waaronder een merge) publiceert na geslaagde build en tests automatisch de inhoud van `dist/` naar GitHub Pages.** Handmatig starten via `workflow_dispatch` op `main` blijft ook mogelijk. Stel onder Settings → Pages de bron in op **GitHub Actions**; er hoeft geen map te worden geselecteerd.

## Geïntegreerde programmeer- en testwerkruimte

De voormalige afzonderlijke programmeer- en testpagina's zijn samengevoegd in `#/level/<id>/workspace`. De oude `/editor`- en `/play`-links blijven werken als verwijzing naar dezelfde werkruimte.

- **Programmeren:** Blockly krijgt ongeveer 65% van de breedte; de kaart rechts blijft zichtbaar.
- **Testen:** Blockly blijft met alle eigen blokken in beeld, maar wordt vergrendeld. Het palet verdwijnt en de kaart krijgt ongeveer 65% van de breedte.
- Het **actieve Blockly-blok** krijgt een turquoise rand en het komende blok een subtielere markering. De markering blijft staan tijdens robotanimaties en pauzeren.
- De Blockly-toolbox en flyout gebruiken een eigen donker ProtoBot-thema met hoog contrast.
- De overgang tussen beide modi bouwt geen nieuwe Blockly-workspace of Canvas op. Op mobiel worden de panelen gestapeld: in testmodus komt de kaart bovenaan.

## Vloeiende beweging bij het testen

De Blockly-uitvoering houdt het speelveld nu permanent gemount: de robot rijdt in 540 ms van tegel naar tegel, draait in 380 ms over de kortste kwartslag en toont bij sensorinstructies een kleine scanpuls. Pauzeren bevriest de beweging halverwege; afspelen hervat vanaf dezelfde positie. De huidige en volgende instructie en HUD worden afzonderlijk bijgewerkt, zonder het hele scherm opnieuw te renderen. De instelling voor verminderde beweging wordt gerespecteerd.

Meer informatie: [robotanimaties](docs/robot-animations.md).

## Kaartlab (grafisch prototype)

Open de app en kies op het missieoverzicht **KAARTLAB: TEST TERREINEN**, of ga rechtstreeks naar `#/map-prototype`. Het Kaartlab is een afzonderlijke testomgeving en verandert bestaande missies of programma's niet.

- Eén WebP texture atlas (`src/assets/terrain-atlas.webp`) met zes basissoorten: gras, steen, aarde, zand, water en lava. De pixels worden op de gewenste schermgrootte getekend.
- Responsieve Canvas-renderer met `devicePixelRatio`, zonder beeldvervaging (`imageSmoothingEnabled = false`).
- **8-neighbor autotiling** met 47 herbruikbare pixelmaskers voor randen en hoeken. Via een visuele terreinprioriteit wordt iedere grens maar aan één kant als overlay getekend, zodat dubbele randen verdwijnen.
- Terreinen schilderen door eerst een type en daarna een vak te kiezen; de raster- en overgangslaag zijn aan/uit te zetten.
- Twee voorbeeldkaarten en een transparante top-down robotafbeelding om schaal en rotatie te beoordelen.

## Autotiling in de speelbare levels

De missiekaarten (overzicht, opdracht, Blockly-editor en speelscherm) gebruiken nu dezelfde WebP-atlas en dezelfde 8-buren/47-masker Canvas-renderer als Kaartlab. Muren behouden hun spelbetekenis als obstakel en krijgen een herkenbaar pictogram boven op steenterrein. De doelmarkering en ProtoBot worden bovenop het terrein getekend; bij testen volgt de robotpositie en -richting de bestaande interpreter zonder wijzigingen aan opgeslagen programma's.

De grafische laag is bewust gescheiden van de simulatie. Er is dus geen levelrevisie of migratie nodig; alleen de tekening verandert. Het speelveld is responsief en laadt het terrein en de robotsprite één keer per browserbezoek. Bij niet-beschikbare afbeeldingen blijft een gekleurde fallbackkaart zichtbaar.

De atlas is geoptimaliseerde **lossless WebP** (palet beperkt voor pixelart). De originele gegenereerde illustraties blijven buiten de bundle; definitieve handgetekende maskers, extra terreindecoraties en robuuste keyboardbewerking volgen later.

Meer technische details: [autotiling en overgangsmaskers](docs/autotiling.md).

Meer details over de editor: [Blockly-integratie](docs/blockly.md).
