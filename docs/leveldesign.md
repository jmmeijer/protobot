# Leveldesign en didactische opbouw — ProtoBot

De campagne is gericht op leerlingen van 12 tot 16 jaar. De moeilijkheid neemt toe door grotere programmeerconcepten en niet uitsluitend door langere routes. Elk level heeft een stabiele ID en kan door een docent rechtstreeks worden geopend.

| Missie | Titel | Nieuwe kernvaardigheid | Opdracht en test |
|---|---|---|---|
| 1 | De verlaten radiomast | Volgorde, rijden en draaien | Bereik het eerste controlepaneel |
| 2 | De laatste wacht | Routes met bochten | Bereik de veldtas en berg een geigerteller |
| 3 | Reparatieprotocol | Debuggen, stapmodus en scannen | Repareer de verkeerde draai |
| 4 | De lange gang | Herhaal N keer | Zes vakken afleggen met maximaal twee blokken |
| 5 | De meetpost | Herhaling van meerdere acties | Herhaal een trapvormig bewegingspatroon |
| 6 | De overstroomde oever | Als/anders, terrein vóór mij | Eén programma op twee verschillende oevers |
| 7 | De lavagrot | Pad vrij? en veilig kiezen | Twee varianten met verschillende lavastromen |
| 8 | De oude waterleiding | Herhaal totdat, terrein onder mij | Stop bij de zandmarkering op twee leidinglengten |
| 9 | Inspectieprotocol | Foutieve herhaalteller debuggen | Herstel het foutieve programma vóór het water |
| 10 | Het tegenstation | Gecombineerde algoritmen | Eén programma op drie doorgangen |

## Vrijgave

- Vanaf 1: vooruit, links, rechts
- Vanaf 3: scan vooruit
- Vanaf 4: herhaal N keer
- Vanaf 6: als, als/anders, terrein vóór mij is ...
- Vanaf 7: pad vrij vooruit?
- Vanaf 8: herhaal totdat, terrein onder mij is ...
- Vanaf 10: op doel?

Alle voorgaande blokken blijven beschikbaar. De vrijgave is afhankelijk van de gekozen missie, niet van voltooiing van eerdere levels.

## Regels

- Startblokken tellen niet mee voor optionele bloklimieten.
- De compiler valideert alle verbonden blokken (ook in geneste lussen en voorwaarden).
- Een los blok wordt niet uitgevoerd; dit blijft zichtbaar in het programma.
- Water en lava veroorzaken direct een mislukte poging. Een muur of veldrand kan niet worden betreden.
- Voor `pad vrij?` telt alleen een bereikbare en niet-gevaarlijke tegel.
- `tegel vóór mij` en `tegel onder mij` lezen het basisterrein, nooit een los object.
- De missie stopt automatisch wanneer de robot het eindvak bereikt.
- Bij meerdere kaarten wordt dezelfde gecompileerde blokkenstructuur hergebruikt. Alle varianten moeten slagen.
- Iedere levelrevisie vraagt om een nieuwe voltooiing. Het eerder opgeslagen programmeerwerk blijft beschikbaar.
- Drie stapsgewijze hints helpen zonder direct alle code voor te schrijven.

## Technische bestanden

- `src/levels.ts`: campagne met missies, kaarten, objecten, doelen en verhaal
- `src/game.ts`: types en helpers voor levelvarianten
- `src/program.ts`: whitelist, condities, bloklimieten en interpreter
- `src/level-validation.ts`: controle van raster, objecten en bereikbaarheid
- `src/level-canvas.ts`: terrein- en objectlagen op Canvas
- `src/main.ts`: kaartreeks, bediening, hints, resultaten en progressie
- `tests/campaign-solutions.test.mjs`: referentieprogramma's op alle kaarten

## Teststrategie

Voeg aan een nieuwe missie altijd een referentieprogramma toe aan de testset. Alle kaartvarianten moeten door hetzelfde programma opgelost kunnen worden. Bouw moet groen zijn op Node 26, inclusief de bestaande Blockly- en autotilingtests. Controleer daarna in een browser handmatig de pauzestand, paneelverschuiving, wisselende kaart en markering van het actieve Blockly-blok.

## Vervolg

Mogelijke uitbreidingen: alternatieve routeoplossingen, omgevingsgeluid, handgemaakte object-sprites, duidelijke gesproken foutmeldingen, tussentijdse leerdoelreflectie en aanvullende docentopties.
