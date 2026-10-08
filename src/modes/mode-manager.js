import {objectMode} from './object-mode.js';import {drawMode} from './draw-mode.js';import {editMode} from './edit-mode.js';import {animateMode} from './animate-mode.js';import {cameraMode} from './camera-mode.js';import {maskMode} from './mask-mode.js';
export const modes={object:objectMode,draw:drawMode,edit:editMode,animate:animateMode,camera:cameraMode,mask:maskMode};
export const modeOrder=Object.keys(modes);
export const getMode=id=>modes[id]||modes.object;
export function nextMode(id){return modeOrder[(modeOrder.indexOf(id)+1)%modeOrder.length]}