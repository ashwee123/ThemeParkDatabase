/** @param {unknown} d */
export function formatDateOnly(d) {
  if (d == null) return null;
  if (typeof d === "string") return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

/** @param {unknown} d */
export function formatDateTime(d) {
  if (d == null) return null;
  if (typeof d === "string") {
    const s = d.replace("T", " ");
    return s.length >= 19 ? s.slice(0, 19) : s;
  }
  if (d instanceof Date) {
    return d.toISOString().slice(0, 19).replace("T", " ");
  }
  return String(d);
}

/** @param {unknown} t */
export function formatTime(t) {
  if (t == null) return null;
  const s = String(t);
  if (s.length >= 8 && s.includes(":")) return s.slice(0, 8);
  return s;
}

/** @param {unknown} n */
export function num(n) {
  if (n == null) return null;
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}
