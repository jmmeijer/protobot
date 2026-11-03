import './styles.css';
import './blockly-editor.css';
import type { BlocklyEditorHandle } from './blockly-editor';
import { compileWorkspace, defaultWorkspace, describeInstruction, executeProgramStep, initialProgramState, visibleInstruction, ProgramError, type Program, type ProgramRunState } from './program';
import { mapPrototypeMarkup, mountMapPrototype, unmountMapPrototype } from './map-prototype';
import {
  initialState, levelById, levels,
  type Level, type RunState
} from './game';
import { loadLevel, saveLevel, storageWarning } from './storage';

type Screen = 'start' | 'levels' | 'briefing' | 'editor' | 'play' | 'result' | 'map';
interface Route { screen: Screen; level?: Level }
const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('ProtoBot root #app ontbreekt');
const root: HTMLElement = app;
// Vite's configured base URL keeps public assets working on GitHub Pages (/protobot/).
const logoSrc = import.meta.env.BASE_URL + 'assets/protobot-logo.webp';
let booting = !window.location.hash || window.location.hash === '#/';
let currentRoute: Route = {screen: 'start'};
let activeRun: ProgramRunState | null = null;
let activeProgram: Program | null = null;
let editor: BlocklyEditorHandle | null = null;
let editorLoadToken = 0;
let activeLevelId = '';
let timer: ReturnType<typeof setInterval> | undefined;
let resultTimer: ReturnType<typeof setTimeout> | undefined;
const progress = new Map(levels.map(level => [level.id, loadLevel(level)]));

