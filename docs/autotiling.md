# ProtoBot Kaartlab – 8-neighbor autotiling (prototype)

De kaartlogica blijft een raster van terrein-ID's. De renderer kiest op basis van de acht buurcellen welke terrein-overlays zichtbaar worden. Een overgang verandert **nooit** het terreintype of de bewegingregels van een cel.

## Renderlagen

1. Teken op iedere rasterpositie één onbewerkte basisterreintextuur uit `terrain-atlas.webp`.
2. Verzamel voor elke cel de hogere-prioriteitterreinen onder de acht buren. Gebruik `autotileLayers()`.
3. Normaliseer iedere 8-bits buurconfiguratie tot een 47-blob-masker: diagonalen mogen alleen meetellen als beide aansluitende kardinale buren overeenkomen.
4. Bouw met `makeAutotileMask()` een hard 32 × 32 alpha-masker (0 of 255), schaal zonder interpolatie naar de 128 × 128 texture-cel en teken de gemaskeerde buurtextuur over de basistegel.
5. Teken raster, spelobjecten en robot pas na de ondergrondlagen.

De actuele visuele volgorde is `grass < dirt < sand < stone < water < lava` en dient alleen om dubbele overgangen te voorkomen. Een grens wordt hierdoor uitsluitend op de *lagere*-prioriteitscel als overlay getekend. **Niet** beide aangrenzende tegels tekenen een volledige rand: er is precies één eigenaar per grens. De 47 buurvormen zorgen ervoor dat randen en hoeken dezelfde topologie volgen.

## Stabiliteit

Het pixelpatroon van de randen is deterministisch uit wereldcoördinaten en het terreintype afgeleid. Een resize, repaint of wijziging elders op de kaart verandert dus niet de resterende randen. Maskers worden in offscreen-canvassen samengesteld; `imageSmoothingEnabled = false` voorkomt geblurde transparantieranden.

## Grenzen van deze iteratie

- De maskers zijn procedureel, geen handgeschilderde atlasmaskers. De huidige brontexturen zijn nog niet gegarandeerd naadloos herhaalbaar; een zichtbare herhaling in grote uniforme gebieden staat los van de autotile-overgangen.
- Het maskerpatroon is 32 × 32 en de visual priority is globaal; bijzondere natuurkundige combinaties (zoals stromend water tegen lava) kunnen later eigen overgangstegels krijgen.
- Dit is alleen actief in `#/map-prototype`. De missies gebruiken voorlopig hun bestaande renderer.

## Tests

De tests verifiëren de 47 verschillende normalisaties, de 47 verschillende pixelmaskers, alleen-diagonale contacten, binnen-/buitenhoekgevallen, gelaagde prioriteiten, determinisme en één eigenaar per grens voor alle zes terreintypen in beide assen.
