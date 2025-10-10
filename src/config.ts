// src/config.ts
export const DATA_BASE = './data';

export const PMTILES = {
  incidents: `${DATA_BASE}/pmtiles/incidents.pmtiles`,
  lisa: `${DATA_BASE}/pmtiles/lisa_occurrence.pmtiles`
};

export const PARQUET = {
  seriesMonthly: `${DATA_BASE}/parquet/series_monthly.parquet`,
  seriesYearly: `${DATA_BASE}/parquet/series_yearly.parquet`,
  matrixDowHour: `${DATA_BASE}/parquet/matrix_dow_hour.parquet`,
  matrixDowMonth: `${DATA_BASE}/parquet/matrix_dow_month.parquet`,
  incidentVars: `${DATA_BASE}/parquet/incident_vars.parquet`
};

export const BASEMAP = `${DATA_BASE}/basemap/MTL_quartier.geojson`;