function escapeText(s: unknown): string {
  return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] ?? ch));
}
function icon(name: string): string {
  const paths: Record<string, string> = {
    play:'<path d="m8 5 11 7-11 7z"/>',
    pause:'<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    step:'<path d="m5 5 10 7-10 7z"/><path d="M19 5v14"/>',
    reset:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>',
    back:'<path d="m14 18-6-6 6-6"/>',
    next:'<path d="m9 18 6-6-6-6"/>',
    check:'<path d="m4 12 5 5 11-11"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    code:'<path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 4l-4 16"/>',
    terminal:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3m6 0h4"/>',
    map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v.5"/>',
    trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v7m4-7v7"/>',
    up:'<path d="m6 14 6-6 6 6"/>',
    down:'<path d="m6 10 6 6 6-6"/>',
    alert:'<path d="m12 3 10 18H2z"/><path d="M12 9v5m0 3v.5"/>',
    home:'<path d="m3 11 9-8 9 8v10H3z"/><path d="M9 21v-7h6v7"/>'
  };
  return '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] ?? paths.info) + '</svg>';
}
function routeFor(level: Level, screen: Screen): string {
  return '#/level/' + level.id + '/' + (screen === 'briefing' ? '' : screen);
}
function readRoute(): Route {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'levels') return {screen: 'levels'};
  if (parts[0] === 'map-prototype') return {screen: 'map'};
  if (parts[0] === 'level') {
    const level = levelById(parts[1] ?? '');
    if (!level) return {screen:'levels'};
    const screen = parts[2] as Screen | undefined;
    if (screen === 'editor' || screen === 'play' || screen === 'result') return {screen, level};
    return {screen: 'briefing', level};
  }
  return {screen: 'start'};
}
function stopTimers() {
  if (timer !== undefined) clearInterval(timer);
  if (resultTimer !== undefined) clearTimeout(resultTimer);
  timer = undefined; resultTimer = undefined;
}
function closeEditor() {
  ++editorLoadToken;
  if (!editor) return;
  const level = currentRoute.level;
  if (level && currentRoute.screen === 'editor') {
    const saved = {...record(level),workspace:editor.save()};
    progress.set(level.id,saved);
    saveLevel(level,saved);
  }
  editor.dispose();
  editor = null;
}
function onRouteChange() {
  closeEditor();
  unmountMapPrototype();
  stopTimers();
  currentRoute = readRoute();
  if (currentRoute.level && (currentRoute.level.id !== activeLevelId || currentRoute.screen === 'play')) {
    activeRun = initialProgramState(currentRoute.level);
    activeLevelId = currentRoute.level.id;
  }
  if (currentRoute.screen === 'play' && currentRoute.level) {
    const level=currentRoute.level;
    try {
      activeProgram = compileWorkspace(record(level).workspace ?? defaultWorkspace(level,record(level).blocks),level);
    } catch(error) {
      activeProgram = null;
      activeRun = {...initialProgramState(level),phase:'failed',message:error instanceof Error ? error.message : 'Ongeldig programma.'};
    }
  }
  render();
}
function navigate(hash: string) {
  if (window.location.hash === hash) onRouteChange();
  else window.location.hash = hash;
}
function record(level: Level) {
  const value = progress.get(level.id);
  if (!value) throw new Error('Level progress not found');
  return value;
}
function reportEditor(message:string,isError=false) {
  const status=root.querySelector<HTMLElement>('#blockly-editor-status');
  if (!status) return;
  status.textContent=message;
  status.classList.toggle('is-error',isError);
  status.classList.toggle('is-warning',!isError && message.startsWith('Let op'));
}
function prepareRun(level:Level): boolean {
  try {
    const workspace=editor?.save() ?? record(level).workspace ?? defaultWorkspace(level,record(level).blocks);
    const program=compileWorkspace(workspace,level);
    const saved={...record(level),workspace};
    progress.set(level.id,saved);
    saveLevel(level,saved);
    activeProgram=program;
    if (program.ignoredBlocks) {
      reportEditor('Let op: '+program.ignoredBlocks+' losse blok(ken) worden niet uitgevoerd. Alleen de keten onder het startblok telt.');
    }
    navigate(routeFor(level,'play'));
    return true;
  } catch (error) {
    const message=error instanceof Error ? error.message : 'De blokken kunnen niet worden uitgevoerd.';
    reportEditor(message,true);
    if (error instanceof ProgramError) editor?.highlight(error.blockId);
    return false;
  }
}
function setCompleted(level: Level) {
  const saved = {...record(level), completed: true};
  progress.set(level.id, saved);
  saveLevel(level, saved);
}
function button(action: string, title: string, glyph: string, className = '', data = ''): string {
  return '<button type="button" class="icon-btn ' + className + '" data-action="' + escapeText(action) + '"' +
    (data ? ' data-value="' + escapeText(data) + '"' : '') +
    ' aria-label="' + escapeText(title) + '" title="' + escapeText(title) + '">' + icon(glyph) + '</button>';
}
function header(): string {
  return '<header class="topbar"><a class="brand" href="#/" aria-label="ProtoBot, terug naar start">' +
    '<span class="brand-mark">P<span class="brand-eye">•</span></span><span class="brand-name">PROTO<span>BOT</span><small>ROVER PROTOCOL</small></span></a>' +
    '<div class="topbar-right"><span class="system-state"><i></i> TERMINAL ONLINE</span>' +
    '<a class="top-link" href="#/levels">' + icon('map') + '<span>MISSIES</span></a></div></header>';
}
function footer(): string {
  return '<footer class="app-footer"><span>PROTOBOT SYSTEMS // V0.2 ALPHA</span><span>LEER • CODEER • ONTDEK</span></footer>';
}
function bot(heading = 'E'): string {
  return '<span class="bot-sprite heading-' + heading + '" aria-label="ProtoBot"><span class="bot-antenna"></span><span class="bot-face"><i></i><i></i></span><span class="bot-track"></span></span>';
}
function map(level: Level, run?: RunState, preview = false): string {
  const pos = run ?? initialState(level);
  return '<div class="field-wrap' + (preview ? ' field-preview' : '') + '">' +
    '<div class="grid-board" style="--cols:' + level.tiles[0].length + '" role="img" aria-label="Speelveld van ' + escapeText(level.title) + '">' +
    level.tiles.map((line, y) => line.map((tile, x) => {
      const isGoal = x === level.goal.x && y === level.goal.y;
      const isBot = x === pos.x && y === pos.y;
      return '<div class="ground tile-' + tile + (isGoal ? ' is-goal' : '') + '">' +
        (isGoal ? '<span class="goal-marker">' + icon('check') + '</span>' : '') +
        (isBot ? bot(pos.direction) : '') +
        '</div>';
    }).join('')).join('') + '</div></div>';
}
function startScreen(): string {
  return '<main class="hero screen-enter"><div class="hero-copy">' +
    '<div class="hero-brand"><img class="start-logo" src="' + logoSrc + '" alt="ProtoBot" width="1000" height="333" decoding="async"></div>' +
    '<div class="eyebrow"><span class="tiny-square"></span> MISSIECONTROLE / SECTOR 07</div>' +
    '<h1>De wereld heeft<br><em>jouw code</em> nodig.</h1>' +
    '<p>Bestuur ProtoBot, ontdek verlaten locaties en los puzzels op met programmeerblokken. Elke opdracht brengt je een stap verder.</p>' +
    '<button class="btn primary btn-large" data-action="to-levels">START MISSIE ' + icon('next') + '</button>' +
    '<div class="hero-meta"><span>◆ PROGRAMMEER MET BLOKKEN</span><span>◆ LEER DOOR TE TESTEN</span></div></div>' +
    '<div class="hero-art" aria-label="Illustratie van ProtoBot in een verlaten communicatiecentrum">' +
    '<div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="signal-rings"></div>' +
    '<div class="hero-robot">' + bot('E') + '</div><span class="hero-art-label">PROTOBOT // UNIT 01</span>' +
    '<span class="hero-coordinate">51° N / 05° E</span></div></main>';
}
function levelsScreen(): string {
  const completed = levels.filter(level => record(level).completed).length;
  return '<main class="content screen-enter"><div class="section-heading"><div><div class="eyebrow">MISSIESELECTIE / HOOFDSTUK 01</div>' +
    '<h1>Kies je missie<span class="accent">.</span></h1><p>Elke missie leert je nieuwe manieren om ProtoBot te besturen.</p></div>' +
    '<div class="progress-badge"><strong>' + completed + ' / ' + levels.length + '</strong><span>VOLTOOID</span></div></div>' +
    '<div class="mission-grid">' + levels.map(level =>
      '<article class="mission-card"><div class="mission-top"><span>MISSIE ' + String(level.number).padStart(2,'0') + '</span>' +
      (record(level).completed ? '<span class="done-tag">' + icon('check') + ' BEHAALD</span>' : '<span class="available-tag">BESCHIKBAAR</span>') +
      '</div><div class="mission-visual mission-visual-' + level.number + '">' + map(level, undefined, true) + '</div>' +
      '<div class="mission-body"><div class="mission-kicker">' + escapeText(level.subtitle) + '</div>' +
      '<h2>' + escapeText(level.title) + '</h2><p>' + escapeText(level.story) + '</p>' +
      '<button class="btn secondary" data-action="open-level" data-value="' + level.id + '">BEKIJK OPDRACHT ' + icon('next') + '</button></div></article>'
    ).join('') + '</div><div class="future-notice">' + icon('lock') +
    '<div><strong>Nog 8 missies in voorbereiding</strong><span>Nieuwe uitdagingen worden later toegevoegd.</span></div></div>' +
    '<a class="btn secondary" href="#/map-prototype" style="margin-top:23px">KAARTLAB: TEST TERREINEN ' + icon('map') + '</a></main>';
}
function crumb(level: Level, step: string): string {
  return '<nav class="breadcrumb" aria-label="Navigatie"><a href="#/levels">MISSIES</a><span>/</span><a href="' +
    routeFor(level,'briefing') + '">MISSIE ' + String(level.number).padStart(2,'0') + '</a><span>/</span><b>' + step + '</b></nav>';
}
function briefingScreen(level: Level): string {
  return '<main class="content screen-enter">' + crumb(level,'OPDRACHT') +
    '<div class="briefing-layout"><section class="panel briefing-text"><div class="eyebrow">MISSIEDOSSIER / ' +
    String(level.number).padStart(2,'0') + '</div><h1>' + escapeText(level.title) + '</h1><p class="lead">' + escapeText(level.story) + '</p>' +
    '<div class="objective-box"><div class="objective-icon">' + icon('terminal') + '</div>' +
    '<div><span>JOUW OPDRACHT</span><p>' + escapeText(level.objective) + '</p></div></div>' +
    '<div class="briefing-actions"><button class="btn primary" data-action="to-editor">OPEN PROGRAMMEERTERMINAL ' + icon('next') + '</button>' +
    '<a class="btn ghost" href="#/levels">' + icon('back') + ' MISSIEOVERZICHT</a></div></section>' +
    '<aside class="panel briefing-map"><div class="panel-top"><span>TERREINVERKENNING</span><span>CAM 01</span></div>' + map(level) +
    '<div class="map-legend"><span><i class="dot bot-dot"></i> START</span><span><i class="dot goal-dot"></i> DOEL</span>' +
    '<span><i class="dot hazard-dot"></i> GEVAAR</span></div></aside></div></main>';
}
function editorScreen(level: Level): string {
  return '<main class="workbench screen-enter">' + crumb(level,'PROGRAMMEREN') +
    '<div class="workspace-heading"><div><div class="eyebrow">PROGRAMMEERTERMINAL / MISSIE ' + String(level.number).padStart(2,'0') +
    '</div><h1>Bouw je route<span class="accent">.</span></h1></div>' +
    '<div class="workspace-controls">' + button('reset-program','Herstel het voorbeeldprogramma','reset') +
    '<button class="btn primary" data-action="to-play">TEST PROGRAMMA ' + icon('play') + '</button></div></div>' +
    '<div class="blockly-editor-layout"><section class="panel blockly-workspace-panel"><div class="panel-top"><span>' +
    icon('code') + ' BLOCKLY / MIJN PROGRAMMA</span><span>DRAG & DROP</span></div>' +
    '<div id="blockly-workspace" class="blockly-workspace" aria-label="Blockly-programmeerwerkruimte"></div>' +
    '<div class="blockly-editor-info"><span id="blockly-block-count">Blokken laden…</span>' +
    '<span class="blockly-workspace-note">Sleep blokken uit het palet naar het startblok. Gebruik de prullenbak om ze te verwijderen.</span></div>' +
    '<p id="blockly-editor-status" class="blockly-editor-status" role="status" aria-live="polite">Blokken laden…</p></section>' +
    '<aside class="panel blockly-editor-map"><div class="panel-top"><span>SPEELVELD / PREVIEW</span><span>LIVE</span></div>' +
    map(level) + '<p class="side-caption">Tijdens het testen klapt de editor in. De actieve en volgende instructie blijven zichtbaar.</p>' +
    '</aside></div></main>';
}
function mountEditorScreen(level:Level) {
  const element=root.querySelector<HTMLElement>('#blockly-workspace');
  if (!element) return;
  const token=++editorLoadToken;
  void import('./blockly-editor').then(({mountBlocklyEditor}) => {
    if (token!==editorLoadToken || currentRoute.screen!=='editor' || currentRoute.level?.id!==level.id) return;
    editor=mountBlocklyEditor(
      element,level,record(level).workspace ?? defaultWorkspace(level,record(level).blocks),
      (workspace,count) => {
        const saved={...record(level),workspace};
        progress.set(level.id,saved);
        saveLevel(level,saved);
        const label=root.querySelector<HTMLElement>('#blockly-block-count');
        if (label) label.textContent=count+' BLOKKEN IN WERKRUIMTE';
      }
    );
    const count=root.querySelector<HTMLElement>('#blockly-block-count');
    if (count && record(level).workspace) count.textContent='Blockly-programma geladen';
    reportEditor('Je wijzigingen worden automatisch opgeslagen op dit apparaat.');
    if (activeRun?.lastBlockId) editor.highlight(activeRun.lastBlockId);
  }).catch(() => {
    if (token===editorLoadToken) reportEditor('Blockly kon niet worden geladen. Vernieuw de pagina.',true);
  });
}
function codeRail(_level: Level, run: ProgramRunState): string {
  const program=activeProgram;
  const current=program ? visibleInstruction(program,run.pc) : null;
  let next=null;
  if (program && current && run.phase!=='won' && run.phase!=='failed') {
    const projected=executeProgramStep(currentRoute.level!,program,run);
    if (projected.phase!=='won' && projected.phase!=='failed') next=visibleInstruction(program,projected.pc);
  }
  const preview=[current?.instruction,next?.instruction].map((instruction,offset)=>{
    const label=offset===0?'NU':'VOLGENDE';
    const text=describeInstruction(instruction);
    return '<div class="rail-step '+(offset===0?'current':'upcoming')+'"><span class="rail-tag">'+label+'</span>'+
      (instruction ? '<span class="rail-block kind-'+instruction.op+'"><span>'+escapeText(text)+'</span></span>' :
      '<span class="rail-empty">Einde programma</span>')+'</div>';
  }).join('');
  return '<aside class="panel code-rail"><div class="panel-top"><span>'+icon('code')+
    ' UITVOERING</span><span>INGEKLAPT</span></div>'+
    '<div class="rail-summary"><span class="mini-light"></span>UITGEVOERD <b>'+run.steps+' STAPPEN</b></div>'+
    '<div class="rail-list">'+preview+'</div>'+
    (run.lastBlockId?'<div class="rail-note">Laatste Blockly-blok: '+escapeText(run.lastBlockId)+
      (run.lastSensor?' · Sensor: '+escapeText(run.lastSensor):'')+'</div>':
      '<div class="rail-note">De huidige en volgende instructie blijven zichtbaar terwijl ProtoBot beweegt.</div>')+
    '</aside>';
}
function playScreen(level: Level): string {
  if (!activeRun) activeRun = initialProgramState(level);
  const run = activeRun;
  const isRunning = run.phase === 'running';
  return '<main class="workbench play-workbench screen-enter">' + crumb(level,'TESTEN') +
    '<div class="workspace-heading"><div><div class="eyebrow">UITVOERMODUS / MISSIE ' + String(level.number).padStart(2,'0') +
    '</div><h1>Test je programma<span class="accent">.</span></h1></div>' +
    '<div class="play-toolbar" role="toolbar" aria-label="Uitvoering bedienen">' +
    button('back-to-editor','Terug naar programmeren','code') +
    '<span class="toolbar-divider"></span>' +
    button('run','Uitvoeren','play','tool-primary' + (isRunning ? ' is-active' : '')) +
    button('pause','Pauzeren','pause','', '') +
    button('step','Eén instructie uitvoeren','step') +
    button('restart','Opnieuw beginnen','reset') + '</div></div>' +
    '<div class="play-layout">' + codeRail(level, run) +
    '<section class="panel game-panel"><div class="panel-top"><span>VELDCAMERA / SECTOR 07</span><span>CAM 01 <i class="rec-dot"></i> LIVE</span></div>' +
    map(level,run) +
    '<div class="game-hud"><div><span>POSITIE</span><strong>' + run.x + ',' + run.y + '</strong></div>' +
    '<div><span>RICHTING</span><strong>' + ({N:'NOORD',E:'OOST',S:'ZUID',W:'WEST'}[run.direction]) + '</strong></div>' +
    '<div><span>STAPPEN</span><strong>' + run.steps + '</strong></div>' +
    '<div><span>STATUS</span><strong class="' + (isRunning ? 'is-running' : '') + '">' +
    (isRunning ? 'ACTIEF' : run.phase === 'ready' ? 'GEREED' : run.phase === 'paused' ? 'PAUZE' : 'VOLTOOID') +
    '</strong></div></div><p class="run-message" role="status">' + escapeText(run.message) + '</p></section></div></main>';
}
function resultScreen(level: Level): string {
  const run = activeRun;
  const won = run?.phase === 'won';
  return '<main class="result-screen screen-enter"><section class="panel result-panel">' +
    '<div class="result-symbol ' + (won ? 'win' : 'retry') + '">' + icon(won ? 'check' : 'alert') + '</div>' +
    '<div class="eyebrow">MISSIE ' + String(level.number).padStart(2,'0') + ' / RESULTAAT</div>' +
    '<h1>' + (won ? 'Missie geslaagd!' : 'Nog niet gelukt.') + '</h1>' +
    '<p>' + escapeText(run?.message ?? 'Voer eerst een test uit om je resultaat te zien.') + '</p>' +
    '<div class="result-stats"><div><strong>' + (run?.steps ?? 0) + '</strong><span>UITGEVOERDE STAPPEN</span></div>' +
    '<div><strong>' + (activeProgram?.totalBlocks ?? 0) + '</strong><span>CODEBLOKKEN</span></div></div>' +
    '<div class="result-actions"><button class="btn primary" data-action="to-editor">' +
    (won ? 'PROGRAMMA BEKIJKEN' : 'PROBEER OPNIEUW') + ' ' + icon('code') + '</button>' +
    '<button class="btn secondary" data-action="to-levels">MISSIEOVERZICHT ' + icon('map') + '</button></div></section></main>';
}
function render() {
  if (booting) {
    root.innerHTML = '<div class="boot"><img class="boot-logo" src="' + logoSrc + '" alt="ProtoBot" width="1000" height="333" fetchpriority="high"><div class="boot-bar"><i></i></div><p>SYSTEMEN INITIALISEREN...</p></div>';
    return;
  }
  const route = currentRoute;
  let body = '';
  if (route.screen === 'start') body = startScreen();
  else if (route.screen === 'levels') body = levelsScreen();
  else if (route.screen === 'map') body = mapPrototypeMarkup();
  else if (route.level) {
    if (route.screen === 'briefing') body = briefingScreen(route.level);
    if (route.screen === 'editor') body = editorScreen(route.level);
    if (route.screen === 'play') body = playScreen(route.level);
    if (route.screen === 'result') body = resultScreen(route.level);
  }
  root.innerHTML = header() + (storageWarning() ? '<div class="storage-warning" role="alert">' + escapeText(storageWarning()) + '</div>' : '') + body + footer();
  if (route.screen === 'map') mountMapPrototype();
  if (route.screen === 'editor' && route.level) mountEditorScreen(route.level);
}
function tick() {
  const level = currentRoute.level;
  if (!level || !activeRun || !activeProgram) return;
  activeRun = executeProgramStep(level,activeProgram,activeRun);
  if (activeRun.phase === 'won' || activeRun.phase === 'failed') {
    stopTimers();
    if (activeRun.phase === 'won') setCompleted(level);
    render();
    resultTimer = setTimeout(() => navigate(routeFor(level, 'result')), 850);
    return;
  }
  if (timer !== undefined) activeRun.phase = 'running';
  render();
}
function play() {
  if (!currentRoute.level || !activeRun || !activeProgram || timer !== undefined || ['won','failed'].includes(activeRun.phase)) return;
  activeRun.phase = 'running';
  render();
  timer = setInterval(tick, 680);
  tick();
}
root.addEventListener('click', event => {
  const target = event.target as Element;
  const buttonEl = target.closest<HTMLElement>('[data-action]');
  if (!buttonEl) return;
  const action = buttonEl.dataset.action;
  const value = buttonEl.dataset.value ?? '';
  const level = currentRoute.level;
  if (action === 'to-levels') navigate('#/levels');
  if (action === 'open-level' && levelById(value)) navigate(routeFor(levelById(value)!, 'briefing'));
  if (action === 'to-editor' && level) navigate(routeFor(level,'editor'));
  if (action === 'to-play' && level) prepareRun(level);
  if (action === 'back-to-editor' && level) navigate(routeFor(level,'editor'));
  if (action === 'reset-program' && level && editor) {
    editor.reset();
    reportEditor('Voorbeeldprogramma hersteld.');
  }
  if (action === 'run') play();
  if (action === 'pause' && activeRun && timer !== undefined) {
    stopTimers(); activeRun.phase = 'paused'; activeRun.message = 'Uitvoering gepauzeerd.'; render();
  }
  if (action === 'step' && activeRun) {
    if (timer !== undefined) { stopTimers(); activeRun.phase = 'paused'; }
    tick();
  }
  if (action === 'restart' && level) {
    stopTimers(); activeRun = initialProgramState(level); render();
  }
});
window.addEventListener('hashchange', onRouteChange);
currentRoute = readRoute();
if (currentRoute.level) {
  activeLevelId = currentRoute.level.id;
  activeRun = initialProgramState(currentRoute.level);
  if (currentRoute.screen === 'play') {
    try { activeProgram=compileWorkspace(record(currentRoute.level).workspace ?? defaultWorkspace(currentRoute.level,record(currentRoute.level).blocks),currentRoute.level); }
    catch(error) { activeProgram=null;activeRun.phase='failed';activeRun.message=error instanceof Error?error.message:'Ongeldig programma.'; }
  }
}
render();
if (booting) setTimeout(() => { booting = false; onRouteChange(); }, 600);
