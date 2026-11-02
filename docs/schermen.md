# ProtoBot · schermskelet (v0.2)

Dit document beschrijft wat de eerste interface-mijlpaal **wel** en **nog niet** doet.

## Navigatie

Splash/start → Leveloverzicht → Opdracht → Programmeren → Testen/spelen → Resultaat.
Vanaf Resultaat kan de leerling terug naar Programmeren of naar het Leveloverzicht.

- **Splash/start**: korte bootanimatie, daarna startknop.
- **Leveloverzicht**: twee beschikbare voorbeeldmissies; voltooiing wordt gemarkeerd. De overige acht missies zijn toekomstig.
- **Opdracht**: achtergrondverhaal, doel en kaartpreview, vóór de programmeeromgeving.
- **Programmeren**: instructiepalet, programmeerketen en kaartpreview. Blokken kunnen per knop worden toegevoegd, verplaatst en verwijderd; het programma wordt opgeslagen.
- **Testen/spelen**: aparte, ruimere spelweergave. De programmeeromgeving wordt een compacte strook met de actieve en volgende instructie. Play, pauze, stap en herstart werken op dezelfde uitvoeringsstatus. Pictogramknoppen zijn voorzien van toegankelijke labels en tooltips.
- **Resultaat**: succes/foutmelding, aantal stappen, programmalengte en terugkoppeling.

## Scheiding van verantwoordelijkheden

`src/game.ts`: levelgegevens, instructietypen en pure stapfunctie.
`src/storage.ts`: veilige lokale opslag, gescheiden per levelrevisie.
`src/main.ts`: schermen, hashrouter, gebruikersacties en timercontroller.
`src/styles.css`: presentatie, responsive schermovergangen en voorlopige robot/terreinillustraties.
`tests/engine.test.mjs`: kleine regressiesuite.

## Bewust nog niet gerealiseerd

- Blockly-rendering en slepen/inspringen, conditionele en geneste blokken.
- Meerdere kaartvarianten per missie en de definitieve levelvalidator.
- Animaties van scanarm, grijper en definitieve sprites.
- Uitgebreide keyboard-editor, Blockly-JSON migratie en volledige A01–A14 acceptatietests.

De voorbeeldprogramma's van beide missies zijn direct testbaar. De pure uitvoeringsstap houdt het toevoegen van Blockly later onafhankelijk van de terreinweergave.
