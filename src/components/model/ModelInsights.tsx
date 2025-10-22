import React from "react";
import * as echarts from "echarts";
import { loadOccurrenceMetrics, loadSeverityMetrics } from "../../lib/metrics";

// ---------- Reusable hook (used ONLY inside chart components) ----------
function useEChart(elRef: React.RefObject<HTMLDivElement>, option: echarts.EChartsOption) {
  React.useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: "canvas" });
    chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [elRef, option]);
}

// ---------- Chart components (safe: hooks live inside, mount conditionally) ----------
function FeatureImportanceBar({ data }: { data: Array<{ name: string; importance: number }> }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const names = React.useMemo(() => data.map(d => d.name), [data]);
  const vals  = React.useMemo(() => data.map(d => d.importance), [data]);

  const option = React.useMemo<echarts.EChartsOption>(() => ({
    grid: { left: 100, right: 20, top: 20, bottom: 20 },
    xAxis: { type: "value" },
    yAxis: { type: "category", data: [...names].reverse() },
    series: [{ type: "bar", data: [...vals].reverse() }],
    tooltip: {}
  }), [names, vals]);

  useEChart(ref, option);
  return <div ref={ref} style={{ height: 360 }} />;
}

function ConfusionMatrixHeatmap({
  labels, matrix
}: { labels: string[]; matrix: number[][] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const maxV = React.useMemo(() => Math.max(...matrix.flat()), [matrix]);
  const seriesData = React.useMemo(
    () => matrix.flatMap((row, i) => row.map((v, j) => [j, i, v])),
    [matrix]
  );

  const option = React.useMemo<echarts.EChartsOption>(() => ({
    tooltip: {},
    xAxis: { type: "category", data: labels },
    yAxis: { type: "category", data: labels },
    visualMap: { min: 0, max: maxV, calculable: true, orient: "horizontal", left: "center", bottom: 0 },
    series: [{ type: "heatmap", data: seriesData }]
  }), [labels, seriesData, maxV]);

  useEChart(ref, option);
  return <div ref={ref} style={{ height: 360 }} />;
}

function CalibrationLine({
  bins
}: { bins: Array<{ y_pred_mean: number; y_true_mean: number; count?: number }> }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const lineData = React.useMemo(
    () => bins.map(b => [b.y_pred_mean, b.y_true_mean]),
    [bins]
  );

  const option = React.useMemo<echarts.EChartsOption>(() => ({
    tooltip: {},
    legend: {},
    xAxis: { type: "value", name: "Predicted (bin mean)" },
    yAxis: { type: "value", name: "Actual (bin mean)" },
    series: [
      { type: "line", name: "Actual vs Pred", data: lineData, smooth: true },
      { type: "line", name: "Perfect", data: [[0, 0], [1, 1]], lineStyle: { type: "dashed" } }
    ]
  }), [lineData]);

  useEChart(ref, option);
  return <div ref={ref} style={{ height: 320 }} />;
}

// ---------- Main component ----------
export default function ModelInsights() {
  const [occ, setOcc] = React.useState<any | null>(null);
  const [sev, setSev] = React.useState<any | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([loadOccurrenceMetrics(), loadSeverityMetrics()])
      .then(([o, s]) => { if (!cancelled) { setOcc(o); setSev(s); } })
      .catch(e => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, []);

  if (err) {
    return <div className="card" style={{ color: "crimson" }}>
      <h3>Failed to load metrics</h3>
      <pre style={{ whiteSpace: "pre-wrap" }}>{err}</pre>
    </div>;
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
      {/* Summary cards */}
      <div className="card">
        <h3>Occurrence — Test Metrics</h3>
        {occ ? (
          <ul className="mono">
            <li>R²: {occ.metrics.r2.toFixed(3)}</li>
            <li>RMSE: {occ.metrics.rmse.toFixed(3)}</li>
            <li>MAE: {occ.metrics.mae.toFixed(3)}</li>
            {"mape" in occ.metrics && <li>MAPE: {(occ.metrics.mape * 100).toFixed(1)}%</li>}
          </ul>
        ) : "Loading…"}
      </div>
      <div className="card">
        <h3>Severity — Test Metrics</h3>
        {sev ? (
          <ul className="mono">
            <li>Accuracy: {sev.overall.accuracy.toFixed(3)}</li>
            <li>Macro F1: {sev.overall.macro_f1.toFixed(3)}</li>
            <li>Weighted F1: {sev.overall.weighted_f1.toFixed(3)}</li>
          </ul>
        ) : "Loading…"}
      </div>

      {/* Charts — mount components only when data exists (hooks inside remain safe) */}
      <div className="card">
        <h3>Top Features — Occurrence</h3>
        {occ ? <FeatureImportanceBar data={occ.feature_importance} /> : "Loading…"}
      </div>

      <div className="card">
        <h3>Confusion Matrix — Severity</h3>
        {sev ? <ConfusionMatrixHeatmap labels={sev.labels} matrix={sev.confusion_matrix} /> : "Loading…"}
      </div>

      {/* Optional calibration */}
      {occ?.calibration && (
        <div className="card" style={{ gridColumn: "1 / span 2" }}>
          <h3>Calibration — Occurrence</h3>
          <CalibrationLine bins={occ.calibration} />
        </div>
      )}
    </div>
  );
}
