import { clone, normalizeProject } from './model.js';

export function createHistory(getProject, setProject, limit = 100) {
  const past = [];
  const future = [];
  return {
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    snapshot() {
      past.push(clone(getProject()));
      if (past.length > limit) past.shift();
      future.length = 0;
    },
    undo() {
      if (!past.length) return false;
      future.push(clone(getProject()));
      setProject(normalizeProject(past.pop()));
      return true;
    },
    redo() {
      if (!future.length) return false;
      past.push(clone(getProject()));
      setProject(normalizeProject(future.pop()));
      return true;
    },
    clear() { past.length = 0; future.length = 0; }
  };
}