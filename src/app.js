import { freshProject, normalizeProject, clone, clamp, WIDTH, HEIGHT, drawingAt, sortedFrames, transformAt, captureTransform, keyframeAt, exposedFrame } from './core/model.js';
import { createHistory } from './core/history.js';
import { renderFrame, pointFromEvent, hitStroke, nearestPoint } from './core/renderer.js';
import { exportPNG, exportWebM, exportMP4 } from './core/export.js';
import { greasePencilMode } from './modes/grease-pencil-mode.js';

const $ = id => document.getElementById(id);
const canvas = $('stage-canvas');
const context = canvas.getContext('2d', { alpha: false });
const colorInput = $('brush-color'), widthInput = $('brush-size'), fillInput = $('fill-enabled'), fillColorInput = $('fill-color');
const clampN = (value, low, high) => Math.max(low, Math.min(high, value));
const TOOLSETS = {
  object: [['select','↖','Select and move strokes'],['pencil','✎','Draw stroke (D)'],['erase','⌫','Erase stroke (E)'],['line','／','Line (L)'],['rect','▭','Rectangle (B)'],['ellipse','◯','Ellipse (O)'],['fill','▨','Fill a closed shape (F)']],
  draw: [['pencil','✎','Draw stroke (D)'],['erase','⌫','Eraser (E)'],['line','／','Line (L)'],['rect','▭','Rectangle (B)'],['ellipse','◯','Ellipse (O)'],['fill','▨','Fill a closed shape (F)']],
  edit: [['select','↖','Select stroke'],['point','·','Edit control points'],['erase','⌫','Erase stroke']],
  animate: [['select','↖','Select object'],['pencil','✎','Draw a new exposure'],['erase','⌫','Erase stroke'],['line','／','Line'],['rect','▭','Rectangle'],['ellipse','◯','Ellipse']],
  camera: [['select','↖','Select / move camera view'],['cameraMove','✥','Move view (G)'],['cameraRotate','↻','Rotate view (R)'],['cameraZoom','⊙','Zoom view (S)']],
  mask: [['pencil','✎','Draw mask'],['rect','▭','Rectangle mask'],['ellipse','◯','Ellipse mask'],['erase','⌫','Erase mask']],
  grease: greasePencilMode.tools || [['select','↖','Select']]
};
let project = loadProject();
let mode = 'draw';
let tool = 'pencil';
let history;
let selectedStroke = null;
let selectedLayer = project.i;
let selectedPoint = -1;
let pointer = null;
let preview = null;
let playing = false;
let playRequest = 0;
let lastTick = 0;
let lastAutosave = 0;
let cameraGesture = null;
let objectTransform = null;
let lastCanvasPoint = [WIDTH / 2, HEIGHT / 2];
let maskDraft = null;
let statusTimer = 0;
let gridVisible = false;
let canvasZoom = 1;
let dirty = false;
let opacitySnapshotTaken = false;
let backgroundSnapshotTaken = false;

function loadProject() {
  try {
    const raw = localStorage.getItem('keyframe.project.v4') || localStorage.getItem('keyframe.project.v3') || localStorage.getItem('keyframe.project.v2');
    return raw ? normalizeProject(JSON.parse(raw)) : freshProject();
  } catch (error) {
    return freshProject();
  }
}

history = createHistory(() => project, value => { project = value; selectedStroke = null; selectedPoint = -1; selectedLayer = project.i; });

