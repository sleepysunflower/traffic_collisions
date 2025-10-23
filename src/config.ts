// src/config.ts
import { asset } from './utils/asset';

// (Optional) use a static version string in prod to leverage caching better.
// For local dev you can keep the timestamp if you like.
// const bust = '?v=2025-10-22'; // stable version for prod
const bust = `?v=${Date.now()}`; // dev cache-buster

/** PMTiles sources (must use the pmtiles:// protocol for the PMTiles protocol handler) */
export const PMTILES = {
  incidents: `pmtiles://${asset('data/pmtiles/incidents.pmtiles')}${bust}`,
  lisa:      `pmtiles://${asset('data/pmtiles/lisa_occurrence.pmtiles')}${bust}`,
};

/** Parquet sources (used by DuckDB-WASM loaders, charts, etc.) */
export const PARQUET = {
  seriesMonthly: asset('data/parquet/series_monthly.parquet'),
  seriesYearly:  asset('data/parquet/series_yearly.parquet'),
  matrixDowHour: asset('data/parquet/matrix_dow_hour.parquet'),
  matrixDowMonth: asset('data/parquet/matrix_dow_month.parquet'),
  incidentVars:  asset('data/parquet/incident_vars.parquet'),
};

/** Basemap (GeoJSON for quartiers) */
export const BASEMAP = asset('data/basemap/MTL_quartier.geojson');

/** (UI) Labels for severities — keep if used in TopBar / legends */
export const SEVERITIES = [
  'Morte',
  'Grave',
  'Léger',
  'Dommages matériels seulement',
  'Dommages matériels inférieurs au seuil de rapportage',
] as const;
