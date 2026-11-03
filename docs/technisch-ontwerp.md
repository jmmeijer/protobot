# ProtoBot · Rover Protocol
Technisch ontwerp 1.1 | 2 november 2026 | Basis: functioneel ontwerp 1.4

## 1. Architectuur en scope
Een leerling van 12–16 bouwt in de browser een programma dat ProtoBot over aaneengesloten terreintegels naar één eindtegel leidt. GitHub Pages levert HTML, scripts, levels en illustraties via HTTPS. Een missie heeft tijdens uitvoering geen serververbinding nodig. De eerste keer openen vereist netwerktoegang. Er zijn geen accounts.
De repository bevat de bouwstraat en een startscherm. Onderstaande modules beschrijven het implementatiedoel. De eerste mijlpaal bevat twee missies, daarna groeit de campagne naar de tien levels uit het functioneel ontwerp.

## 2. Onderdelen en gegevensstroom
Editor (Blockly) → vertaler → instructies met blok-ID → interpreter → stapresultaat → Canvas, sensorpaneel en blokmarkering. De interface stuurt start, pauze, stap en herstart naar één uitvoeringscontroller.
De editor leest alleen de keten aan het vaste startblok. De vertaler valideert de toegestane bloktypen, geneste takken, verplichte condities en herhaalaantallen (1–20). Losse blokken blijven zichtbaar maar worden niet uitgevoerd. Een onvolledige gekoppelde conditie krijgt bij Start een melding op het betreffende blok.
De interpreter accepteert alleen eigen instructies: rijden, draaien, conditie testen en springen. Hij voert geen gegenereerde JavaScript uit. Elke instructie behoudt de ID van het Blockly-blok voor de stapmodus. De renderer leest het resultaat en verandert nooit de speltoestand.

## 3. Levelcontract en controle
Een level heeft een stabiel id, revisie, Nederlandstalige opdracht, toegestane blokken, optionele bloklimiet, hints, één of meer kaarten en een missieafloop. Elke kaart legt terrein, obstakels, objecten, startpositie met kijkrichting en doelpositie apart vast.
Voorbeeld: kaart van drie kolommen en twee rijen. Bovenrij gras, gras, water. Onderrij steen, zand, water. Start op (0,0) naar het oosten, doel op (1,1) bij een pomp. Rij vooruit, draai rechts, rij vooruit. De pomp speelt automatisch haar afloop bij aankomst.
Posities tellen vanaf linksboven. Oost verhoogt x, zuid verhoogt y. De levelcontrole weigert ongelijke rijlengten, onbekend terrein, posities buiten het raster, samenvallende start en doel of een onveilig eindvak. Een zoekactie via de vier buren controleert bereikbaarheid. Een referentieprogramma moet bovendien met toegestane blokken op alle varianten slagen.

## 4. Uitvoering en foutafhandeling
Een poging bewaart positie, richting, instructiepointer, lustellers, laatste blok-ID, aantal stappen en status. Eén zichtbare stap is één actie of conditietest. Interne sprongen tellen niet dubbel. Ook een lege lus verbruikt bij elke test één stap.
Een draai verandert de richting met 90 graden. Bij muur of veldrand blijft ProtoBot staan en stopt de poging. Bij water of lava betreedt hij de tegel en stopt direct met een terreinspecifieke melding. Bij aankomst op het doel stopt de interpreter onmiddellijk, ook als er nog blokken volgen. De missieafloop speelt één keer. Stopt het programma elders, dan is de route onvolledig. Na maximaal 500 zichtbare stappen stopt een nog actieve poging.
Een terreinconditie vergelijkt de tegel vóór of onder de robot met gras, steen, aarde, zand, water of lava. Voor een muur of rand is een terreinvergelijking onwaar. Een test verandert de positie niet. De gecombineerde sensor ‘pad vrij?’ is alleen waar voor een veilige tegel zonder obstakel.
Pauze behoudt de instructiepointer en lustellers. Stap voert één overgang uit en pauzeert opnieuw. Bewerken tijdens pauze en Herstart annuleren de geplande uitvoering en herstellen de beginwereld. Een nieuw pogingnummer voorkomt dat een oude animatie na een herstart nog feedback schrijft.
Bij meerdere kaarten begint elke variant met hetzelfde programma en een nieuwe speltoestand. Alleen wanneer alle varianten slagen krijgt het level de status behaald.