function activeLayer() { return project.l[project.i] || project.l[0]; }
function status(message, temporary = true) {
  $('status-text').textContent = message;
  clearTimeout(statusTimer);
  if (temporary) statusTimer = setTimeout(() => { $('status-text').textContent = dirty ? 'Unsaved changes' : 'Ready'; }, 4200);
}
function scheduleAutosave() {
  if (!dirty) return;
  $('save-indicator').textContent = '●';
  clearTimeout(lastAutosave);
  lastAutosave = setTimeout(() => {
    try {
      localStorage.setItem('keyframe.project.v4', JSON.stringify(project));
      dirty = false;
      $('save-indicator').textContent = '✓';
    } catch (error) {
      status('Browser storage is full. Save the project JSON to keep your work.');
    }
  }, 500);
}
function markDirty() {
  dirty = true;
  scheduleAutosave();
}
function takeSnapshot() {
  history.snapshot();
  markDirty();
  updateHistoryButtons();
}
function updateHistoryButtons() {
  $('undo-btn').disabled = !history.canUndo;
  $('redo-btn').disabled = !history.canRedo;
}
function render() {
  if (mode === 'grease') {
    try { greasePencilMode.ensure(project); } catch (error) { status('Could not initialise the 3D workspace: ' + error.message); }
  }
  renderFrame(context, project, project.f, {
    mode, grid: gridVisible,
    onion: true,
    cameraView: true,
    selectedStroke: selectedStroke && selectedLayer === project.i ? selectedStroke : null,
    selectedLayer: selectedLayer,
    preview: mode === 'mask' ? null : preview,
    greaseMode: { draw: window.GreasePencil3D.draw }
  });
  renderTimeline();
  renderLayers();
  renderProperties();
  updateHistoryButtons();
  scheduleAutosave();
}
function renderProperties() {
  const layer = activeLayer();
  $('layer-name').value = layer?.n || '';
  $('layer-visible').checked = !!layer?.v;
  $('layer-opacity').value = Math.round((layer?.opacity ?? 1) * 100);
  $('layer-opacity-value').textContent = $('layer-opacity').value + '%';
  $('blend-mode').value = layer?.bm || 'source-over';
  $('interpolation').value = layer?.e || 'ease';
  $('frame-current').value = project.f;
  $('frame-start').value = project.a;
  $('frame-end').value = project.b;
  $('fps-value').value = project.fps;
  $('onion-count').value = project.on;
  $('background-color').value = /^#[0-9a-f]{6}$/i.test(project.bg) ? project.bg : '#fbfaf7';
  $('mode-select').value = mode;
  $('document-title').textContent = project.name || 'Untitled Animation';
  $('tool-title').textContent = (TOOLSETS[mode] || [])[0] ? mode[0].toUpperCase() + mode.slice(1) + ' workspace' : 'Workspace';
  $('play-btn').textContent = playing ? 'Ⅱ' : '▶';
  $('play-btn').title = playing ? 'Pause playback (Space)' : 'Play animation (Space)';
  $('zoom-indicator').textContent = Math.round(canvasZoom * 100) + '%';
  $('grid-btn').classList.toggle('active', gridVisible);
  $('onion-btn').classList.toggle('active', project.on > 0);
}
function renderTools() {
  const items = TOOLSETS[mode] || TOOLSETS.object;
  $('tool-shelf').innerHTML = items.map(item =>
    '<button type="button" class="tool-button' + (tool === item[0] ? ' active' : '') +
    '" data-tool="' + item[0] + '" title="' + item[2].replace(/"/g, '&quot;') + '" aria-label="' + item[2].replace(/"/g, '&quot;') + '">' +
    '<span>' + item[1] + '</span><small>' + item[2].split(' (')[0] + '</small></button>'
  ).join('');
}
function renderLayers() {
  $('layer-list').innerHTML = project.l.map((layer, index) =>
    '<div class="layer-row' + (index === project.i ? ' selected' : '') + '" data-layer="' + index + '">' +
    '<button class="visibility-button" type="button" data-visible="' + index + '" title="Toggle visibility">' + (layer.v ? '◉' : '○') + '</button>' +
    '<span class="layer-color"></span><span class="layer-label">' + escapeHTML(layer.n) + '</span>' +
    '<button class="layer-more" type="button" data-layer-menu="' + index + '" title="Select layer">⋮</button></div>'
  ).join('');
  $('layer-count').textContent = project.l.length;
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function timelineWindow() {
  const count = Math.min(48, Math.max(1, project.b - project.a + 1));
  let first = clampN(project.f - Math.floor(count / 2), project.a, Math.max(project.a, project.b - count + 1));
  return Array.from({ length: count }, (_, index) => first + index);
}
function renderTimeline() {
  const frames = timelineWindow();
  const ruler = '<div class="timeline-ruler"><div class="track-name ruler-label">FRAME</div>' +
    frames.map(frame => '<button type="button" class="ruler-frame' + (frame === project.f ? ' current' : '') +
    '" data-frame="' + frame + '">' + frame + '</button>').join('') + '</div>';
  const rows = project.l.map((layer, index) => '<div class="track-row" data-track-layer="' + index + '">' +
    '<div class="track-name"><span>' + escapeHTML(layer.n) + '</span></div>' +
    frames.map(frame => {
      const hasDrawing = Object.prototype.hasOwnProperty.call(layer.d, String(frame));
      const hasKey = Object.prototype.hasOwnProperty.call(layer.k, String(frame));
      return '<button type="button" data-frame="' + frame + '" data-track="' + index + '" class="track-cell' +
        (frame === project.f ? ' current' : '') + (hasDrawing ? ' drawing-key' : '') + (hasKey ? ' transform-key' : '') +
        '" title="Layer ' + (index + 1) + ', frame ' + frame + (hasDrawing ? ', drawing' : '') + (hasKey ? ', transform keyframe' : '') + '"></button>';
    }).join('') + '</div>').join('');
  $('timeline-content').innerHTML = ruler + rows;
  $('timeline-range-label').textContent = project.a + '–' + project.b;
}
function refreshUI() {
  renderTools(); renderLayers(); renderTimeline(); renderProperties(); render(); updateHistoryButtons();
}
function setMode(next) {
  if (!TOOLSETS[next]) return;
  if (mode === 'grease' && next !== 'grease') {
    try { greasePencilMode.exit({ S: project, render, ui: refreshUI, get md() { return pointer; }, set md(value) { pointer = value; } }); } catch (error) {}
  }
  mode = next;
  tool = next === 'draw' ? 'pencil' : next === 'camera' ? 'select' : next === 'grease' ? 'select' : next === 'edit' ? 'point' : 'select';
  if (mode === 'grease') {
    try { greasePencilMode.enter({ S: project, render, ui: refreshUI }); } catch (error) { status('3D workspace initialisation failed: ' + error.message); }
  }
  selectedStroke = null; selectedPoint = -1; pointer = null; preview = null; cameraGesture = null; objectTransform = null;
  $('mode-select').value = mode;
  renderTools(); render();
  status(mode === 'grease' ? 'Grease Pencil 3D: MMB orbit · Shift+MMB pan · wheel dolly' : mode[0].toUpperCase() + mode.slice(1) + ' mode');
}
function selectLayer(index) {
  if (!project.l[index]) return;
  project.i = index; selectedLayer = index; selectedStroke = null; selectedPoint = -1;
  refreshUI();
}
function addLayer() {
  takeSnapshot();
  const next = project.l.length + 1;
  project.l.splice(project.i + 1, 0, { n: 'Layer ' + next, v: 1, opacity: 1, bm: 'source-over', e: 'ease', px: WIDTH / 2, py: HEIGHT / 2, d: {}, k: {} });
  project.i++; selectedLayer = project.i;
  refreshUI(); status('Layer added');
}
function removeLayer() {
  if (project.l.length < 2) return status('A project must contain at least one layer.');
  takeSnapshot(); project.l.splice(project.i, 1); project.i = Math.max(0, project.i - 1); selectedLayer = project.i;
  selectedStroke = null; refreshUI(); status('Layer removed');
}
function moveLayer(direction) {
  const target = project.i + direction;
  if (target < 0 || target >= project.l.length) return;
  takeSnapshot();
  const layer = project.l.splice(project.i, 1)[0]; project.l.splice(target, 0, layer); project.i = target; selectedLayer = target;
  refreshUI();
}
function setFrame(frame) {
  project.f = clampN(Math.round(Number(frame) || project.a), project.a, project.b);
  selectedStroke = null; selectedPoint = -1;
  render();
}
function toggleKeyframe() {
  const layer = activeLayer(); if (!layer) return;
  takeSnapshot();
  if (keyframeAt(layer, project.f)) delete layer.k[project.f];
  else captureTransform(layer, project.f);
  refreshUI(); status(keyframeAt(layer, project.f) ? 'Transform keyframe inserted' : 'Transform keyframe removed');
}
function duplicateExposure() {
  const layer = activeLayer(); if (!layer) return;
  takeSnapshot();
  layer.d[project.f] = clone(drawingAt(layer, project.f));
  refreshUI(); status('Drawing duplicated to frame ' + project.f);
}
function deleteExposure() {
  const layer = activeLayer(); if (!layer || !Object.prototype.hasOwnProperty.call(layer.d, String(project.f))) return status('No drawing on this frame.');
  takeSnapshot(); delete layer.d[project.f]; selectedStroke = null; refreshUI();
}
function fitCanvas() {
  const parent = $('stage-wrap');
  const ratio = Math.min(parent.clientWidth / WIDTH, parent.clientHeight / HEIGHT) * canvasZoom;
  canvas.style.width = Math.max(1, Math.floor(WIDTH * ratio)) + 'px';
  canvas.style.height = Math.max(1, Math.floor(HEIGHT * ratio)) + 'px';
}
function getStrokeLayer(stroke = selectedStroke) {
  if (!stroke) return null;
  for (let index = 0; index < project.l.length; index++) if ((project.l[index].d[project.f] || []).includes(stroke)) return index;
  return project.i;
}
function createShape(toolName, start, end) {
  if (toolName === 'line') return { shape: 'line', p: [start, end], closed: false };
  if (toolName === 'rect') return { shape: 'rect', p: [start, end], closed: true };
  if (toolName === 'ellipse') return { shape: 'ellipse', p: [start, end], closed: true };
  return { shape: 'path', p: [start], closed: false };
}
function canvasCoordinates(event) { return pointFromEvent(canvas, event); }
function greaseContext() {
  return {
    S: project, snap: takeSnapshot, render, ui: refreshUI, msg: status, col: colorInput, sz: widthInput, fl: fillInput,
    get tool() { return tool; }, set tool(value) { tool = value; },
    get md() { return pointer; }, set md(value) { pointer = value; },
    cancelSnap() { history.discardLatestSnapshot(); }
  };
}
function inverseCameraPoint(point) {
  if (mode !== 'camera' || !project.camera) return point;
  const cam = project.camera, angle = cam.r * Math.PI / 180, dx = point[0] - WIDTH / 2, dy = point[1] - HEIGHT / 2;
  const x = dx / cam.zoom, y = dy / cam.zoom;
  const c = Math.cos(angle), s = Math.sin(angle);
  return [cam.x + x * c - y * s, cam.y + x * s + y * c];
}
function beginCameraGesture(event) {
  const action = tool === 'cameraRotate' ? 'rotate' : tool === 'cameraZoom' ? 'zoom' : 'move';
  const start = canvasCoordinates(event);
  cameraGesture = { action, x: start[0], y: start[1], original: { ...project.camera }, snapshotted: false };
  pointer = { camera: true };
}
function pointerDown(event) {
  if (event.pointerId != null && typeof canvas.setPointerCapture === 'function') {
    try { canvas.setPointerCapture(event.pointerId); } catch (error) {}
  }
  if (objectTransform && event.button === 0 && mode !== 'grease') {
    objectTransform = null; pointer = null; render(); status('Transform confirmed'); return;
  }
  if (event.button === 1 || (mode !== 'grease' && event.altKey)) {
    pointer = { pan: true, x: event.clientX, y: event.clientY };
    return;
  }
  if (mode === 'grease') {
    try { if (window.GreasePencil3D.pointerDown(greaseContext(), event)) return; } catch (error) { status('3D input error: ' + error.message); }
  }
  if (event.button !== 0) return;
  const rawPoint = canvasCoordinates(event);
  const point = inverseCameraPoint(rawPoint);
  lastCanvasPoint = point;
  const layer = activeLayer();
  if (!layer || !layer.v) return status('Select a visible layer before editing.');
  if (mode === 'camera') { beginCameraGesture(event); return; }
  if (mode === 'mask') {
    const masks = project.masks[project.f] || (project.masks[project.f] = []);
    if (tool === 'erase') {
      const hit = hitStroke(masks, point[0], point[1], 16);
      if (hit) { takeSnapshot(); project.masks[project.f] = masks.filter(mask => mask !== hit); render(); }
      pointer = { type: 'mask-erase', snapshotted: !!hit }; return;
    }
    takeSnapshot();
    const shape = createShape(tool === 'ellipse' ? 'ellipse' : tool === 'rect' ? 'rect' : 'path', point, point);
    const draft = { ...shape, c: '#e45858', w: 2, fill: false, closed: shape.closed };
    maskDraft = { mask: masks, draft }; masks.push(draft); pointer = { type: 'mask', start: point };
    render(); return;
  }
  const strokes = layer.d[project.f] || [];
  if (tool === 'select' || mode === 'edit' || tool === 'fill') {
    const hit = hitStroke(strokes, point[0], point[1]);
    if (tool === 'fill' && hit) {
      takeSnapshot(); hit.fill = true; hit.fillColor = fillColorInput.value || colorInput.value; hit.closed = true;
      selectedStroke = hit; render(); status('Shape filled'); return;
    }
    if (tool === 'fill' && !hit) { status('Click a closed shape to fill it.'); render(); return; }
    if (hit) {
      selectedStroke = hit; selectedLayer = project.i; selectedPoint = -1;
      if (mode === 'edit' || tool === 'point') {
        const index = nearestPoint(hit, point[0], point[1]);
        selectedPoint = index;
        if (index >= 0) pointer = { type: 'point', stroke: hit, index, last: point, snapshotted: false };
        else pointer = { type: 'select', start: point };
      } else {
        pointer = { type: 'move-stroke', stroke: hit, last: point, snapshotted: false };
      }
      render(); return;
    }
    selectedStroke = null; selectedPoint = -1;
    if (tool === 'select' || mode === 'object' || mode === 'animate' || mode === 'edit') { render(); return; }
  }
  takeSnapshot();
  if (tool === 'erase') {
    const hit = hitStroke(strokes, point[0], point[1], 16);
    if (hit) { layer.d[project.f] = strokes.filter(stroke => stroke !== hit); selectedStroke = null; render(); }
    pointer = { type: 'erase' }; return;
  }
  const shape = createShape(tool, point, point);
  const stroke = { c: colorInput.value || '#202020', w: Number(widthInput.value) || 4, fill: !!fillInput.checked, fillColor: fillColorInput.value || colorInput.value || '#202020', p: shape.p, shape: shape.shape, closed: shape.closed };
  if (mode === 'mask') return;
  if (!layer.d[project.f]) layer.d[project.f] = [];
  layer.d[project.f].push(stroke);
  selectedStroke = stroke; selectedLayer = project.i;
  pointer = { type: 'draw', tool, stroke, layer, start: point };
  preview = null; render();
}
function pointerMove(event) {
  if (mode === 'grease') {
    try { if (window.GreasePencil3D.pointerMove(greaseContext(), event)) return; } catch (error) { status('3D input error: ' + error.message); }
  }
  if (pointer?.pan) {
    $('stage-wrap').scrollLeft -= event.clientX - pointer.x; $('stage-wrap').scrollTop -= event.clientY - pointer.y;
    pointer.x = event.clientX; pointer.y = event.clientY; return;
  }
  if (cameraGesture) {
    const point = canvasCoordinates(event);
    const dx = point[0] - cameraGesture.x, dy = point[1] - cameraGesture.y, original = cameraGesture.original;
    if (!cameraGesture.snapshotted && (dx || dy)) { takeSnapshot(); cameraGesture.snapshotted = true; }
    if (cameraGesture.action === 'move') { project.camera.x = original.x - dx / project.camera.zoom; project.camera.y = original.y - dy / project.camera.zoom; }
    else if (cameraGesture.action === 'rotate') project.camera.r = original.r + dx * 0.35;
    else project.camera.zoom = clampN(original.zoom * Math.exp(-dy * 0.008), 0.05, 8);
    render(); return;
  }
  const point = inverseCameraPoint(canvasCoordinates(event));
  lastCanvasPoint = point;
  if (objectTransform) {
    const dx = point[0] - objectTransform.start[0], dy = point[1] - objectTransform.start[1];
    const source = objectTransform.original, center = objectTransform.center;
    if (objectTransform.type === 'g') objectTransform.stroke.p = source.map(p => [p[0] + dx, p[1] + dy]);
    else if (objectTransform.type === 'r') {
      const angle = Math.atan2(point[1] - center[1], point[0] - center[0]) - objectTransform.startAngle;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      objectTransform.stroke.p = source.map(p => { const x = p[0] - center[0], y = p[1] - center[1]; return [center[0] + x * cos - y * sin, center[1] + x * sin + y * cos]; });
    } else {
      const distance = Math.max(1, Math.hypot(point[0] - center[0], point[1] - center[1]));
      const factor = clampN(distance / objectTransform.startDistance, 0.02, 50);
      objectTransform.stroke.p = source.map(p => [center[0] + (p[0] - center[0]) * factor, center[1] + (p[1] - center[1]) * factor]);
    }
    render(); return;
  }
  if (!pointer) return;
  if (pointer.type === 'move-stroke') {
    const dx = point[0] - pointer.last[0], dy = point[1] - pointer.last[1];
    if ((dx || dy) && !pointer.snapshotted) { takeSnapshot(); pointer.snapshotted = true; }
    if (dx || dy) {
      for (const p of pointer.stroke.p) { p[0] += dx; p[1] += dy; }
      pointer.last = point;
      render();
    }
    return;
  }
  if (pointer.type === 'point') {
    const current = pointer.stroke.p[pointer.index];
    if (current && (current[0] !== point[0] || current[1] !== point[1])) {
      if (!pointer.snapshotted) { takeSnapshot(); pointer.snapshotted = true; }
      pointer.stroke.p[pointer.index] = point;
      render();
    }
    return;
  }
  if (pointer.type === 'draw') {
    if (pointer.tool === 'pencil') {
      const last = pointer.stroke.p[pointer.stroke.p.length - 1];
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) > 1.2) pointer.stroke.p.push(point);
    } else {
      const shape = createShape(pointer.tool, pointer.start, point);
      pointer.stroke.p = shape.p;
    }
    render(); return;
  }
  if (pointer.type === 'mask') {
    if (tool === 'pencil') {
      const points = maskDraft.draft.p, last = points[points.length - 1];
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) > 1.2) points.push(point);
    } else {
      const shape = createShape(tool === 'ellipse' ? 'ellipse' : tool === 'rect' ? 'rect' : 'path', pointer.start, point);
      maskDraft.draft.p = shape.p;
      if (shape.shape !== 'path') maskDraft.draft.shape = shape.shape;
    }
    render(); return;
  }
  if (pointer.type === 'mask-erase') {
    const masks = project.masks[project.f] || [], hit = hitStroke(masks, point[0], point[1], 16);
    if (hit) {
      if (!pointer.snapshotted) { takeSnapshot(); pointer.snapshotted = true; }
      project.masks[project.f] = masks.filter(mask => mask !== hit); render();
    }
    return;
  }
  if (pointer.type === 'erase') {
    const layer = activeLayer(), strokes = layer.d[project.f] || [], hit = hitStroke(strokes, point[0], point[1], 16);
    if (hit) { layer.d[project.f] = strokes.filter(stroke => stroke !== hit); render(); }
  }
}
function pointerUp(event) {
  if (mode === 'grease') {
    try { if (window.GreasePencil3D.pointerUp(greaseContext(), event)) { pointer = null; return; } } catch (error) { status('3D input error: ' + error.message); }
  }
  if (cameraGesture) { cameraGesture = null; pointer = null; render(); return; }
  if (pointer?.type === 'draw') {
    const stroke = pointer.stroke;
    if (stroke.shape === 'path' && stroke.p.length > 2 && fillInput.checked) { stroke.closed = true; stroke.fill = true; }
    if (stroke.shape === 'path' && stroke.p.length === 1) stroke.p.push([stroke.p[0][0] + 0.1, stroke.p[0][1] + 0.1]);
  }
  if (pointer?.type === 'mask' && maskDraft) {
    if (maskDraft.draft.p.length > 2 && tool !== 'rect' && tool !== 'ellipse') maskDraft.draft.closed = true;
    maskDraft = null;
  }
  pointer = null; preview = null; render();
}
function wheel(event) {
  if (mode === 'grease') {
    try { if (window.GreasePencil3D.wheel(greaseContext(), event)) { event.preventDefault(); return; } } catch (error) {}
  }
  if (mode === 'camera') {
    event.preventDefault(); project.camera.zoom = clampN(project.camera.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08), 0.05, 8); render(); return;
  }
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault(); widthInput.value = clampN(Number(widthInput.value) + (event.deltaY < 0 ? 1 : -1), 1, 100); $('brush-size-value').textContent = widthInput.value; return;
  }
  event.preventDefault();
  canvasZoom = clampN(canvasZoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), 0.25, 4);
  fitCanvas(); renderProperties();
}
function cancelOperation() {
  if (objectTransform) {
    objectTransform = null;
    if (history.canUndo) history.undo();
    selectedStroke = null; selectedPoint = -1; pointer = null; render(); status('Transform cancelled'); return;
  }
  if (mode === 'grease') {
    try { if (greasePencilMode.keydown(greaseContext(), { key: 'Escape', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, code: 'Escape' })) { pointer = null; render(); return; } } catch (error) {}
  }
  if (cameraGesture) {
    project.camera = { ...cameraGesture.original };
    cameraGesture = null; pointer = null;
    if (history.canUndo) history.undo();
    render(); status('Camera transform cancelled'); return;
  }
  if (pointer || preview) {
    if (history.canUndo) history.undo();
    pointer = null; preview = null; maskDraft = null; selectedStroke = null; render(); status('Operation cancelled');
  }
}
function undo() { if (playing) togglePlayback(false); if (history.undo()) { selectedStroke = null; refreshUI(); status('Undo'); } else status('Nothing to undo'); }
function redo() { if (history.redo()) { selectedStroke = null; refreshUI(); status('Redo'); } else status('Nothing to redo'); }
function togglePlayback(force) {
  playing = typeof force === 'boolean' ? force : !playing;
  if (playing) { lastTick = performance.now(); playRequest = requestAnimationFrame(playLoop); }
  else { cancelAnimationFrame(playRequest); }
  renderProperties();
}
function playLoop(now) {
  if (!playing) return;
  if (now - lastTick >= 1000 / project.fps) {
    lastTick = now;
    project.f = project.f >= project.b ? project.a : project.f + 1;
    render();
  }
  playRequest = requestAnimationFrame(playLoop);
}
function toggleOnion() {
  takeSnapshot(); project.on = project.on > 0 ? 0 : 1; refreshUI();
  status(project.on ? 'Onion skin enabled' : 'Onion skin disabled');
}
function saveJSON() {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = (project.name || 'animation').replace(/[^a-z0-9-_]+/gi, '-') + '.json';
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  dirty = false; $('save-indicator').textContent = '✓'; status('Project JSON saved');
}
async function openJSON(file) {
  try {
    const text = await file.text();
    const next = normalizeProject(JSON.parse(text));
    takeSnapshot(); project = next; selectedLayer = project.i; selectedStroke = null;
    dirty = false; refreshUI(); status('Project opened: ' + (project.name || file.name));
  } catch (error) { status('Could not open project: ' + error.message); }
  $('file-input').value = '';
}
function newProject() {
  if (dirty && !confirm('Start a new project? Download or save your current work first.')) return;
  takeSnapshot(); project = freshProject(); selectedStroke = null; selectedLayer = 0;
  setMode('draw'); history.clear(); dirty = false; refreshUI(); status('New project created');
}
function renderForExport(frame) {
  const before = project.f; project.f = frame;
  renderFrame(context, project, frame, { mode: 'draw', grid: false, onion: false });
  return before;
}
async function runExport(kind) {
  const before = project.f;
  const options = {
    canvas, fps: project.fps, start: project.a, end: project.b,
    render: frame => { project.f = frame; renderFrame(context, project, frame, { mode: 'draw', grid: false, onion: false }); },
    progress: (done, total, label) => status((label || 'Rendering animation…') + ' ' + done + '/' + total, false)
  };
  try {
    if (kind === 'png') { renderFrame(context, project, project.f, { mode: 'draw', grid: false, onion: false }); await exportPNG(canvas, 'frame-' + project.f + '.png'); }
    else if (kind === 'webm') await exportWebM(options);
    else await exportMP4(options);
    status(kind.toUpperCase() + ' export complete');
  } catch (error) { status(kind.toUpperCase() + ' export failed: ' + error.message); }
  finally { project.f = before; render(); }
}
function insertTimelineKey(event) {
  const target = event.target.closest('[data-frame]');
  if (!target) return;
  if (target.dataset.track != null) selectLayer(Number(target.dataset.track));
  setFrame(Number(target.dataset.frame));
}
function attachEvents() {
  $('mode-select').addEventListener('change', event => setMode(event.target.value));
  $('tool-shelf').addEventListener('click', event => {
    const button = event.target.closest('[data-tool]'); if (!button) return;
    tool = button.dataset.tool; renderTools(); status('Tool: ' + tool);
  });
  $('layer-list').addEventListener('click', event => {
    const visibility = event.target.closest('[data-visible]');
    if (visibility) {
      const index = Number(visibility.dataset.visible); takeSnapshot(); project.l[index].v = project.l[index].v ? 0 : 1; refreshUI(); return;
    }
    const row = event.target.closest('[data-layer]');
    if (row) selectLayer(Number(row.dataset.layer));
  });
  $('timeline-content').addEventListener('click', insertTimelineKey);
  $('new-btn').addEventListener('click', newProject);
  $('save-btn').addEventListener('click', saveJSON);
  $('open-btn').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', event => { if (event.target.files?.[0]) openJSON(event.target.files[0]); });
  $('help-btn').addEventListener('click', () => $('help-dialog').showModal());
  $('undo-btn').addEventListener('click', undo);
  $('redo-btn').addEventListener('click', redo);
  $('export-png-btn').addEventListener('click', () => runExport('png'));
  $('export-webm-btn').addEventListener('click', () => runExport('webm'));
  $('export-mp4-btn').addEventListener('click', () => runExport('mp4'));
  $('layer-add-btn').addEventListener('click', addLayer);
  $('layer-remove-btn').addEventListener('click', removeLayer);
  $('layer-up-btn').addEventListener('click', () => moveLayer(-1));
  $('layer-down-btn').addEventListener('click', () => moveLayer(1));
  $('layer-name').addEventListener('change', event => { takeSnapshot(); activeLayer().n = event.target.value.trim() || 'Layer'; refreshUI(); });
  $('layer-visible').addEventListener('change', event => { takeSnapshot(); activeLayer().v = event.target.checked ? 1 : 0; render(); });
  const snapshotOpacityChange = () => { if (!opacitySnapshotTaken) { takeSnapshot(); opacitySnapshotTaken = true; } };
  $('layer-opacity').addEventListener('pointerdown', snapshotOpacityChange);
  $('layer-opacity').addEventListener('keydown', snapshotOpacityChange);
  $('layer-opacity').addEventListener('input', event => { activeLayer().opacity = Number(event.target.value) / 100; $('layer-opacity-value').textContent = event.target.value + '%'; render(); });
  $('layer-opacity').addEventListener('change', () => { opacitySnapshotTaken = false; });
  $('blend-mode').addEventListener('change', event => { takeSnapshot(); activeLayer().bm = event.target.value; render(); });
  $('interpolation').addEventListener('change', event => { takeSnapshot(); activeLayer().e = event.target.value; render(); });
  const snapshotBackgroundChange = () => { if (!backgroundSnapshotTaken) { takeSnapshot(); backgroundSnapshotTaken = true; } };
  $('background-color').addEventListener('pointerdown', snapshotBackgroundChange);
  $('background-color').addEventListener('keydown', snapshotBackgroundChange);
  $('background-color').addEventListener('input', event => { project.bg = event.target.value; render(); });
  $('background-color').addEventListener('change', () => { backgroundSnapshotTaken = false; });
  $('frame-current').addEventListener('change', event => setFrame(Number(event.target.value)));
  $('frame-start').addEventListener('change', event => { takeSnapshot(); project.a = clampN(Math.round(Number(event.target.value) || 1), 1, project.b); project.f = clampN(project.f, project.a, project.b); refreshUI(); });
  $('frame-end').addEventListener('change', event => { takeSnapshot(); project.b = clampN(Math.round(Number(event.target.value) || 48), project.a, 999999); project.f = clampN(project.f, project.a, project.b); refreshUI(); });
  $('fps-value').addEventListener('change', event => { takeSnapshot(); project.fps = clampN(Math.round(Number(event.target.value) || 24), 1, 120); render(); });
  $('onion-count').addEventListener('change', event => { takeSnapshot(); project.on = clampN(Number(event.target.value) || 0, 0, 5); render(); });
  $('add-keyframe-btn').addEventListener('click', toggleKeyframe);
  $('duplicate-frame-btn').addEventListener('click', duplicateExposure);
  $('delete-frame-btn').addEventListener('click', deleteExposure);
  $('play-btn').addEventListener('click', () => togglePlayback());
  $('grid-btn').addEventListener('click', () => { gridVisible = !gridVisible; renderProperties(); render(); });
  $('onion-btn').addEventListener('click', toggleOnion);
  $('brush-size').addEventListener('input', event => $('brush-size-value').textContent = event.target.value);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('keydown', handleKeyDown);
}
function handleKeyDown(event) {
  const target = event.target;
  if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
  const key = event.key.toLowerCase(), command = event.ctrlKey || event.metaKey;
  if (command && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
  if (command && key === 'y') { event.preventDefault(); redo(); return; }
  if (command && key === 's') { event.preventDefault(); saveJSON(); return; }
  if (command && key === 'o') { event.preventDefault(); $('file-input').click(); return; }
  if (event.key === 'Escape') { event.preventDefault(); cancelOperation(); return; }
  if (key === ' ') { event.preventDefault(); togglePlayback(); return; }
  if (key === 'tab') {
    event.preventDefault();
    if (mode === 'grease' && greasePencilMode.keydown(greaseContext(), event)) return;
    const modes = ['object', 'draw', 'edit', 'animate', 'camera', 'mask', 'grease'];
    setMode(modes[(modes.indexOf(mode) + 1) % modes.length]); return;
  }
  if (mode === 'grease' && window.GreasePencil3D?.keydown) {
    try { if (window.GreasePencil3D.keydown(greaseContext(), event)) { event.preventDefault(); render(); return; } } catch (error) { status('3D shortcut error: ' + error.message); }
  }
  if (mode === 'camera' && ['g', 'r', 's'].includes(key)) { tool = key === 'g' ? 'cameraMove' : key === 'r' ? 'cameraRotate' : 'cameraZoom'; renderTools(); return; }
  const shortcuts = { d: 'pencil', e: 'erase', l: 'line', b: 'rect', o: 'ellipse', f: 'fill', v: 'select' };
  if (!command && shortcuts[key] && mode !== 'grease' && mode !== 'camera') {
    tool = shortcuts[key]; if (mode === 'object' && tool !== 'select') mode = 'draw';
    renderTools(); renderProperties(); return;
  }
  if (key === 'i') { toggleKeyframe(); return; }
  if (key === 'delete' || key === 'backspace') {
    if (selectedStroke) {
      const layer = project.l[selectedLayer]; if (!layer) return;
      takeSnapshot(); layer.d[project.f] = (layer.d[project.f] || []).filter(stroke => stroke !== selectedStroke); selectedStroke = null; render();
    } else deleteExposure();
    return;
  }
  if (key === 'arrowleft') { event.preventDefault(); setFrame(project.f - (event.shiftKey ? 10 : 1)); return; }
  if (key === 'arrowright') { event.preventDefault(); setFrame(project.f + (event.shiftKey ? 10 : 1)); return; }
  if (key === 'arrowup') { event.preventDefault(); const frames = sortedFrames(activeLayer().d).filter(frame => frame > project.f); if (frames[0]) setFrame(frames[0]); return; }
  if (key === 'arrowdown') { event.preventDefault(); const frames = sortedFrames(activeLayer().d).filter(frame => frame < project.f).pop(); if (frames) setFrame(frames); return; }
  if (key === 'home') { setFrame(project.a); return; }
  if (key === 'end') { setFrame(project.b); return; }
  if (event.shiftKey && key === 'a') { addLayer(); return; }
  if (event.shiftKey && key === 'd') { duplicateExposure(); return; }
  if (event.shiftKey && key === 'm' && selectedStroke) {
    takeSnapshot(); selectedStroke.p = selectedStroke.p.map(point => [WIDTH - point[0], point[1]]); render(); return;
  }
  if (['g', 'r', 's'].includes(key) && selectedStroke && mode !== 'grease' && mode !== 'camera') {
    takeSnapshot();
    const points = clone(selectedStroke.p);
    const center = points.reduce((sum, point) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length], [0, 0]);
    objectTransform = { type: key, stroke: selectedStroke, original: points, start: [...lastCanvasPoint], center,
      startAngle: Math.atan2(lastCanvasPoint[1] - center[1], lastCanvasPoint[0] - center[0]),
      startDistance: Math.max(1, Math.hypot(lastCanvasPoint[0] - center[0], lastCanvasPoint[1] - center[1])) };
    status(({ g: 'Move', r: 'Rotate', s: 'Scale' })[key] + ' stroke · move cursor, click to confirm, Esc to cancel');
    return;
  }
  if (key === 'p' && mode !== 'grease') { gridVisible = !gridVisible; render(); }
}
attachEvents();
fitCanvas();
renderTools();
refreshUI();
status('Ready · Draw with the mouse or trackpad', false);
