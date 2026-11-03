## Blockly in ProtoBot

De programmeerwerkplek gebruikt nu de echte Blockly-workspace, met Nederlandstalige blokken en een vast startblok. Leerlingen kunnen instructies slepen, koppelen, herschikken en verwijderen. Level 1 heeft beweging en scannen; level 2 biedt ook sensorvoorwaarden, als/anders, herhaal N keer (1–20) en herhaal totdat.

### Opslag en migratie

Blockly-JSON wordt met de ingebouwde workspace-serializer opgeslagen onder dezelfde lokale sleutel als de vorige prototype-editor (prefix protobot:v1:). Reeds opgeslagen platte instructielijsten worden automatisch omgezet. Een eenmaal behaalde levelstatus blijft behouden. Bij ontbreken van lokale opslag werkt de sessie in het geheugen door.

### Veilige uitvoering

De game voert geen door Blockly gegenereerde JavaScript uit. De vertaler leest uitsluitend de instructieketen onder het vaste startblok en bouwt een beperkte instructielijst met Blockly-blok-ID's. Losse blokken blijven zichtbaar maar worden niet uitgevoerd. Ontbrekende sensorvoorwaarden, ongeldige bloktypen en herhaalaantallen worden afgewezen met een blokgerichte melding. Eén zichtbare stap is één actie of conditietest; interne sprongen tellen niet mee. Pauze bewaart de huidige instructiepointer en lusstatus. Na 500 stappen stopt een actieve poging.

De code is gescheiden in src/blockly-editor.ts (UI en JSON), src/program.ts (vertaling en uitvoering), src/storage.ts (lokale opslag) en src/main.ts (schermen/uitvoeringsknoppen). Blockly wordt pas geladen bij het programmeerscherm.

### Controles

Een build controleert TypeScript en de Vite-bundel; npm test voert onder meer tests uit voor migratie, if/else, geneste lussen, gevaarlijke tegels, foutieve condities en staplimiet. Controleer daarnaast in een echte browser: blokken slepen op desktop en mobiel, werkruimte na herladen, de prullenbak, het toetsenbord, en de overgang programmeren → testen → resultaten. Het uitwerken van alle tien missies en meerdere kaartvarianten volgt later.
