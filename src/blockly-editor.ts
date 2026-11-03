import * as Blockly from 'blockly/core';
import * as Nl from 'blockly/msg/nl';
import type { Level } from './game';
import { defaultWorkspace } from './program';

export interface BlocklyEditorHandle {
  save(): object;
  reset(): void;
  /** Keep all blocks visible; do not recreate the workspace between modes. */
  setReadOnly(readOnly: boolean): void;
  /** Active instruction and a subtler indication of the upcoming instruction. */
  highlight(blockId?: string, nextBlockId?: string): void;
  resize(): void;
  dispose(): void;
}
const protobotTheme = Blockly.Theme.defineTheme('ProtoBot', {
  name: 'ProtoBot',
  base: Blockly.Themes.Zelos,
  componentStyles: {
    workspaceBackgroundColour: '#122125',
    toolboxBackgroundColour: '#142a2f',
    toolboxForegroundColour: '#e3f2f0',
    flyoutBackgroundColour: '#193238',
    flyoutForegroundColour: '#e3f2f0',
    flyoutOpacity: 1,
    scrollbarColour: '#557a7c',
    scrollbarOpacity: 0.7,
    insertionMarkerColour: '#7cf4d9',
    insertionMarkerOpacity: 0.5,
    selectedGlowColour: '#7cf4d9',
    selectedGlowOpacity: 0.8,
    cursorColour: '#7cf4d9',
    markerColour: '#7cf4d9'
  }
});
let registered = false;
function registerBlocks(): void {
  if (registered) return;
  Blockly.setLocale(Nl as unknown as Record<string,string>);
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'pb_start', message0:'wanneer missie start', message1:'%1',
      args1:[{type:'input_statement',name:'DO'}], colour:'#178f84',
      tooltip:'De robot begint bij dit vaste startblok.'
    },
    {type:'pb_forward',message0:'↑ rij één vak vooruit',previousStatement:null,nextStatement:null,colour:'#198b78',tooltip:'Rij één vak in de huidige richting.'},
    {type:'pb_left',message0:'↶ draai 90° linksom',previousStatement:null,nextStatement:null,colour:'#a67b37'},
    {type:'pb_right',message0:'↷ draai 90° rechtsom',previousStatement:null,nextStatement:null,colour:'#a67b37'},
    {type:'pb_scan',message0:'◎ scan het vak vooruit',previousStatement:null,nextStatement:null,colour:'#387e9b'},
    {type:'pb_path_clear',message0:'pad vrij vooruit?',output:'Boolean',colour:'#3b789b'},
    {type:'pb_on_goal',message0:'op doel?',output:'Boolean',colour:'#3b789b'},
    {
      type:'pb_terrain',message0:'tegel %1 is %2 ?',
      args0:[
        {type:'field_dropdown',name:'WHERE',options:[['voor mij','AHEAD'],['onder mij','UNDER']]},
        {type:'field_dropdown',name:'TERRAIN',options:[['gras','grass'],['steen','stone'],['aarde','dirt'],['zand','sand'],['water','water'],['lava','lava']]}
      ], output:'Boolean',colour:'#3b789b'
    },
    {
      type:'pb_if',message0:'als %1',args0:[{type:'input_value',name:'COND',check:'Boolean'}],
      message1:'dan %1',args1:[{type:'input_statement',name:'THEN'}],
      previousStatement:null,nextStatement:null,colour:'#8360ad'
    },
    {
      type:'pb_if_else',message0:'als %1',args0:[{type:'input_value',name:'COND',check:'Boolean'}],
      message1:'dan %1',args1:[{type:'input_statement',name:'THEN'}],
      message2:'anders %1',args2:[{type:'input_statement',name:'ELSE'}],
      previousStatement:null,nextStatement:null,colour:'#8360ad'
    },
    {
      type:'pb_repeat',message0:'herhaal %1 keer',args0:[{type:'field_number',name:'COUNT',value:3,min:1,max:20,precision:1}],
      message1:'doe %1',args1:[{type:'input_statement',name:'DO'}],
      previousStatement:null,nextStatement:null,colour:'#ad6a38'
    },
    {
      type:'pb_until',message0:'herhaal totdat %1',args0:[{type:'input_value',name:'COND',check:'Boolean'}],
      message1:'doe %1',args1:[{type:'input_statement',name:'DO'}],
      previousStatement:null,nextStatement:null,colour:'#ad6a38'
    }
  ]);
  registered = true;
}
function toolbox(level: Level): Blockly.utils.toolbox.ToolboxDefinition {
  const block = (type:string) => ({kind:'block',type});
  const categories: Array<{kind:'category';name:string;colour:string;contents:ReturnType<typeof block>[]}> = [
    {kind:'category',name:'Bewegen',colour:'#198b78',contents:[block('pb_forward'),block('pb_left'),block('pb_right')]},
    {kind:'category',name:'Scannen',colour:'#3b789b',contents:[block('pb_scan')]}
  ];
  if (level.number > 1) categories.push(
    {kind:'category',name:'Sensoren',colour:'#3b789b',contents:[block('pb_path_clear'),block('pb_terrain'),block('pb_on_goal')]},
    {kind:'category',name:'Beslissingen',colour:'#8360ad',contents:[block('pb_if'),block('pb_if_else')]},
    {kind:'category',name:'Herhalen',colour:'#ad6a38',contents:[block('pb_repeat'),block('pb_until')]}
  );
  return {kind:'categoryToolbox',contents:categories};
}
export function mountBlocklyEditor(
  element:HTMLElement,level:Level,initialState:unknown,onChange:(state:object,blocks:number)=>void
):BlocklyEditorHandle {
  registerBlocks();
  const workspace = Blockly.inject(element, {
    toolbox:toolbox(level),renderer:'zelos',theme:protobotTheme,
    trashcan:true,scrollbars:true,
    zoom:{controls:true,wheel:true,startScale:0.9,minScale:0.55,maxScale:1.5,scaleSpeed:1.12},
    move:{scrollbars:true,drag:true,wheel:true},
    grid:{spacing:24,length:2,colour:'#365054',snap:true}
  });
  const apply = (state:unknown) => {
    try { Blockly.serialization.workspaces.load(state as Parameters<typeof Blockly.serialization.workspaces.load>[0],workspace); }
    catch { Blockly.serialization.workspaces.load(defaultWorkspace(level) as Parameters<typeof Blockly.serialization.workspaces.load>[0],workspace); }
    const start=workspace.getTopBlocks(false).find(b=>b.type==='pb_start');
    if (start) {
      start.setDeletable(false);
      start.setMovable(false);
    }
    Blockly.svgResize(workspace);
  };
  apply(initialState);
  const snapshot=()=>Blockly.serialization.workspaces.save(workspace) as object;
  const changed=()=>onChange(snapshot(),Math.max(0,workspace.getAllBlocks(false).length-1));
  const listener=(event:Blockly.Events.Abstract)=>{
    if (event.isUiEvent || workspace.isReadOnly()) return;
    if (event.type === Blockly.Events.BLOCK_CREATE || event.type === Blockly.Events.BLOCK_DELETE ||
        event.type === Blockly.Events.BLOCK_MOVE || event.type === Blockly.Events.BLOCK_CHANGE) changed();
  };
  workspace.addChangeListener(listener);
  const observer = new ResizeObserver(()=>Blockly.svgResize(workspace));
  observer.observe(element);
  let disposed = false;
  let readOnly = false;
  let activeId: string | undefined;
  let upcomingId: string | undefined;
  const resize = () => {
    if (!disposed) Blockly.svgResize(workspace);
  };
  const updateHighlight = (blockId?:string, nextBlockId?:string) => {
    if (disposed) return;
    const active = blockId && workspace.getBlockById(blockId) ? blockId : undefined;
    const upcoming = nextBlockId && nextBlockId !== active && workspace.getBlockById(nextBlockId)
      ? nextBlockId : undefined;
    if (active === activeId && upcoming === upcomingId) return;
    if (activeId) workspace.getBlockById(activeId)?.removeClass('protobot-block-active');
    if (upcomingId) workspace.getBlockById(upcomingId)?.removeClass('protobot-block-next');
    activeId = active;
    upcomingId = upcoming;
    workspace.highlightBlock(active ?? null);
    if (active) {
      const block = workspace.getBlockById(active);
      block?.addClass('protobot-block-active');
      // Only scroll when a block is outside the visible editor: no jumping
      // between instructions already on screen.
      const shape = block?.getSvgRoot()?.querySelector('.blocklyPath');
      const bounds = shape?.getBoundingClientRect();
      const viewport = element.getBoundingClientRect();
      if (bounds && (bounds.bottom < viewport.top + 28 || bounds.top > viewport.bottom - 42 ||
          bounds.right < viewport.left + 35 || bounds.left > viewport.right - 35)) {
        workspace.centerOnBlock(active);
      }
    }
    if (upcoming) workspace.getBlockById(upcoming)?.addClass('protobot-block-next');
  };
  requestAnimationFrame(resize);
  return {
    save:snapshot,
    reset:()=>{
      if (readOnly) return;
      updateHighlight();
      apply(defaultWorkspace(level));
      changed();
    },
    setReadOnly:(value:boolean)=>{
      if (disposed || value === readOnly) return;
      readOnly = value;
      workspace.hideChaff();
      workspace.setIsReadOnly(value);
      workspace.getToolbox()?.setVisible(!value);
      element.classList.toggle('is-readonly',value);
      resize();
      requestAnimationFrame(resize);
    },
    highlight:updateHighlight,
    resize,
    dispose:()=>{
      if(disposed)return;
      disposed=true;
      observer.disconnect();
      workspace.removeChangeListener(listener);
      workspace.dispose();
    }
  };
}
