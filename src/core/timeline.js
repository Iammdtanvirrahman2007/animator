export function createTimelineClickGuard(x, y, at = Date.now()) {
  return { x: Number(x), y: Number(y), at: Number(at) };
}

export function shouldSuppressTimelineClick(guard, x, y, now = Date.now(), maxAge = 450, radius = 10) {
  if (!guard) return false;
  const age = now - guard.at;
  return Number.isFinite(age) && age >= 0 && age <= maxAge &&
    Number.isFinite(Number(x)) && Number.isFinite(Number(y)) &&
    Math.hypot(Number(x) - guard.x, Number(y) - guard.y) <= radius;
}
