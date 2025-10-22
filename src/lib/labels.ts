let dictCache: any = null;

export async function loadLabels(path = "/data/dictionary.json") {
  if (dictCache) return dictCache;
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load labels: ${r.status} ${r.statusText}`);
  dictCache = await r.json();
  return dictCache;
}

export function labelFor(dict: any, field: string, code: string | number) {
  const m = dict?.[field];
  if (!m) return String(code);
  const k = String(code);
  return m[k] ?? m["NA"] ?? String(code);
}
