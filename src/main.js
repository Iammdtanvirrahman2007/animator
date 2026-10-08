import {freshProject} from './core/state.js';
import {modeOrder,getMode,nextMode,modes} from './modes/mode-manager.js';
window.KeyframeCore={freshProject,modeOrder,getMode,nextMode,modes};
window.KeyframeModes=modes;
window.dispatchEvent(new Event('keyframe:modes-ready'));
