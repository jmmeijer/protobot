import './styles.css';
import './campaign.css';
import { animateLevelRun, mountLevelCanvases, pauseLevelAnimation, resumeLevelAnimation, snapLevelRun, setLevelCanvasVariant, unmountLevelCanvases } from './level-canvas';
import { motionDuration } from './robot-motion';
import './blockly-editor.css';
import type { BlocklyEditorHandle } from './blockly-editor';
import { compileWorkspace, defaultWorkspace, executeProgramStep, initialProgramState, visibleInstruction, ProgramError, type Program, type ProgramRunState } from './program';
import { executionFocus } from './execution-focus';
import { mapPrototypeMarkup, mountMapPrototype, unmountMapPrototype } from './map-prototype';
import {
  initialState, levelById, levelVariant, variantCount, variantLabel, levels,
  type Level, type RunState
} from './game';
import { loadLevel, saveLevel, storageWarning } from './storage';

type Screen = 'start' | 'levels' | 'briefing' | 'workspace' | 'result' | 'map';
type WorkspaceMode = 'edit' | 'test';
interface Route { screen: Screen; level?: Level; initialMode?: WorkspaceMode }
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
let workspaceMode: WorkspaceMode = 'edit';
let animatingBlockId: string | undefined;
let animatingNextState: ProgramRunState | undefined;
let activeLevelId = '';
let activeVariantIndex = 0;
let pendingVariantIndex: number | null = null;
let variantResults: Array<'pending'|'passed'|'failed'> = [];
let hintIndex = 0;
function currentMap(level:Level):Level { return levelVariant(level,activeVariantIndex); }
function resetVariants(level:Level) {
  activeVariantIndex = 0;
  pendingVariantIndex = null;
  variantResults = Array.from({length:variantCount(level)},()=> 'pending' as const);
}
let timer: ReturnType<typeof setTimeout> | undefined;
let autoRun = false;
let animationPending = false;
let executionToken = 0;
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
    const segment = parts[2];
    if (segment === 'editor' || segment === 'play' || segment === 'workspace')
      return {screen:'workspace', level, initialMode:segment === 'play' ? 'test' : 'edit'};
    if (segment === 'result') return {screen:'result', level};
    return {screen:'briefing', level};
  }
  return {screen: 'start'};
}
function stopTimers() {
  // Invalidate an await that may complete after a restart or navigation.
  executionToken++;
  autoRun = false;
  animationPending = false;
  animatingBlockId = undefined;
  animatingNextState = undefined;
  if (timer !== undefined) clearTimeout(timer);
  if (resultTimer !== undefined) clearTimeout(resultTimer);
  timer = undefined;
  resultTimer = undefined;
  pendingVariantIndex = null;
  if (currentRoute.level && activeRun) snapLevelRun(currentRoute.level.id, activeRun);
}
function closeEditor() {
  ++editorLoadToken;
  if (!editor) return;
  const level = currentRoute.level;
  if (level && currentRoute.screen === 'workspace') {
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
  hintIndex = 0;
  if (currentRoute.level && (currentRoute.level.id !== activeLevelId || currentRoute.screen === 'workspace')) {
    resetVariants(currentRoute.level);
    activeRun = initialProgramState(currentRoute.level);
    activeLevelId = currentRoute.level.id;
  }
  workspaceMode = currentRoute.initialMode ?? 'edit';
  if (currentRoute.screen === 'workspace' && currentRoute.level) {
    const level = currentRoute.level;
    // Existing /editor and /play deep links keep working, but both lead
    // to the same persistent workspace route.
    if (window.location.hash !== routeFor(level,'workspace'))
      window.history.replaceState(null,'',routeFor(level,'workspace'));
    if (workspaceMode === 'test') {
      try {
        activeProgram = compileWorkspace(record(level).workspace ?? defaultWorkspace(level,record(level).blocks),level);
      } catch(error) {
        activeProgram = null;
        activeRun = {...initialProgramState(level),phase:'failed',
          message:error instanceof Error ? error.message : 'Ongeldig programma.'};
      }
    } else activeProgram = null;
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
  if (currentRoute.screen !== 'workspace' || workspaceMode !== 'edit') return false;
  if (!editor) {
    reportEditor('Blockly wordt nog geladen. Probeer opnieuw zodra het palet zichtbaar is.',true);
    return false;
  }
  try {
    const workspace = editor.save();
    const program = compileWorkspace(workspace,level);
    const saved = {...record(level),workspace};
    progress.set(level.id,saved);
    saveLevel(level,saved);
    stopTimers();
    activeProgram = program;
    resetVariants(level);
    activeRun = initialProgramState(level);
    setLevelCanvasVariant(level.id,level);
    snapLevelRun(level.id, activeRun);
    workspaceMode = 'test';
    editor.setReadOnly(true);
    updateWorkspaceLayout();
    if (program.ignoredBlocks)
      reportEditor('Let op: '+program.ignoredBlocks+' losse blok(ken) worden niet uitgevoerd.',false);
    else reportEditor('Testmodus: het programma is vergrendeld. Volg de gemarkeerde blokken.');
    refreshPlayStatus();
    play();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'De blokken kunnen niet worden uitgevoerd.';
    reportEditor(message,true);
    if (error instanceof ProgramError) editor.highlight(error.blockId);
    return false;
  }
}

function returnToEditor() {
  if (currentRoute.screen !== 'workspace' || !currentRoute.level) return;
  const level = currentRoute.level;
  stopTimers();
  resetVariants(level);
  activeRun = initialProgramState(level);
  setLevelCanvasVariant(level.id,level);
  snapLevelRun(level.id, activeRun);
  workspaceMode = 'edit';
  editor?.setReadOnly(false);
  editor?.highlight();
  updateWorkspaceLayout();
  reportEditor('Programma ontgrendeld. Je kunt de blokken weer bewerken.');
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
function map(level: Level, _run?: RunState, preview = false): string {
  // Terrain and robot are rendered by the shared Canvas autotiling renderer.
  // The real level grid remains the single source of truth for the interpreter.
  const description = 'Speelveld ' + level.title +
    ', start op ' + level.start.x + ',' + level.start.y +
    ', doel op ' + level.goal.x + ',' + level.goal.y;
  return '<div class="field-wrap' + (preview ? ' field-preview' : '') + '">' +
    '<canvas class="level-canvas" data-level-board data-level-id="' + escapeText(level.id) +
    '" role="img" aria-label="' + escapeText(description) + '"></canvas></div>';
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
    ).join('') + '</div><div class="future-notice">' + icon('check') +
    '<div><strong>10 missies beschikbaar</strong><span>Nieuwe blokken en uitdagingen komen vrij naarmate de missies moeilijker worden.</span></div></div>' +
    '<a class="btn secondary" href="#/map-prototype" style="margin-top:23px">KAARTLAB: TEST TERREINEN ' + icon('map') + '</a></main>';
}
function crumb(level: Level, step: string): string {
  return '<nav class="breadcrumb" aria-label="Navigatie"><a href="#/levels">MISSIES</a><span>/</span><a href="' +
    routeFor(level,'briefing') + '">MISSIE ' + String(level.number).padStart(2,'0') + '</a><span>/</span><b>' + step + '</b></nav>';
}
function hintMarkup(level:Level):string {
  return '<div class="mission-hint-panel">'+
    '<button class="btn ghost" type="button" data-action="show-hint">'+icon('info')+' TOON HINT</button>'+
    '<span id="mission-hint" aria-live="polite"></span>'+
    '</div>';
}
function briefingScreen(level: Level): string {
  return '<main class="content screen-enter">' + crumb(level,'OPDRACHT') +
    '<div class="briefing-layout"><section class="panel briefing-text"><div class="eyebrow">MISSIEDOSSIER / '+
    String(level.number).padStart(2,'0')+'</div><h1>'+escapeText(level.title)+'</h1>'+
    '<p class="lead">'+escapeText(level.story)+'</p>'+
    '<div class="objective-box"><div class="objective-icon">'+icon('terminal')+'</div>'+
    '<div><span>JOUW OPDRACHT</span><p>'+escapeText(level.objective)+'</p></div></div>'+
    '<p class="mission-learning"><strong>LEERDOEL</strong> '+escapeText((level.learningGoals??[]).join(' · '))+'</p>'+
    (level.maxBlocks?'<p class="mission-restriction">Maximaal '+level.maxBlocks+' gekoppelde codeblokken (zonder startblok).</p>':'')+
    (variantCount(level)>1?'<p class="mission-restriction">Hetzelfde programma moet '+variantCount(level)+' kaartvarianten oplossen.</p>':'')+
    hintMarkup(level)+
    '<div class="briefing-actions"><button class="btn primary" data-action="to-editor">OPEN PROGRAMMEERTERMINAL '+icon('next')+'</button>'+
    '<a class="btn ghost" href="#/levels">'+icon('back')+' MISSIEOVERZICHT</a></div></section>'+
    '<aside class="panel briefing-map"><div class="panel-top"><span>TERREINVERKENNING</span><span>CAM 01</span></div>'+
    map(level)+'<div class="map-legend"><span><i class="dot bot-dot"></i> START</span>'+
    '<span><i class="dot goal-dot"></i> DOEL</span><span><i class="dot hazard-dot"></i> GEVAAR</span></div></aside></div></main>';
}
function workspaceScreen(level: Level): string {
  if (!activeRun) activeRun = initialProgramState(level);
  const run = activeRun;
  const isTesting = workspaceMode === 'test';
  return '<main id="mission-workspace" class="workbench mission-workspace screen-enter '+(isTesting?'mode-test':'mode-edit')+'">' +
    crumb(level, 'WERKPLAATS') +
    '<div class="workspace-heading"><div><div class="eyebrow">PROTOBOT TERMINAL / MISSIE '+String(level.number).padStart(2,'0')+
    '</div><h1 id="workspace-heading-text">'+(isTesting?'Test je programma':'Bouw je route')+
    '<span class="accent">.</span></h1></div>'+
    '<div class="workspace-actions workspace-controls" id="workspace-edit-actions"'+(isTesting?' hidden':'')+'>'+
      button('reset-program','Herstel voorbeeldprogramma','reset')+
      button('to-play','Programma testen','play','tool-primary')+
    '</div>'+
    '<div class="workspace-actions play-toolbar" id="workspace-test-actions"'+(!isTesting?' hidden':'')+
      ' role="toolbar" aria-label="Uitvoering bedienen">'+
      button('back-to-editor','Terug naar programmeren','code')+
      '<span class="toolbar-divider"></span>'+
      button('run','Uitvoeren of hervatten','play','tool-primary')+
      button('pause','Pauzeren','pause')+
      button('step','Eén instructie uitvoeren','step')+
      button('restart','Opnieuw beginnen','reset')+
    '</div></div>'+
    '<div class="blockly-editor-layout"><section class="panel blockly-workspace-panel">'+
      '<div class="panel-top"><span>'+icon('code')+' BLOCKLY / MIJN PROGRAMMA</span>'+
      '<span class="workspace-lock-indicator" id="workspace-mode-label">'+(isTesting?'VERGRENDELD':'BEWERKEN')+'</span></div>'+
      '<div id="blockly-workspace" class="blockly-workspace" aria-label="Blockly-programmeerwerkruimte"></div>'+
      '<div class="blockly-editor-info"><span id="blockly-block-count">Blokken laden…</span>'+
        '<span class="blockly-workspace-note">Sleep blokken uit het palet en sluit ze aan op het startblok.</span></div>'+
      '<div class="workspace-current-instruction" aria-live="polite">'+
        '<div><b>ACTIEF</b> <span id="workspace-current-action">Klaar om te testen</span></div>'+
        '<div class="next-instruction">VOLGENDE: <span id="workspace-next-action">—</span></div>'+
      '</div>'+
      '<p id="blockly-editor-status" class="blockly-editor-status" role="status" aria-live="polite">Blokken laden…</p>'+
      hintMarkup(level)+
    '</section>'+
    '<section class="panel blockly-editor-map workspace-game-panel game-panel">'+
      '<div class="panel-top"><span>VELDCAMERA / SECTOR 07</span><span>CAM 01 <i class="rec-dot"></i> LIVE</span></div>'+
      '<div class="mission-variant" id="mission-variant" aria-live="polite">'+
        'KAART '+(activeVariantIndex+1)+' / '+variantCount(level)+' — '+escapeText(variantLabel(level,activeVariantIndex))+
      '</div>'+
      map(currentMap(level),run)+
      '<div id="mission-variant-results" class="mission-variant-results" aria-live="polite"></div>'+
      '<div class="game-hud">'+
        '<div><span>POSITIE</span><strong>'+run.x+','+run.y+'</strong></div>'+
        '<div><span>RICHTING</span><strong>'+({N:'NOORD',E:'OOST',S:'ZUID',W:'WEST'}[run.direction])+'</strong></div>'+
        '<div><span>STAPPEN</span><strong>'+run.steps+'</strong></div>'+
        '<div><span>STATUS</span><strong>'+(isTesting?'GEREED':'VOORBEELD')+'</strong></div>'+
      '</div>'+
      '<p class="run-message" role="status">'+escapeText(run.message)+'</p>'+
      '<p class="side-caption workspace-edit-note">Druk op Play om het programmeerveld te vergrendelen en het speelveld te vergroten.</p>'+
    '</section></div></main>';
}

/** Switch the two panels without recreating either Blockly or the Canvas. */
function updateWorkspaceLayout() {
  const main = root.querySelector<HTMLElement>('#mission-workspace');
  if (!main) return;
  const test = workspaceMode === 'test';
  main.classList.toggle('mode-test',test);
  main.classList.toggle('mode-edit',!test);
  const heading = root.querySelector<HTMLElement>('#workspace-heading-text');
  if (heading) heading.innerHTML = (test?'Test je programma':'Bouw je route')+'<span class="accent">.</span>';
  const modeLabel = root.querySelector<HTMLElement>('#workspace-mode-label');
  if (modeLabel) modeLabel.textContent = test?'VERGRENDELD':'BEWERKEN';
  const editActions = root.querySelector<HTMLElement>('#workspace-edit-actions');
  const testActions = root.querySelector<HTMLElement>('#workspace-test-actions');
  if (editActions) editActions.hidden = test;
  if (testActions) testActions.hidden = !test;
  editor?.resize();
}
function mountEditorScreen(level:Level) {
  const element=root.querySelector<HTMLElement>('#blockly-workspace');
  if (!element) return;
  const token=++editorLoadToken;
  void import('./blockly-editor').then(({mountBlocklyEditor}) => {
    if (token!==editorLoadToken || currentRoute.screen!=='workspace' || currentRoute.level?.id!==level.id) return;
    editor=mountBlocklyEditor(
      element,level,record(level).workspace ?? defaultWorkspace(level,record(level).blocks),
      (workspace,count) => {
        if (workspaceMode!=='edit') return;
        const saved={...record(level),workspace};
        progress.set(level.id,saved);
        saveLevel(level,saved);
        const label=root.querySelector<HTMLElement>('#blockly-block-count');
        if (label) label.textContent=count+' BLOKKEN IN WERKRUIMTE';
      }
    );
    const count=root.querySelector<HTMLElement>('#blockly-block-count');
    if (count) {
      try { count.textContent=compileWorkspace(editor.save(),level).totalBlocks+' BLOKKEN IN WERKRUIMTE'; }
      catch { count.textContent='Blockly-editor gereed'; }
    }
    editor.setReadOnly(workspaceMode==='test');
    if (workspaceMode==='test') {
      reportEditor('Testmodus: het programma is vergrendeld. Volg de gemarkeerde blokken.');
      refreshPlayStatus();
    } else reportEditor('Je wijzigingen worden automatisch opgeslagen op dit apparaat.');
    requestAnimationFrame(()=>editor?.resize());
  }).catch(() => {
    if (token===editorLoadToken) reportEditor('Blockly kon niet worden geladen. Vernieuw de pagina.',true);
  });
}
function resultScreen(level: Level): string {
  const run = activeRun;
  const won = run?.phase === 'won';
  return '<main class="result-screen screen-enter"><section class="panel result-panel">' +
    '<div class="result-symbol ' + (won ? 'win' : 'retry') + '">' + icon(won ? 'check' : 'alert') + '</div>' +
    '<div class="eyebrow">MISSIE ' + String(level.number).padStart(2,'0') + ' / RESULTAAT</div>' +
    '<h1>' + (won ? 'Missie geslaagd!' : 'Nog niet gelukt.') + '</h1>' +
    '<p>' + escapeText(run?.message ?? 'Voer eerst een test uit om je resultaat te zien.') + '</p>' +
    '<p class="mission-success-log">'+(won?escapeText(level.successLog??'Missie afgerond.'): 'Controleer het gemarkeerde Blockly-blok en probeer het opnieuw.')+'</p>'+
    '<div class="mission-result-maps">'+variantResults.map((result,i)=>
       '<span class="mission-result-map '+result+'">Kaart '+(i+1)+': '+
         (result==='passed'?'geslaagd':result==='failed'?'mislukt':'niet getest')+'</span>').join('')+'</div>'+
    '<div class="result-stats"><div><strong>' + (run?.steps ?? 0) + '</strong><span>UITGEVOERDE STAPPEN</span></div>' +
    '<div><strong>' + (activeProgram?.totalBlocks ?? 0) + '</strong><span>CODEBLOKKEN</span></div></div>' +
    '<div class="result-actions"><button class="btn primary" data-action="to-editor">' +
    (won ? 'PROGRAMMA BEKIJKEN' : 'PROBEER OPNIEUW') + ' ' + icon('code') + '</button>' +
    '<button class="btn secondary" data-action="to-levels">MISSIEOVERZICHT ' + icon('map') + '</button></div></section></main>';
}
function render() {
  unmountLevelCanvases();
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
    if (route.screen === 'workspace') body = workspaceScreen(route.level);
    if (route.screen === 'result') body = resultScreen(route.level);
  }
  root.innerHTML = header() + (storageWarning() ? '<div class="storage-warning" role="alert">' + escapeText(storageWarning()) + '</div>' : '') + body + footer();
  if (route.screen === 'map') mountMapPrototype();
  mountLevelCanvases(root, level => (
    route.screen === 'workspace' && route.level?.id === level.id
      ? activeRun ?? initialState(level) : initialState(level)
  ), level => route.screen === 'workspace' && route.level?.id === level.id
    ? currentMap(level) : level);
  if (route.screen === 'workspace' && route.level) mountEditorScreen(route.level);
}
/**
 * Patch only the rail and HUD. Never replace #app or the play Canvas during
 * execution: doing so would drop the current frame and recreate the map.
 */
function refreshPlayStatus() {
  if (currentRoute.screen !== 'workspace' || workspaceMode !== 'test' ||
      !currentRoute.level || !activeRun) return;
  const level = currentRoute.level;
  const run = activeRun;

  // Blockly stays mounted while the current and next real block are highlighted.
  const inFlight = animationPending && animatingBlockId && animatingNextState
    ? {blockId:animatingBlockId,destination:animatingNextState} : undefined;
  const focus = executionFocus(currentMap(level),activeProgram,run,inFlight);
  editor?.highlight(focus.activeId,focus.upcomingId);
  const currentLabel = root.querySelector<HTMLElement>('#workspace-current-action');
  const nextLabel = root.querySelector<HTMLElement>('#workspace-next-action');
  if (currentLabel && currentLabel.textContent !== focus.activeLabel)
    currentLabel.textContent = focus.activeLabel;
  if (nextLabel && nextLabel.textContent !== focus.upcomingLabel)
    nextLabel.textContent = focus.upcomingLabel;

  const values = [
    run.x + ',' + run.y,
    ({N:'NOORD', E:'OOST', S:'ZUID', W:'WEST'} as const)[run.direction],
    String(run.steps),
    run.phase === 'running' ? 'ACTIEF' :
      run.phase === 'ready' ? 'GEREED' :
      run.phase === 'paused' ? 'PAUZE' :
      run.phase === 'won' ? 'GESLAAGD' : 'MISLUKT'
  ];
  const stats = root.querySelectorAll<HTMLElement>('.game-hud strong');
  stats.forEach((node,i) => { if (node.textContent !== values[i]) node.textContent = values[i]; });
  stats[3]?.classList.toggle('is-running',run.phase === 'running');
  const message = root.querySelector<HTMLElement>('.game-panel .run-message');
  if (message && message.textContent !== run.message) message.textContent = run.message;
  const playButton = root.querySelector<HTMLButtonElement>('[data-action="run"]');
  playButton?.classList.toggle('is-active',autoRun);
  playButton?.setAttribute('aria-pressed',String(autoRun));
  const stepButton = root.querySelector<HTMLButtonElement>('[data-action="step"]');
  if (stepButton) stepButton.disabled = animationPending && autoRun;
  const indicator = root.querySelector<HTMLElement>('#mission-variant');
  if (indicator) indicator.textContent = 'KAART '+(activeVariantIndex+1)+' / '+
    variantCount(level)+' — '+variantLabel(level,activeVariantIndex);
  const results = root.querySelector<HTMLElement>('#mission-variant-results');
  if (results) results.textContent = variantResults.map((result,i)=>
    'KAART '+(i+1)+': '+(result==='passed'?'✓':result==='failed'?'✕':i===activeVariantIndex?'ACTIEF':'—')).join('  ·  ');
}

/** Continue the very same compiled Blockly program on the next mission map. */
function advanceVariant() {
  const level = currentRoute.level;
  if (!level || pendingVariantIndex === null || currentRoute.screen!=='workspace') return;
  activeVariantIndex = pendingVariantIndex;
  pendingVariantIndex = null;
  const map = currentMap(level);
  activeRun = initialProgramState(map);
  setLevelCanvasVariant(level.id,map);
  snapLevelRun(level.id,activeRun);
  refreshPlayStatus();
  if (autoRun) scheduleNextStep(420);
}

function scheduleNextStep(delay = 90) {
  if (!autoRun || animationPending) return;
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; void runOneStep(); }, delay);
}

