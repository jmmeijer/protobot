import type { BlockType, Level, Tile, Direction, MapVariant, MissionObject } from './game.ts';

/** Human-readable maps: # wall, g grass, s stone, d dirt, a sand, w water, l lava. */
const charTile: Record<string,Tile> = { '#':'wall',g:'grass',s:'stone',d:'dirt',a:'sand',w:'water',l:'lava' };
function terrain(...lines:string[]): Tile[][] {
  return lines.map(line => [...line].map(c => {
    if (!charTile[c]) throw new Error('Onbekende terreinletter: '+c);
    return charTile[c];
  }));
}
function robot(x:number,y:number,direction:Direction='E') { return {x,y,direction}; }
function target(x:number,y:number) { return {x,y}; }
function item(type:MissionObject['type'],x:number,y:number,label:string):MissionObject {return {type,x,y,label};}
function blocks(from:number): BlockType[] {
  const available: BlockType[] = ['pb_forward','pb_left','pb_right'];
  if(from>=3)available.push('pb_scan');
  if(from>=4)available.push('pb_repeat');
  if(from>=6)available.push('pb_if','pb_if_else','pb_terrain_ahead','pb_terrain');
  if(from>=7)available.push('pb_path_clear');
  if(from>=8)available.push('pb_until','pb_terrain_under');
  if(from>=10)available.push('pb_on_goal');
  return available;
}
function mission(value:Omit<Level,'allowedBlocks'>):Level {
  return {...value, allowedBlocks:blocks(value.number)};
}
function map(id:string,label:string,tiles:Tile[][],start:ReturnType<typeof robot>,
  goal:ReturnType<typeof target>,objects:MissionObject[]=[]):MapVariant {
  return {id,label,tiles,start,goal,objects};
}
function debugStarter():object {
  return {blocks:{languageVersion:0,blocks:[{
    type:'pb_start',id:'mission-start',x:30,y:40,
    inputs:{DO:{block:{
      type:'pb_repeat',id:'faulty-repeat',fields:{COUNT:4},
      inputs:{DO:{block:{type:'pb_forward',id:'faulty-move'}}},
      next:{block:{type:'pb_right',id:'faulty-turn',
        next:{block:{type:'pb_forward',id:'faulty-final'}}}}
    }}}
  }]}};
}
export const campaignLevels: Level[] = [
mission({
  id:'radiomast',revision:1,number:1,title:'De verlaten radiomast',subtitle:'Je eerste protocol',
  story:'Een zwak noodsignaal klinkt vanuit een verlaten radiomast. Breng ProtoBot naar het bedieningspaneel.',
  objective:'Bereik het groene doel met rij- en draaiblokken.',
  hint:'Rij twee vakken vooruit, draai rechts en rij nog één vak.',
  hints:['In welke richting kijkt de robot?','Gebruik rijden en draaien na elkaar.','Vooruit, vooruit, rechts, vooruit.'],
  learningGoals:['Volgorde van opdrachten','Eerste Blockly-programma'],
  tiles:terrain('gggsg','sgggg','gggsg','gaagg'),
  start:robot(1,1),goal:target(3,2),defaults:['forward','forward','right','forward'],
  objects:[item('radio',3,2,'Radiomast')],
  successLog:'BERGINGSLOG 01 — De radiomast ontvangt een zwakke herhaalde noodoproep.'
}),
mission({
  id:'laatste-wacht',revision:1,number:2,title:'De laatste wacht',subtitle:'Een verlaten wachthuis',
  story:'Het wachthuis is verlaten. Binnen ligt een veldtas met een geigerteller.',
  objective:'Rijd langs de muur naar de veldtas.',
  hint:'Twee keer vooruit, daarna rechtsaf naar de tas.',
  hints:['Kijk eerst naar de muur links van de route.','Loop langs de bovenkant van de kamer.','Vooruit, vooruit, rechts, vooruit.'],
  learningGoals:['Een route met bochten','Nauwkeurig draaien'],
  tiles:terrain('ggg#g','ggggg','g#ggg','ggggg'),
  start:robot(1,1),goal:target(3,2),defaults:[],
  objects:[item('geiger',3,2,'Geigerteller')],
  successLog:'BERGINGSLOG 02 — Geigerteller gevonden. Batterij: 18%. Stralingswaarden zijn verhoogd.'
}),
mission({
  id:'reparatieprotocol',revision:1,number:3,title:'Reparatieprotocol',subtitle:'Een fout in de besturing',
  story:'Een oud besturingsprogramma stuurt ProtoBot de verkeerde kant op. Onderzoek de fout.',
  objective:'Herstel de verkeerde draai in het voorbeeldprogramma.',
  hint:'De derde opdracht draait de verkeerde kant op.',
  hints:['Voer het programma stap voor stap uit.','Controleer de richting na twee rijbewegingen.','Vervang draai links door draai rechts.'],
  learningGoals:['Een fout opsporen','Stapmodus en scannen'],
  tiles:terrain('ggggg','ggggg','ggggg','ggggg'),
  start:robot(0,1),goal:target(2,2),defaults:['forward','forward','left','forward'],
  objects:[item('relay',2,2,'Reparatiepaneel')],
  successLog:'REPARATIELOG 03 — Navigatiefout hersteld. ProtoBot rapporteert normale besturing.'
}),
mission({
  id:'lange-gang',revision:2,number:4,title:'De lange gang',subtitle:'Werk slimmer, niet langer',
  story:'Een rechte onderhoudsgang voert diep onder het oude complex. Gebruik een herhaling.',
  objective:'Rijd zes vakken vooruit met maximaal twee blokken.',
  hint:'Zet rij vooruit binnen een herhaalblok met teller 6.',
  hints:['Een opdracht kan meer dan één keer worden uitgevoerd.','Welk blok herhaalt een actie?','Herhaal 6 keer: rij vooruit.'],
  learningGoals:['Getelde herhalingen','Compact programmeren'],
  maxBlocks:2,
  tiles:terrain('#########','ssssssss#','#########'),
  start:robot(1,1),goal:target(7,1),defaults:[],
  wallFeatures:[{type:'doorway',x:0,y:1,rotation:1}],
  objects:[item('beacon',7,1,'Noodbaken')],
  successLog:'ONDERHOUDSLOG 04 — De lange gang is veilig. Herhaalde opdrachten zijn geoptimaliseerd.'
}),
mission({
  id:'meetpost',revision:1,number:5,title:'Het meetstation',subtitle:'Een patroon in de route',
  story:'Een trapsgewijs pad voert omhoog naar een oud meetstation. Elke trede heeft dezelfde vorm.',
  objective:'Bereik het meetstation door hetzelfde bewegingspatroon drie keer te herhalen.',
  hint:'Herhaal drie keer: vooruit, links, vooruit, rechts.',
  hints:['Zoek het patroon dat zich drie keer herhaalt.','Eén trede bestaat uit vier opdrachten.','Herhaal 3 keer: vooruit, links, vooruit, rechts.'],
  learningGoals:['Meerdere opdrachten herhalen met een herhaalblok','Een herhaalpatroon herkennen'],
  maxBlocks:5,
  tiles:terrain('######','######','###gs#','##gg##','#gg###','gg####'),
  start:robot(0,5),goal:target(3,2),defaults:[],
  objects:[item('sensor',3,2,'Meetstation')],
  successLog:'MEETLOG 05 — Het meetstation is weer bereikbaar. Het noodsignaal wordt sterker.'
}),
mission({
  id:'rivieroever',revision:2,number:6,title:'De overstroomde oever',subtitle:'Kies de veilige route',
  story:'De overstroming heeft twee mogelijke overgangen achtergelaten. Hetzelfde programma moet beide routes aankunnen.',
  objective:'Gebruik hetzelfde programma op beide kaarten. Controleer of er water voor de robot ligt.',
  hint:'Rijd eerst naar het kruispunt. Staat er water vóór de robot, draai dan rechtsaf.',
  hints:['Het tweede kruispunt is in beide kaarten anders.','Controleer of vóór de robot water ligt.','Vooruit; als water vóór mij: rechts en vooruit; anders vooruit.'],
  learningGoals:['Als/anders','Terrein vóór de robot controleren','Eén programma op twee kaarten'],
  tiles:terrain('ggggg','ggggg','ggwwg','ggwwg'),
  start:robot(0,1),goal:target(2,1),defaults:['forward'],
  objects:[item('relay',2,1,'Oeverrelais')],
  variants:[map('hoogwater','Hoge waterstand',terrain('ggggg','ggwgg','ggggg','ggwwg'),robot(0,1),target(1,2),[item('relay',1,2,'Oeverrelais')])],
  successLog:'VERKENNINGSLOG 06 — Beide oevers veilig verkend. De doorgang is in kaart gebracht.'
}),
mission({
  id:'lavagrot',revision:1,number:7,title:'De lavagrot',subtitle:'Veilige route gezocht',
  story:'Onder het terrein ligt een oude lavagrot. Eén route is open, de andere door hitte afgesloten.',
  objective:'Controleer of de doorgang vrij is. Gebruik één programma op beide kaarten.',
  hint:'Als het pad vrij is, ga vooruit. Anders draai rechts en zoek de veilige doorgang.',
  hints:['Een lava- of muurvak is nooit een vrij pad.','Gebruik pad vrij vooruit? als conditie.','Als pad vrij: 2x vooruit; anders rechts en 2x vooruit.'],
  learningGoals:['Pad vrij?','Beslissingen bij gevaar'],
  tiles:terrain('#####','#sss#','#sls#','#sss#','#####'),
  start:robot(1,1),goal:target(3,1),defaults:[],
  objects:[item('beacon',3,1,'Warmtebaken')],
  variants:[map('lavastroom','Actieve lavastroom',terrain('#####','#sll#','#sss#','#sss#','#####'),robot(1,1),target(1,3),[item('beacon',1,3,'Warmtebaken')])],
  successLog:'VEILIGHEIDSLOG 07 — De lavastroom is vermeden. Er zijn twee veilige doorgangen gevonden.'
}),
mission({
  id:'waterleiding',revision:1,number:8,title:'De oude waterleiding',subtitle:'Vind de drinkwaterpomp',
  story:'Een vergeten waterleiding eindigt bij een drinkwaterpomp. De zandmarkering vertelt waar ProtoBot moet stoppen.',
  objective:'Herhaal rijden tot je op zand staat. Ga daarna één vak verder naar de pomp.',
  hint:'Gebruik herhaal totdat tegel onder mij zand is.',
  hints:['Het aantal vakken verschilt per kaart.','Lees het terrein onder de robot in plaats van vooruit.','Herhaal totdat onder mij zand: vooruit. Daarna vooruit.'],
  learningGoals:['Herhaal totdat','Terrein onder mij','Variabele trajectlengte'],
  maxBlocks:4,
  tiles:terrain('#######','#sssas#','#######'),
  start:robot(1,1),goal:target(5,1),defaults:[],
  objects:[item('pump',5,1,'Drinkwaterpomp')],
  variants:[map('kort-leiding','Korte leiding',terrain('#######','#ssas##','#######'),robot(1,1),target(4,1),[item('pump',4,1,'Drinkwaterpomp')])],
  successLog:'WATERLOG 08 — Drinkwaterpomp geactiveerd. De voorraad kan weer worden aangevuld.'
}),
mission({
  id:'inspectieprotocol',revision:1,number:9,title:'Inspectieprotocol',subtitle:'Herstel de herhaling',
  story:'Het oude inspectieprogramma rijdt een vak te ver en belandt in gevaar. Controleer de teller.',
  objective:'Herstel het voorbeeldprogramma zodat de robot vóór het water afslaat naar het inspectiepunt.',
  hint:'Twee rijbewegingen zijn genoeg voordat de robot rechtsaf moet.',
  hints:['Gebruik de stapmodus om de herhaalteller te volgen.','De standaard herhaling is te lang.','Verander de teller van 4 in 2.'],
  learningGoals:['Een fout in een herhaalblok herstellen','Sensor en herhaling combineren'],
  maxBlocks:4,
  tiles:terrain('#######','#ssssw#','###s###','#######'),
  start:robot(1,1),goal:target(3,2),defaults:[],starterWorkspace:debugStarter(),
  objects:[item('sensor',3,2,'Inspectiepaneel')],
  successLog:'INSPECTIELOG 09 — Programmeerfout hersteld. De meetapparatuur werkt weer.'
}),
mission({
  id:'tegenstation',revision:1,number:10,title:'Het laatste radiostation',subtitle:'Herstel de verbinding',
  story:'Drie beschadigde doorgangen leiden naar het laatste radiostation. Eén robuust programma moet ze allemaal kunnen doorlopen.',
  objective:'Gebruik hetzelfde programma om op alle drie de kaarten het radiostation te bereiken. Combineer een herhaalblok met het blok ‘pad vrij vooruit?’.',
  hint:'Herhaal totdat je het doel bereikt; rijd als het pad vrij is, anders draai rechts.',
  hints:['Er zijn verschillende aantallen rechte stukken en rechterbochten.','Gebruik herhaal totdat op doel, met een voorwaarde binnen de lus.','Herhaal totdat op doel: als pad vrij dan vooruit, anders rechts.'],
  learningGoals:['Alles combineren','Eén robuust programma op drie kaarten'],
  maxBlocks:6,
  tiles:terrain('#######','#sssw##','###s###','###s###','#######'),
  start:robot(1,1),goal:target(3,3),defaults:[],
  objects:[item('radio',3,3,'Radiostation')],
  variants:[
    map('omleiding','Omleiding via zuiden',terrain('#######','#s#####','#s#####','#s#####','#######'),robot(1,1),target(1,3),[item('radio',1,3,'Radiostation')]),
    map('dubbele-bocht','Dubbele rechterbocht',terrain('#######','#sss###','###s###','#sss###','#######'),robot(1,1),target(1,3),[item('radio',1,3,'Radiostation')])
  ],
  successLog:'VERBINDINGSLOG 10 — Post West aan onbekende zender: We horen jullie. Met hoeveel zijn jullie?'
})
];
