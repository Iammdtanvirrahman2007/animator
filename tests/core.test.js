import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshProject, normalizeProject, exposedFrame, drawingAt, transformAt,
  captureTransform, keyframeAt, allFrames, drawingFrames, moveFrameKeys
} from '../src/core/model.js';
import { createHistory } from '../src/core/history.js';
import { hitStroke, nearestPoint, renderFrame } from '../src/core/renderer.js';

test('new project creates a valid starter layer and frame range', () => {
  const project = freshProject();
  assert.equal(project.f, 1);
  assert.equal(project.a, 1);
  assert.equal(project.b, 48);
  assert.equal(project.l.length, 1);
  assert.equal(project.l[0].n, 'Layer 1');
});

test('normalizer accepts older project data and drops malformed strokes', () => {
  const project = normalizeProject({
    fps: 0, a: 4, b: 20, f: 999, i: 0,
    l: [{ n: 'Legacy', v: 1, d: {
      3: [{ c: '#222222', w: 2, p: [[1, 2], [3, 4]] }, { p: 'broken' }],
      bad: [{ p: [[0, 0]] }]
    }, k: {} }]
  });
  assert.equal(project.fps, 24);
  assert.equal(project.f, 20);
  assert.equal(project.l[0].d[3].length, 1);
  assert.equal(project.l[0].opacity, 1);
});

test('drawings hold from the previous exposure but stay blank before first exposure', () => {
  const layer = { d: { 5: [{ p: [[1, 1]] }], 9: [{ p: [[9, 9]] }] } };
  assert.equal(exposedFrame(layer, 3), null);
  assert.deepEqual(drawingAt(layer, 3), []);
  assert.equal(exposedFrame(layer, 7), 5);
  assert.deepEqual(drawingAt(layer, 7), layer.d[5]);
  assert.deepEqual(drawingFrames(layer), [5, 9]);
  assert.deepEqual(allFrames({ l: [{ d: layer.d, k: { 12: { x: 2 } } }] }, 0), [5, 9, 12]);
});

test('transform keyframes interpolate deterministically', () => {
  const layer = { e: 'linear', k: { 1: { x: 0, y: 10, r: 0, s: 1, o: 1 }, 11: { x: 100, y: 30, r: 90, s: 3, o: 0.5 } } };
  assert.equal(transformAt(layer, 6).x, 50);
  assert.equal(transformAt(layer, 6).y, 20);
  assert.equal(transformAt(layer, 6).r, 45);
  captureTransform(layer, 6);
  assert.equal(keyframeAt(layer, 6), true);
  assert.equal(layer.k[6].x, 50);
});

test('undo and redo restore project snapshots', () => {
  let project = freshProject();
  const history = createHistory(() => project, value => { project = value; });
  history.snapshot();
  project.l[0].n = 'Changed';
  assert.equal(history.undo(), true);
  assert.equal(project.l[0].n, 'Layer 1');
  assert.equal(history.redo(), true);
  assert.equal(project.l[0].n, 'Changed');
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, false);
});

test('stroke hit test and edit-point picking work near geometry', () => {
  const stroke = { shape: 'path', w: 3, p: [[10, 10], [30, 10], [30, 30]] };
  assert.equal(hitStroke([stroke], 20, 11), stroke);
  assert.equal(hitStroke([stroke], 400, 400), null);
  assert.equal(nearestPoint(stroke, 29, 11), 1);
  assert.equal(nearestPoint(stroke, 90, 90), -1);
});


function mockCanvasContext() {
  const calls = [];
  const methods = ['save','restore','fillRect','beginPath','moveTo','lineTo','rect','ellipse','closePath','fill','stroke','translate','rotate','scale','setLineDash','arc','strokeRect','fillText','clip'];
  const context = { calls, globalAlpha: 1, globalCompositeOperation: 'source-over' };
  for (const method of methods) context[method] = (...args) => calls.push([method, ...args]);
  return context;
}


test('timeline retiming moves exposures and transform keys together', () => {
  const layer = { d: { 2: [{ p: [[1, 1]] }] }, k: { 2: { x: 10 }, 8: { x: 20 } } };
  assert.equal(moveFrameKeys(layer, 2, 5), true);
  assert.equal(layer.d[2], undefined);
  assert.deepEqual(layer.d[5], [{ p: [[1, 1]] }]);
  assert.deepEqual(layer.k[5], { x: 10 });
  assert.deepEqual(layer.k[8], { x: 20 });
});

test('timeline retiming rejects collisions without destroying keys', () => {
  const layer = { d: { 2: [{ id: 'source' }], 5: [{ id: 'target' }] }, k: { 2: { x: 1 } } };
  assert.equal(moveFrameKeys(layer, 2, 5), false);
  assert.deepEqual(layer.d[2], [{ id: 'source' }]);
  assert.deepEqual(layer.d[5], [{ id: 'target' }]);
  assert.deepEqual(layer.k[2], { x: 1 });
  assert.equal(moveFrameKeys(layer, 2, 2), false);
  assert.equal(moveFrameKeys(layer, 0, 7), false);
});

test('cancelled snapshot can be discarded without creating a redo entry', () => {
  let project = freshProject();
  const history = createHistory(() => project, value => { project = value; });
  history.snapshot();
  project.l[0].n = 'Cancelled preview';
  history.discardLatestSnapshot();
  project.l[0].n = 'Layer 1';
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
});

test('renderer paints strokes and clips masked regions outside mask mode', () => {
  const project = freshProject();
  project.l[0].d[1] = [{ c: '#222222', w: 3, p: [[10, 10], [40, 40]], shape: 'path' }];
  project.masks[1] = [{ shape: 'rect', p: [[5, 5], [50, 50]], closed: true }];
  const normalContext = mockCanvasContext();
  renderFrame(normalContext, project, 1, { mode: 'draw', onion: false });
  assert.ok(normalContext.calls.some(call => call[0] === 'clip' && call[1] === 'evenodd'));
  assert.ok(normalContext.calls.some(call => call[0] === 'stroke'));
  const maskContext = mockCanvasContext();
  renderFrame(maskContext, project, 1, { mode: 'mask', onion: false });
  assert.ok(!maskContext.calls.some(call => call[0] === 'clip'));
  assert.ok(maskContext.calls.some(call => call[0] === 'setLineDash'));
});

test('renderer supports filled ellipse geometry', () => {
  const project = freshProject();
  project.l[0].d[1] = [{ c: '#111111', w: 2, shape: 'ellipse', p: [[10, 10], [70, 50]], fill: true, fillColor: '#f08a28' }];
  const context = mockCanvasContext();
  renderFrame(context, project, 1, { mode: 'draw', onion: false });
  assert.ok(context.calls.some(call => call[0] === 'ellipse'));
  assert.ok(context.calls.some(call => call[0] === 'fill'));
});

test('normalizer clamps unusable layer indices and keyframe values safely', () => {
  const project = normalizeProject({ a: 10, b: 12, f: 0, i: 300, l: [{ n: '', v: 0, d: {}, k: { 10: { x: 2 } } }] });
  assert.equal(project.f, 10);
  assert.equal(project.i, 0);
  assert.equal(project.l[0].n, 'Layer 1');
  assert.equal(project.l[0].v, 0);
});