async function runOneStep() {
  const base = currentRoute.level;
  const level = base && currentMap(base);
  if (currentRoute.screen !== 'workspace' || workspaceMode !== 'test' || !level || !activeRun || !activeProgram ||
      animationPending || activeRun.phase === 'won' || activeRun.phase === 'failed') return;
  if (resultTimer !== undefined) { clearTimeout(resultTimer); resultTimer = undefined; }
  const token = executionToken;
  const before = activeRun;
  const next = executeProgramStep(level, activeProgram, before);
  animationPending = true;
  animatingBlockId = visibleInstruction(activeProgram,before.pc)?.instruction.blockId;
  animatingNextState = next;
  activeRun.phase = autoRun ? 'running' : 'paused';
  refreshPlayStatus();
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  await animateLevelRun(level.id, before, next, motionDuration(before, next, reduce));
  if (token !== executionToken || currentRoute.screen !== 'workspace' || workspaceMode !== 'test' || currentRoute.level?.id !== level.id) return;
  animationPending = false;
  animatingBlockId = undefined;
  animatingNextState = undefined;
  activeRun = next;
  if (next.phase === 'won' || next.phase === 'failed') {
    variantResults[activeVariantIndex] = next.phase === 'won' ? 'passed' : 'failed';
    // A win on one map does not complete a multi-variant level.
    if (next.phase === 'won' && base && activeVariantIndex < variantCount(base)-1) {
      pendingVariantIndex = activeVariantIndex + 1;
      refreshPlayStatus();
      if (autoRun) timer = setTimeout(() => { timer=undefined; advanceVariant(); },850);
      return;
    }
    autoRun = false;
    if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
    if (next.phase === 'won' && base) setCompleted(base);
    refreshPlayStatus();
    resultTimer = setTimeout(() => navigate(routeFor(level, 'result')), 850);
    return;
  }
  activeRun.phase = autoRun ? 'running' : 'paused';
  refreshPlayStatus();
  if (autoRun) scheduleNextStep();
}

