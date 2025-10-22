export const DATA_BASE = './data';
const bust = `?v=${Date.now()}`; // dev cache buster; replace with a static version string for prod
export const PMTILES = {
  incidents: `/data/pmtiles/incidents.pmtiles${bust}`,
  lisa: `/data/pmtiles/lisa_occurrence.pmtiles${bust}`
}

export const PARQUET = {
  seriesMonthly: `${DATA_BASE}/parquet/series_monthly.parquet`,
  seriesYearly: `${DATA_BASE}/parquet/series_yearly.parquet`,
  matrixDowHour: `${DATA_BASE}/parquet/matrix_dow_hour.parquet`,
  matrixDowMonth: `${DATA_BASE}/parquet/matrix_dow_month.parquet`,
  incidentVars: `${DATA_BASE}/parquet/incident_vars.parquet`
};
export const BASEMAP = `${DATA_BASE}/basemap/MTL_quartier.geojson`;

export const SEVERITIES = [
  'Morte',
  'Grave',
  'Léger',
  'Dommages matériels seulement',
  'Dommages matériels inférieurs au seuil de rapportage'
] as const;
