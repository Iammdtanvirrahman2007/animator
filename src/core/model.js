export const WIDTH = 960;
export const HEIGHT = 540;
export const clone = value => JSON.parse(JSON.stringify(value));
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const sortedFrames = value => Object.keys(value || {}).map(Number).filter(Number.isFinite).sort((a, b) => a - b);

export function makeLayer(name) {
  return { n: name || 'Layer', v: 1, opacity: 1, bm: 'source-over', e: 'ease', px: WIDTH / 2, py: HEIGHT / 2, d: {}, k: {} };
}

export function freshProject() {
  return {
    schema: 2, name: 'Untitled Animation', fps: 24, a: 1, b: 48, f: 1, i: 0, on: 1, bg: '#fbfaf7',
    camera: { x: WIDTH / 2, y: HEIGHT / 2, zoom: 1, r: 0, view: false },
    l: [makeLayer('Layer 1')], masks: {}
  };
}

export function normalizeProject(input) {
  const base = freshProject();
  if (!input || typeof input !== 'object' || !Array.isArray(input.l) || input.l.length === 0) {
    throw new Error('This file is not a valid Animator project.');
  }
  const project = { ...base, ...input };
  project.schema = 2;
  project.fps = clamp(Math.round(Number(project.fps) || 24), 1, 120);
  project.a = clamp(Math.round(Number(project.a) || 1), 1, 999999);
  project.b = clamp(Math.round(Number(project.b) || 48), project.a, 999999);
  project.f = clamp(Math.round(Number(project.f) || project.a), project.a, project.b);
  project.i = clamp(Math.round(Number(project.i) || 0), 0, project.l.length - 1);
  project.on = clamp(Math.round(Number(project.on) || 0), 0, 5);
  project.bg = typeof project.bg === 'string' ? project.bg : base.bg;
  project.l = project.l.map((raw, index) => {
    const layer = { ...makeLayer('Layer ' + (index + 1)), ...raw };
    layer.n = String(layer.n || ('Layer ' + (index + 1))).slice(0, 100);
    layer.v = layer.v === false || layer.v === 0 ? 0 : 1;
    layer.opacity = clamp(Number(layer.opacity ?? 1), 0, 1);
    layer.d = layer.d && typeof layer.d === 'object' ? layer.d : {};
    layer.k = layer.k && typeof layer.k === 'object' ? layer.k : {};
    for (const key of Object.keys(layer.d)) {
      const frame = Number(key);
      if (!Number.isInteger(frame) || frame < 1 || !Array.isArray(layer.d[key])) { delete layer.d[key]; continue; }
      layer.d[key] = layer.d[key].filter(stroke => stroke && Array.isArray(stroke.p) && stroke.p.length)
        .map(stroke => ({
          ...stroke, c: typeof stroke.c === 'string' ? stroke.c : '#202020',
          w: clamp(Number(stroke.w) || 3, 0.25, 200),
          p: stroke.p.filter(p => Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1])).map(p => [Number(p[0]), Number(p[1])]),
          fill: !!stroke.fill, fillColor: typeof stroke.fillColor === 'string' ? stroke.fillColor : (stroke.c || '#202020'),
          shape: ['path', 'line', 'rect', 'ellipse'].includes(stroke.shape) ? stroke.shape : 'path'
        }));
    }
    layer.k = Object.fromEntries(Object.entries(layer.k).filter(([frame, value]) => Number.isInteger(Number(frame)) && Number(frame) > 0 && value && typeof value === 'object'));
    return layer;
  });
  project.camera = { ...base.camera, ...(project.camera || {}) };
  project.camera.x = Number(project.camera.x) || WIDTH / 2;
  project.camera.y = Number(project.camera.y) || HEIGHT / 2;
  project.camera.zoom = clamp(Number(project.camera.zoom) || 1, 0.05, 8);
  project.camera.r = Number(project.camera.r) || 0;
  project.masks = project.masks && typeof project.masks === 'object' ? project.masks : {};
  if (!project.name) project.name = 'Untitled Animation';
  return project;
}

export function exposedFrame(layer, frame) {
  const frames = sortedFrames(layer.d);
  const previous = frames.filter(value => value <= frame).pop();
  return previous ?? null;
}

export function drawingAt(layer, frame) {
  const key = exposedFrame(layer, frame);
  return key == null ? [] : (layer.d[key] || []);
}

export function transformAt(layer, frame) {
  const frames = sortedFrames(layer.k);
  const fallback = { x: 0, y: 0, r: 0, s: 1, o: 1 };
  if (!frames.length) return fallback;
  const left = frames.filter(value => value <= frame).pop();
  const right = frames.find(value => value > frame);
  if (left == null) return { ...fallback, ...layer.k[frames[0]] };
  const A = { ...fallback, ...layer.k[left] };
  if (right == null || left === frame || layer.e === 'hold') return A;
  const B = { ...fallback, ...layer.k[right] };
  const raw = clamp((frame - left) / (right - left), 0, 1);
  const t = layer.e === 'linear' ? raw : layer.e === 'in' ? raw * raw : layer.e === 'out' ? 1 - (1 - raw) * (1 - raw) : raw * raw * (3 - 2 * raw);
  return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, r: A.r + (B.r - A.r) * t, s: A.s + (B.s - A.s) * t, o: A.o + (B.o - A.o) * t };
}

export function keyframeAt(layer, frame) {
  return Object.prototype.hasOwnProperty.call(layer.k || {}, String(frame));
}

export function drawingFrames(layer) {
  return sortedFrames(layer.d);
}

export function allFrames(project, layerIndex) {
  const layer = project.l[layerIndex];
  if (!layer) return [];
  return [...new Set([...sortedFrames(layer.d), ...sortedFrames(layer.k)])].sort((a, b) => a - b);
}

export function captureTransform(layer, frame) {
  layer.k[frame] = { ...transformAt(layer, frame) };
}

export function frameRange(project, start, end) {
  project.a = clamp(Math.round(start), 1, Math.max(1, project.b));
  project.b = clamp(Math.round(end), project.a, 999999);
  project.f = clamp(project.f, project.a, project.b);
}
