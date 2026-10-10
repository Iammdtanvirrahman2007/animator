import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshProject, normalizeProject, exposedFrame, drawingAt, transformAt,
  captureTransform, keyframeAt, allFrames, drawingFrames
} from '../src/core/model.js';
import { createHistory } from '../src/core/history.js';
import { hitStroke, nearestPoint } from '../src/core/renderer.js';

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

test('normalizer clamps unusable layer indices and keyframe values safely', () => {
  const project = normalizeProject({ a: 10, b: 12, f: 0, i: 300, l: [{ n: '', v: 0, d: {}, k: { 10: { x: 2 } } }] });
  assert.equal(project.f, 10);
  assert.equal(project.i, 0);
  assert.equal(project.l[0].n, 'Layer 1');
  assert.equal(project.l[0].v, 0);
});