## 5. Bediening, opslag en illustraties
Desktop toont palet, programma en speelveld naast elkaar. Op mobiel wisselt de leerling tussen editor en veld. Selecteer een invoegplek en tik op een blok als alternatief voor slepen. Ondersteun toetsenbordbediening bij toevoegen, verplaatsen en verwijderen, ook in geneste takken. Toon de actieve instructie en sensorwaarde eveneens als tekst.
Canvas schaalt op schermdichtheid. Gebruik compacte sprites voor vier richtingen en terrein met kleur én patroon. De grote splashillustratie hoort op het beginscherm. De scanarm geeft visuele feedback bij een test, de grijper bij de missieafloop. Animatiesnelheid heeft geen invloed op de route.
Bewaar per level Blockly-JSON, levelrevisie en status onder een sleutel met prefix protobot:v1:. Schrijf na een bewerking en succesvolle afronding. Bewaar een eenmaal behaalde status tijdens opnieuw oefenen. Bij onleesbare data begint alleen het getroffen level opnieuw. Bij een onbekende revisie valideert de app eerst de blokken. Bij geweigerde opslag blijft de huidige sessie werken met een zichtbare melding.

## 6. Hosting, verificatie en oplevering
Node.js 26 LTS en het npm-lockbestand leggen de bouwomgeving vast. npm ci installeert afhankelijkheden. npm run build voert de typecontrole uit en schrijft dist/. Vite gebruikt /protobot/ als basis. Gebruik een hashroute zoals /protobot/#/level/rivieroever, zodat herladen de bestaande indexpagina opent. Bundel Blockly, taalbestanden en benodigde media met de site. De Pages-workflow publiceert alleen bij een handmatige start vanaf main met Pages ingesteld op GitHub Actions.
Test de interpreter zonder browser: draai op de plaats, geneste lussen, lege lus, water/lava, muur, stap 500 en een extra instructie na de eindtegel. Vergelijk dezelfde uitvoering in stapmodus en op volle snelheid. Controleer alle kaarten met hun referentieprogramma.
Controleer in een browser een directe levellink, verversen na bewerken, geblokkeerde opslag en twee varianten waarvan één faalt. Test in een venster van 360 px én op een echte telefoon een geneste als/anders-tak met tikbediening. Test dezelfde opdracht uitsluitend met het toetsenbord. Koppel deze controles aan A01–A14 uit het functioneel ontwerp.
Eerste speelbare oplevering: radiomast met bewegen en draaien, daarna rivieroever met een terreinconditie op twee kaarten. Pas na deze praktijktest volgen de overige acht levels en definitieve sprites.


## 7. Implementatie-update: volledige campagne

De eerste release van tien missies gebruikt de structuur zoals beschreven in [het missieontwerp](leveldesign.md). Alle leveldata en kaartvarianten staan in `src/levels.ts`. De toegestane codeblokken worden per missie bepaald en zowel in het palet als de interpreter gecontroleerd. Een bloklimiet telt uitsluitend de verbonden blokken, zonder startblok. Visuele objecten zijn los van het terrein opgeslagen.

De uitvoeringscontroller in `src/main.ts` gebruikt één compileerstap voor meerdere kaartvarianten. Hij toont het resultaat per kaart en voltooit de missie pas wanneer alle kaarten slagen. De CanvaS-renderer wisselt van kaart zonder de Blockly-werkruimte te vernietigen. De Node-tests simuleren alle referentieprogramma's voor alle kaarten en controleren metadata en migratie van opgeslagen voortgang.