function play() {
  if (currentRoute.screen !== 'workspace' || workspaceMode !== 'test' || !currentRoute.level || !activeRun || !activeProgram ||
      autoRun || (pendingVariantIndex === null && (activeRun.phase === 'won' || activeRun.phase === 'failed'))) return;
  autoRun = true;
  if (pendingVariantIndex !== null) { advanceVariant(); return; }
  activeRun.phase = 'running';
  if (animationPending) resumeLevelAnimation(currentRoute.level.id);
  else scheduleNextStep(0);
  refreshPlayStatus();
}

function pause() {
  if (currentRoute.screen !== 'workspace' || workspaceMode !== 'test' || !currentRoute.level || !activeRun) return;
  if (!autoRun && !animationPending) return;
  autoRun = false;
  if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
  if (animationPending) pauseLevelAnimation(currentRoute.level.id);
  activeRun.phase = 'paused';
  activeRun.message = 'Uitvoering gepauzeerd.';
  refreshPlayStatus();
}

function singleStep() {
  if (currentRoute.screen !== 'workspace' || workspaceMode !== 'test' || !currentRoute.level || !activeRun) return;
  autoRun = false;
  if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
  if (pendingVariantIndex !== null) { advanceVariant(); return; }
  if (animationPending) {
    // Finish the already-started movement and stop exactly after that block.
    resumeLevelAnimation(currentRoute.level.id);
    activeRun.phase = 'paused';
    refreshPlayStatus();
    return;
  }
  void runOneStep();
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
  if (action === 'to-editor' && level) navigate(routeFor(level,'workspace'));
  if (action === 'to-play' && level) prepareRun(level);
  if (action === 'back-to-editor') returnToEditor();
  if (action === 'reset-program' && level && editor) {
    editor.reset();
    reportEditor('Voorbeeldprogramma hersteld.');
  }
  if (action === 'run') play();
  if (action === 'pause') pause();
  if (action === 'step') singleStep();
  if (action === 'restart' && level && currentRoute.screen === 'workspace' && workspaceMode === 'test') {
    stopTimers();
    resetVariants(level);
    activeRun = initialProgramState(level);
    setLevelCanvasVariant(level.id,level);
    snapLevelRun(level.id, activeRun);
    refreshPlayStatus();
  }
  if (action === 'show-hint' && level) {
    const hints=level.hints??[level.hint];
    const hint=root.querySelector<HTMLElement>('#mission-hint');
    if (hint && hints.length) {
      hint.textContent='HINT '+(Math.min(hintIndex+1,hints.length))+'/'+hints.length+': '+
        hints[Math.min(hintIndex,hints.length-1)];
      hintIndex=Math.min(hints.length,hintIndex+1);
    }
  }
});
window.addEventListener('hashchange', onRouteChange);
currentRoute = readRoute();
workspaceMode = currentRoute.initialMode ?? 'edit';
if (currentRoute.screen === 'workspace' && currentRoute.level &&
    window.location.hash !== routeFor(currentRoute.level,'workspace'))
  window.history.replaceState(null,'',routeFor(currentRoute.level,'workspace'));
if (currentRoute.level) {
  resetVariants(currentRoute.level);
  activeLevelId = currentRoute.level.id;
  activeRun = initialProgramState(currentRoute.level);
  if (currentRoute.screen === 'workspace' && workspaceMode === 'test') {
    try { activeProgram=compileWorkspace(record(currentRoute.level).workspace ?? defaultWorkspace(currentRoute.level,record(currentRoute.level).blocks),currentRoute.level); }
    catch(error) { activeProgram=null;activeRun.phase='failed';activeRun.message=error instanceof Error?error.message:'Ongeldig programma.'; }
  }
}
render();
if (booting) setTimeout(() => { booting = false; onRouteChange(); }, 600);
