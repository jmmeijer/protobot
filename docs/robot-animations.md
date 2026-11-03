# Vloeiende robotanimatie in de speelmodus

De Blockly-interpreter blijft deterministisch: één instructie levert een nieuwe logische positie en richting op. De animatie interpoleert tussen de oude en nieuwe toestand en verandert nooit de levelkaart of interpreter.

## Architectuur

- Statische laag (`src/level-canvas.ts`): de bestaande 47-masker-autotiling tekent terrein, muur en doel op een offscreen-Canvas. Dit wordt uitsluitend herberekend bij resize en het laden van afbeeldingen.
- Dynamische laag (`src/robot-motion.ts`): `requestAnimationFrame` interpoleert het robotmiddelpunt met smoothstep-easing en kiest de kortste kwartslag; sensorinstructies tonen een scanpuls.
- Uitvoeringscontroller (`src/main.ts`): de volgende Blockly-instructie wordt pas uitgevoerd nadat de animatie voltooid is. Alleen de rail, HUD en bedieningsknoppen worden bijgewerkt, zonder volledige schermvervanging.
- Pauzeren bevriest de animatie exact waar de robot staat. Hervatten zet dezelfde animatie voort. Stapmodus voert één instructie uit.
- Herstart of navigatie invalideert alle lopende animaties via een generation-token; oude callbacks kunnen geen robotpositie meer terugzetten.
- Bij `prefers-reduced-motion: reduce` is de overgang direct, zonder animatie.

## Snelheden

- Rijden: 540 ms per tegel.
- Draaien: 380 ms per kwartslag.
- Sensor of conditietest: 230 ms.
- Tussen instructies: 90 ms.
- Resultaatscherm: 850 ms na afloop.

## Controleren

Geautomatiseerde tests controleren interpolatie, draaibaan, easing, sensorpuls en reduced-motion. Test daarnaast handmatig: vooruitrijden, draaien, pauzeren halverwege, hervatten, één stap, herstart tijdens een beweging, schermformaat wijzigen tijdens beweging, en succes/falen.


## Werkruimte zonder herladen

De oorspronkelijke aparte programmeer- en testschermen zijn verenigd. Het
omschakelen naar testmodus laat zowel Blockly als het speel-Canvas gemount.
De kaart schaalt mee met het CSS Grid; het terrein wordt eenmaal op een
statische buffer met 128 pixels per tegel getekend en bij paneelgroei geschaald.
De dynamische robotpose blijft in logische tegelcoördinaten en wordt dus niet
verstoord door een layoutovergang.
