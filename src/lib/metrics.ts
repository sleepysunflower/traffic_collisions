import type { OccurrenceMetrics, SeverityMetrics } from "../types/metrics";

export async function loadOccurrenceMetrics(path="/data/models/occurrence_metrics.json"): Promise<OccurrenceMetrics> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load occurrence metrics: ${r.status}`);
  return r.json();
}
export async function loadSeverityMetrics(path="/data/models/severity_metrics.json"): Promise<SeverityMetrics> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load severity metrics: ${r.status}`);
  return r.json();
}
