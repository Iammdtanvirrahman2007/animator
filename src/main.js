import {freshProject} from './core/state.js';import {modeOrder,getMode,nextMode} from './modes/mode-manager.js';
window.KeyframeCore={freshProject,modeOrder,getMode,nextMode};
// Compatibility bridge: the legacy renderer remains the execution engine while mode definitions are modularized.
// New features should be implemented in src/modes and src/tools instead of growing index.html.
