import { WIDTH, HEIGHT, clamp, drawingAt, sortedFrames, transformAt } from './model.js';

function traceStroke(ctx, stroke) {
  const points = stroke.p || [];
  if (!points.length) return;
  ctx.beginPath();
  if (stroke.shape === 'ellipse' && points.length >= 2) {
    const x = Math.min(points[0][0], points[1][0]);
    const y = Math.min(points[0][1], points[1][1]);
    ctx.ellipse(x + Math.abs(points[1][0] - points[0][0]) / 2, y + Math.abs(points[1][1] - points[0][1]) / 2,
      Math.max(0.5, Math.abs(points[1][0] - points[0][0]) / 2), Math.max(0.5, Math.abs(points[1][1] - points[0][1]) / 2), 0, 0, Math.PI * 2);
  } else if (stroke.shape === 'rect' && points.length >= 2) {
    ctx.rect(points[0][0], points[0][1], points[1][0] - points[0][0], points[1][1] - points[0][1]);
  } else {
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    if (stroke.closed) ctx.closePath();
  }
  if (stroke.fill && (stroke.shape === 'rect' || stroke.shape === 'ellipse' || stroke.closed)) {
    ctx.fillStyle = stroke.fillColor || stroke.c || '#202020';
    ctx.fill();
  }
  ctx.strokeStyle = stroke.c || '#202020';
  ctx.lineWidth = Number(stroke.w) || 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function paintLayer(ctx, layer, frame, alpha = 1, tint = null) {
  if (!layer || !layer.v) return;
  const transform = transformAt(layer, frame);
  ctx.save();
  ctx.globalAlpha = clamp(alpha * layer.opacity * transform.o, 0, 1);
  ctx.globalCompositeOperation = layer.bm || 'source-over';
  ctx.translate(layer.px + transform.x, layer.py + transform.y);
  ctx.rotate(transform.r * Math.PI / 180);
  ctx.scale(transform.s, transform.s);
  ctx.translate(-layer.px, -layer.py);
  const strokes = drawingAt(layer, frame);
  for (const stroke of strokes) {
    if (tint) {
      const recolored = { ...stroke, c: tint, fillColor: tint, fill: false };
      traceStroke(ctx, recolored);
    } else traceStroke(ctx, stroke);
  }
  ctx.restore();
}

function drawGrid(ctx) {
  ctx.save();
  ctx.strokeStyle = '#ffffff08';
  ctx.lineWidth = 1;
  for (let x = 0.5; x < WIDTH; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
  for (let y = 0.5; y < HEIGHT; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
  ctx.restore();
}

function drawCameraOverlay(ctx, camera) {
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT / 2);
  ctx.rotate(-camera.r * Math.PI / 180);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  ctx.strokeStyle = '#ef8a24';
  ctx.lineWidth = 1.5 / camera.zoom;
  ctx.strokeRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = '#ffffff75';
  ctx.lineWidth = 1 / camera.zoom;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 3, 0); ctx.lineTo(WIDTH / 3, HEIGHT);
  ctx.moveTo(WIDTH * 2 / 3, 0); ctx.lineTo(WIDTH * 2 / 3, HEIGHT);
  ctx.moveTo(0, HEIGHT / 3); ctx.lineTo(WIDTH, HEIGHT / 3);
  ctx.moveTo(0, HEIGHT * 2 / 3); ctx.lineTo(WIDTH, HEIGHT * 2 / 3);
  ctx.stroke();
  ctx.restore();
}

function drawSelection(ctx, stroke, layer, frame, editMode) {
  if (!stroke || !layer) return;
  const t = transformAt(layer, frame);
  ctx.save();
  ctx.translate(layer.px + t.x, layer.py + t.y);
  ctx.rotate(t.r * Math.PI / 180);
  ctx.scale(t.s, t.s);
  ctx.translate(-layer.px, -layer.py);
  const pts = stroke.p || [];
  if (pts.length) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x = Math.min(...xs) - 8, y = Math.min(...ys) - 8;
    const w = Math.max(16, Math.max(...xs) - Math.min(...xs) + 16);
    const h = Math.max(16, Math.max(...ys) - Math.min(...ys) + 16);
    ctx.strokeStyle = '#f08a24'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    if (editMode) for (const p of pts) {
      ctx.fillStyle = '#202124'; ctx.strokeStyle = '#f7b15f'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawMasks(ctx, masks, frame) {
  const data = masks?.[frame];
  if (!Array.isArray(data)) return;
  ctx.save(); ctx.strokeStyle = '#e45858'; ctx.fillStyle = '#e4585820';
  for (const path of data) {
    if (!path.p?.length) continue;
    ctx.beginPath(); ctx.moveTo(path.p[0][0], path.p[0][1]);
    for (let i = 1; i < path.p.length; i++) ctx.lineTo(path.p[i][0], path.p[i][1]);
    if (path.closed) { ctx.closePath(); ctx.fill(); }
    ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

export function renderFrame(ctx, project, frame, options = {}) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = project.bg || '#fbfaf7';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (options.grid) drawGrid(ctx);

  if (options.mode === 'grease' && options.greaseMode) {
    options.greaseMode.draw(ctx, project, frame, options.onion !== false);
    ctx.restore();
    return;
  }

  if (options.mode === 'camera' && options.cameraView) {
    const camera = project.camera || { x: WIDTH / 2, y: HEIGHT / 2, zoom: 1, r: 0 };
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.rotate(-camera.r * Math.PI / 180);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    for (const layer of project.l) paintLayer(ctx, layer, frame);
    ctx.restore();
    drawCameraOverlay(ctx, camera);
    ctx.restore();
    return;
  }

  if (options.mode === 'animate' && options.onion !== false && Number(project.on) > 0) {
    for (const layer of project.l) {
      const frames = sortedFrames(layer.d);
      const current = frames.filter(f => f <= frame).pop();
      const previous = frames.filter(f => f < (current ?? frame)).pop();
      const next = frames.find(f => f > (current ?? frame));
      const count = Math.max(0, Math.min(5, Number(project.on) || 0));
      if (previous != null && count > 0) paintLayer(ctx, layer, previous, 0.25, '#df6161');
      if (next != null && count > 0) paintLayer(ctx, layer, next, 0.25, '#42a77c');
    }
  }

  for (const layer of project.l) paintLayer(ctx, layer, frame);
  if (options.mode === 'mask') drawMasks(ctx, project.masks, frame);
  if (options.preview) traceStroke(ctx, options.preview);
  if (options.selectedStroke && options.mode !== 'mask') {
    const layer = project.l[options.selectedLayer] || project.l[project.i];
    drawSelection(ctx, options.selectedStroke, layer, frame, options.mode === 'edit');
  }
  if (options.mode === 'camera') drawCameraOverlay(ctx, project.camera || { x: WIDTH / 2, y: HEIGHT / 2, zoom: 1, r: 0 });
  ctx.restore();
}

export function pointFromEvent(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return [clamp((event.clientX - rect.left) * WIDTH / Math.max(1, rect.width), 0, WIDTH),
    clamp((event.clientY - rect.top) * HEIGHT / Math.max(1, rect.height), 0, HEIGHT)];
}

export function hitStroke(strokes, x, y, tolerance = 12) {
  let best = null, bestDistance = Infinity;
  for (let index = strokes.length - 1; index >= 0; index--) {
    const stroke = strokes[index], points = stroke.p || [];
    if (!points.length) continue;
    if ((stroke.shape === 'rect' || stroke.shape === 'ellipse') && points.length >= 2) {
      const minX = Math.min(points[0][0], points[1][0]), maxX = Math.max(points[0][0], points[1][0]);
      const minY = Math.min(points[0][1], points[1][1]), maxY = Math.max(points[0][1], points[1][1]);
      if (x >= minX - tolerance && x <= maxX + tolerance && y >= minY - tolerance && y <= maxY + tolerance) return stroke;
    }
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[Math.min(i + 1, points.length - 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const distance = Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
      if (distance < Math.max(tolerance, Number(stroke.w) + 6) && distance < bestDistance) { best = stroke; bestDistance = distance; }
    }
    if (best) return best;
  }
  return best;
}

export function nearestPoint(stroke, x, y, tolerance = 14) {
  let index = -1, distance = tolerance;
  for (let i = 0; i < (stroke?.p || []).length; i++) {
    const next = Math.hypot(stroke.p[i][0] - x, stroke.p[i][1] - y);
    if (next < distance) { index = i; distance = next; }
  }
  return index;
}
