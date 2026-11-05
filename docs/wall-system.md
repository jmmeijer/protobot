# Modulaire industriële muren — ProtoBot

Dit is een eerste, bewust visueel te beoordelen implementatie van de nieuwe **zesdelige structurele muur-atlas**. Kaartlogica en robotbotsingen blijven onafhankelijk van de muurafbeeldingen.

## Assets

- `src/assets/wall-structure.webp`: 768 × 512 pixels, 3 kolommen × 2 rijen, 256 × 256 px per cel.
- Bron: de transparante muur-atlas uit de ProtoBot-ontwerpsessie, geoptimaliseerd naar WebP.
- Vakken (kolom, rij):
  - `straight` (0,0)
  - `inner_corner` (1,0)
  - `outer_corner` (2,0)
  - `end_cap` (0,1)
  - `doorway` (1,1)
  - `damaged_opening` (2,1)

De basismuren hebben nu **geen automatisch gerandomiseerde decoraties**. Buizen, posters, lampen, radiatoren en puin zijn de volgende, zelfstandige laag. De huidige atlas heeft wel ingebakken slijtage en enkele kleine metalen constructiedetails; voor een volledig naadloze set zullen deze nog genormaliseerd moeten worden.

## Muurselectie

`src/wall-topology.ts` kiest de zichtbare structurele sprite. De selectie is een pure functie van vier muur-buren:

- Twee tegenoverliggende muur-buren: recht segment, gedraaid afhankelijk van de beloopbare zijde.
- Twee aangrenzende muur-buren: binnen- of buitenhoek; de diagonale hoekcel beslist.
- Eén buur of geïsoleerde muur: eindstuk.
- Drie muur-buren: recht segment langs de zichtbare muurzijde.
- Vier muur-buren: alleen onderliggende materiaaltextuur; geen onnodige decoratie in het binnenste van een massieve muur.

Alle rotaties zijn stappen van 90 graden. De atlas wordt op 128 × 128 px per rastervak getekend, met nearest-neighbour zonder smoothing. Muurstructuren worden op de offscreen statische Canvas-laag gebouwd, zodat de bestaande robotanimatie niet opnieuw getekend of onderbroken hoeft te worden.

De natuurlijke grotwanden van `meetpost` en `lavagrot` blijven bewust hun eerdere materiaal gebruiken. De nieuwe onderdelen worden op technische/industriële muurcellen geplaatst.

## Lange gang

Missie `lange-gang`, revisie 2:

```text
#########
ssssssss#
#########
```

De oorspronkelijke start (1,1), bestemming (7,1), richting en opdracht **herhaal 6 keer: vooruit** blijven onveranderd. Cel (0,1) is nu een **begaanbare westelijke ingang**. Het deurkader wordt als een apart `wallFeatures`-object met rotatie 90° bovenop deze vloertegel getekend. Het is niet langer een solide obstakel.

## Muurlab

Open `#/wall-lab` op GitHub Pages om de zes losse delen in vier rotaties te vergelijken en de lange gang automatisch samengesteld te bekijken. Het Muurlab is ook bereikbaar vanaf het missieoverzicht, onafhankelijk van ontgrendelde missies.

Handmatige controles:

1. Sluiten rechte wanden en hoeken visueel op elkaar aan, zonder transparante kieren?
2. Klopt de schaduw/lichtval na een rotatie van 90°, 180° en 270°?
3. Blijft de opening van het deurkader vrij en zijn beide zijden duidelijk zichtbaar?
4. Bedekt de muur de gameplay-vloertegels niet of leidt de spritevorm tot visuele verwarring?
5. Is de huidige afbeelding voldoende orthografisch? De bronafbeelding bevat mogelijk perspectief-effecten.

**Belangrijk:** de programmatests controleren atlasindeling, geometrische selectie, deurpositie en bereikbaarheid, niet of gegenereerde afbeeldingen pixelperfect aansluiten. Daarvoor is de Muurlab-browserpreview bedoeld.

## Experimenteel bovenaanzicht uit Work

De nieuwe kandidaat-sprites staan in `src/assets/wall-topdown-study.webp`:
acht vakken van 256 × 256 pixels in een 4 × 2 atlas. De oorspronkelijke afbeelding had
een lichte achtergrond, die met een gecontroleerde chroma-key is verwijderd.
Deze atlas is bedoeld om stijl en perspectief te testen, niet als bewijs van naadloze aansluiting.

De huidige zesdelige structurele atlas blijft ongewijzigd in de echte levels.
Via `#/wall-lab` is een nieuwe vergelijkingssectie toegevoegd met:
- de acht losse bovenaanzicht-sprites (zes muurvarianten, een kast en puin);
- een proef met een **doorlopende geometrische muur** en drie uitgesneden technische
  decoraties uit de nieuwe atlas;
- ter vergelijking daaronder de huidige muurweergave van de lange gang.

De verbindingsgeometrie wordt in `src/wall-topdown-study.ts` getekend op basis van
buren in de oorspronkelijke murenkaart. Alle lijnen eindigen exact op het midden van
de tegelgrens. Bevestigingsmiddelen worden alleen aan échte uiteinden getekend, niet
op iedere cel. Dit maakt de basis technisch aansluitbaar zonder te vertrouwen op
fotografische sprite-randen.

**Nog niet productiegeschikt:** het experiment is een visuele prototype-renderer,
geen afgewerkte productie-muurset. Eventuele stijlverschillen tussen de programmeerbare
basis en de decoraties moeten eerst worden beoordeeld. De kast en het puin zijn
nu alleen in het Muurlab te zien; obstakels/collisions zijn niet aangepast.

## Hybride productieproef: tegelgrens in plaats van middenlijn

Voor missie 4 (`lange-gang`) wordt de eerder geteste middenlijn-renderer
vervangen door `drawHybridWallFaces`. De renderer zoekt de aaneengesloten
**zichtbare grens tussen een onbegaanbare muurcel en een beloopbare vloercel**
en tekent voor ieder doorlopend stuk één metaal-/betonband. De band gebruikt
echte textuurfragmenten van de Work-bovenaanzicht-atlas, maar geen ingebakken
eindpilaren. De vier oriëntaties zijn één geometrie met 90°-rotaties.

De twee rechterhoeken in de lange gang zijn gezamenlijke eindpunten van
respectievelijk horizontale en verticale grenssegmenten. Op die punten komt
één verbinding; op de linker twee vrije eindpunten een eenvoudige deurpost.
Radiator, wandpaneel en rooster worden als afzonderlijke overlays geplaatst.

De botsingskaart, de startpositie (1,1), het doel (7,1), de programmeeropdracht,
de Blockly-werkruimte en de robotanimaties blijven onveranderd.

Het Muurlab toont zowel de nieuwe hybride gang als de oude complete
muursprites. Pas na visuele beoordeling kan deze techniek naar andere
technische levels worden uitgebreid. De atlas zelf is nog niet als strikt
naadloze tileset bewezen.
