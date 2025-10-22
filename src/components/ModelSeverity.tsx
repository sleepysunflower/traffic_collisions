import React from "react";
import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import ModelAbout from "./ModelAbout1";
import { loadLabels } from "../lib/labels";
import { getSessionWithProgress } from "../lib/sessions";
import { run as runOnnx } from "../lib/infer";
import { useFullscreenModal } from "./useFullscreenModal";
import { modelThemeName, registerModelTheme } from "../mtheme";
import "../mstyles.css";

const SEV_ONNX_PATH    = "/data/models/severity_reg.onnx";
const SEV_META_PATH    = "/data/models/severity_reg_meta.json";
const DICT_PATH        = "/data/dictionary.json";
const SEV_METRICS_PATH = "/data/models/severity_metrics.json";
const SEV_PERM_CSV_PATH= "/data/models/severity_perm.csv";

type SevMeta = {
  model_name: string;
  num_cols: string[];
  num_fill?: Record<string, number | null>;
  cat_cols: string[];
  cat_categories: Record<string, string[]>;
  thresholds: number[];
  severity_labels: string[];
  input_name?: string;
};

type SevMetrics = {
  labels?: string[];
  confusion_matrix?: number[][];
  per_class?: Array<{ label:string; precision:number; recall:number; f1:number; support:number }>;
  overall?: Record<string, number>;
};

type PermRow = { feature: string; importance: number };

// ---- small circular loader (red) ----
function LoadingRing({ pct }: { pct: number }) {
  const size = 56;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = C * (1 - clamped / 100);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} stroke="#2a2a2a" strokeWidth={stroke} fill="none" />
        <circle
          cx={size/2} cy={size/2} r={r}
          stroke="#8E1616" strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .2s ease" }}
        />
      </svg>
      <div className="mono" style={{ fontSize: 14 }}>
        <div>Loading model… <span className="mono">{clamped.toFixed(0)}%</span></div>
      </div>
    </div>
  );
}

// ---------------------- helpers ----------------------
function normalizeKey(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
const ALLOWED_NUMERIC_UI_MATCHES = [
  "nb motocyclette", "nb bicyclette", "nb automobile camion leger",
].map(normalizeKey);
function isAllowedNumericUI(col: string): boolean {
  const norm = normalizeKey(col);
  return ALLOWED_NUMERIC_UI_MATCHES.some(tag => norm.includes(tag));
}
const DICT_ALIASES: Record<string,string> = { "CD_ASPCT_ROUTE": "ROUTE_ASPECT", "ASPCT_ROUTE": "ROUTE_ASPECT" };

function getDictSection(dict: any, col: string) {
  if (!dict) return null;
  const variants = [col, col.toUpperCase(), `CD_${col}`, `CD_${col}`.toUpperCase(), DICT_ALIASES[col] || "", DICT_ALIASES[col?.toUpperCase?.()] || ""].filter(Boolean);
  for (const k of variants) { if (dict[k]) return dict[k]; }
  return null;
}
function columnDisplayName(dict: any, col: string): string {
  const labelsNode = dict?.__labels__;
  if (labelsNode) {
    const variants = [col, col.toUpperCase(), `CD_${col}`, `CD_${col}`.toUpperCase(), DICT_ALIASES[col] || "", DICT_ALIASES[col?.toUpperCase?.()] || ""].filter(Boolean);
    for (const k of variants) { if (typeof labelsNode[k] === "string") return labelsNode[k]; }
  }
  const sec = getDictSection(dict, col);
  if (sec && typeof sec === "object" && typeof sec.label === "string") return sec.label;

  if (normalizeKey(col).includes("nb automobile camion leger")) return "Number of automobile";
  if (normalizeKey(col).includes("nb bicyclette")) return "Number of bicycle";
  if (normalizeKey(col).includes("nb motocyclette")) return "Number of motorcycle";

  const norm = col.toUpperCase();
  if (norm === "JR_SEMN_ACCDN") return "Day of the week";
  if (norm.includes("HEURE") || norm === "HR_ACCDN" || norm === "HEURE_ACCDN") return "Time of day";
  return col.replaceAll("_", " ");
}
function optionDisplayLabel(dict: any, col: string, rawVal: string) {
  const sec = getDictSection(dict, col);
  if (sec && typeof sec === "object") {
    if (Object.prototype.hasOwnProperty.call(sec, rawVal)) return String(sec[rawVal]);
    const asNum = Number(rawVal);
    if (Number.isFinite(asNum) && Object.prototype.hasOwnProperty.call(sec, asNum)) return String(sec[asNum]);
  }
  return rawVal;
}
function findTimeCols(catCols: string[]) {
  let timeOfDay: string | null = null;
  let dayOfWeek: string | null = null;
  for (const c of catCols) {
    const up = c.toUpperCase(); const nrm = normalizeKey(c);
    if (!timeOfDay && (up.includes("HEURE") || up.includes("HR_ACCDN") || up.includes("HEURE_ACCDN") || nrm.includes("time"))) timeOfDay = c;
    if (!dayOfWeek && (up.includes("JR_SEMN") || nrm.includes("day of week") || nrm.includes("weekday"))) dayOfWeek = c;
  }
  return { timeOfDay, dayOfWeek };
}
const EXCLUDE_SEV_CATS = new Set(["work_zone","workzone","zone_travaux","travaux","work_zone_ind","work_zone_indicator"].map(normalizeKey));

// ------------------- Custom Select -------------------
function useClickAway(ref: React.RefObject<HTMLElement>, onAway: () => void) {
  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onAway();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ref, onAway]);
}
type CustomSelectProps = {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  display: (v: string) => string;
};
function CustomSelect({ value, options, onChange, display }: CustomSelectProps) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  useClickAway(wrapRef, () => setOpen(false));
  const currentLabel = value ? display(value) : (options[0] ? display(options[0]) : "");

  return (
    <div className="select-shell" ref={wrapRef}>
      <div
        className="input ctrl-xs select-display"
        onClick={() => setOpen(v => !v)}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {currentLabel}
      </div>
      <div className="select-caret">▾</div>
      {open && (
        <div className="select-list" role="listbox">
          {options.map(opt => {
            const active = opt === value;
            return (
              <div
                key={String(opt)}
                role="option"
                aria-selected={active}
                className={`select-item${active ? " is-active" : ""}`}
                onClick={() => { onChange(opt); setOpen(false); }}
              >
                {display(opt)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ------------------- Component -----------------------
export default function ModelSeverity() {
  React.useEffect(() => { registerModelTheme?.(); }, []);

  const [numVals, setNumVals] = React.useState<Record<string, number>>({});
  const [catVals, setCatVals] = React.useState<Record<string, string>>({});
  const [dict, setDict] = React.useState<any>(null);
  const [meta, setMeta] = React.useState<SevMeta | null>(null);

  const [session, setSession] = React.useState<any>(null);
  const [dlPct, setDlPct] = React.useState<number>(0);
  const [initPct, setInitPct] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [score, setScore] = React.useState<number | null>(null);
  const [label, setLabel] = React.useState<string | null>(null);
  const [smetrics, setSMetrics] = React.useState<SevMetrics | null>(null);

  const { openModal: openPerm, Overlay: PermOverlay } = useFullscreenModal();
  const [permOpt, setPermOpt] = React.useState<any>(null);

  React.useEffect(() => {
    loadLabels(DICT_PATH).then(setDict).catch(()=>{});
    fetch(SEV_META_PATH)
      .then(r=>r.ok?r.json():Promise.reject("meta"))
      .then((m:SevMeta)=>{
        setMeta(m);
        const nv: Record<string, number> = {};
        (m.num_cols || []).forEach(col => {
          const fill = (m.num_fill && m.num_fill[col] != null) ? Number(m.num_fill[col]) : 0;
          nv[col] = Number.isFinite(fill) ? fill : 0;
        });
        const cv: Record<string, string> = {};
        (m.cat_cols || []).forEach(col => {
          const cats = m.cat_categories?.[col] || [];
          cv[col] = cats.length ? String(cats[0]) : "";
        });
        setNumVals(nv); setCatVals(cv);
      })
      .catch(e=>setErr(String(e)));

    fetch(SEV_METRICS_PATH).then(r=>r.ok?r.json():null).then((m:SevMetrics|null)=>{ if (m) setSMetrics(m); }).catch(()=>{});

    fetch(SEV_PERM_CSV_PATH).then(r=>r.ok?r.text():"").then(txt=>{
      if (!txt) return;
      const rows = txt.trim().split(/\r?\n/).map(l => l.split(","));
      if (!rows.length) return;
      const header = rows[0].map(h => h.trim().toLowerCase());
      const dataRows = rows.slice(1);
      let fi: PermRow[] = [];
      if (header.includes("feature") && header.some(h => ["importance","perm","permutation"].includes(h))) {
        const fIdx = header.indexOf("feature");
        const iIdx = ["importance","perm","permutation"].map(k=>header.indexOf(k)).find(i=>i>=0) ?? 1;
        fi = dataRows.map(r => ({ feature: r[fIdx], importance: Number(r[iIdx]) }))
                     .filter(d => d.feature && Number.isFinite(d.importance));
      } else if (rows[0].length === 2) {
        fi = rows.map(r => ({ feature: r[0], importance: Number(r[1]) }))
                 .filter(d => d.feature && Number.isFinite(d.importance));
      }
      fi.sort((a,b)=> b.importance - a.importance);
      if (fi.length) {
        setPermOpt({
          grid: { left: 120, right: 20, top: 8, bottom: 20 },
          xAxis: { type: "value", name: "importance" },
          yAxis: { type: "category", data: fi.map(d => d.feature), axisLabel:{ fontSize: 11 } },
          series: [{ type: "bar", data: fi.map(d => d.importance) }],
          tooltip: { trigger: "item" }
        });
      }
    }).catch(()=>{});
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    (async () => {
      try {
        const { session, onDownload, onInit } = await getSessionWithProgress(SEV_ONNX_PATH);
        onDownload((p:number)=>!cancelled && setDlPct(p));
        onInit((p:number)=>!cancelled && setInitPct(p));
        setSession(session);
      } catch (e:any) { if (!cancelled) setErr(String(e)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return ()=>{ cancelled = true; };
  }, []);

  function overallPct(dl: number, init: number) {
    // simple blended indicator (70% download, 30% init)
    return Math.round(Math.max(0, Math.min(100, 0.7 * dl + 0.3 * init)));
  }

  function buildX(): Float32Array {
    if (!meta) return new Float32Array(0);
    const { num_cols = [], cat_cols = [], cat_categories = {} } = meta;

    const nums = num_cols.map(col => {
      const v = numVals[col];
      if (Number.isFinite(v)) return Number(v);
      const fill = meta.num_fill && meta.num_fill[col] != null ? Number(meta.num_fill[col]) : 0;
      return Number.isFinite(fill) ? fill : 0;
    });

    const catsOneHot: number[] = [];
    for (const col of cat_cols) {
      const cats = cat_categories[col] || [];
      const chosen = String(catVals[col] ?? (cats[0] ?? ""));
      if (cats.length) {
        for (const c of cats) catsOneHot.push(String(c) === chosen ? 1 : 0);
      } else {
        catsOneHot.push(Number.isFinite(Number(chosen)) ? Number(chosen) : 0);
      }
    }

    const vec = new Float32Array(nums.length + catsOneHot.length);
    vec.set(nums, 0); vec.set(catsOneHot, nums.length);
    return vec;
  }
  function scoreToClass(y: number): string {
    if (!meta) return "Unknown";
    const t = meta.thresholds || []; let idx = 0; while (idx < t.length && y >= t[idx]) idx++;
    return meta.severity_labels[idx] ?? `Class ${idx}`;
  }
  async function predict() {
    if (!session || !meta) return;
    try {
      setErr(null); setScore(null); setLabel(null);
      const x = buildX(); if (!x.length) { setErr("Design vector is empty. Check severity_reg_meta.json."); return; }
      const inputName = meta.input_name || (session.inputNames && session.inputNames[0]) || "input";
      const out = await runOnnx(session, inputName, x, { batch: 1, features: x.length });
      let y = (typeof out === "number") ? out : (() => {
        const anyOut:any = out; const k = anyOut && Object.keys(anyOut)[0];
        const arr = k ? anyOut[k]?.data : null; return (arr && arr.length) ? Number(arr[0]) : NaN;
      })();
      setScore(y); setLabel(scoreToClass(y));
    } catch (e:any) { setErr(String(e)); }
  }
  const ready = !!session && !!meta;

  const catCols = meta?.cat_cols ?? [];
  const { timeOfDay, dayOfWeek } = findTimeCols(catCols);

  const ENV_PREF = ["CD_COND_METEO","COND_METEO","CD_ECLRM","ECLRM","CD_ETAT_SURFC","ETAT_SURFC"];
  const envCols: string[] = [];
  for (const name of ENV_PREF) if (catCols.includes(name)) envCols.push(name);
  for (const c of catCols) {
    const up = c.toUpperCase();
    if ((up.includes("COND") && up.includes("METEO")) || up.includes("ECLRM") || up.includes("ETAT_SURFC")) {
      if (!envCols.includes(c)) envCols.push(c);
    }
  }

  const placedCat = new Set<string>([timeOfDay||"", dayOfWeek||"", ...envCols].filter(Boolean));
  const otherCat = catCols.filter(c => {
    if (placedCat.has(c)) return false;
    return !EXCLUDE_SEV_CATS.has(normalizeKey(c));
  });

  const numericUI = (meta?.num_cols ?? []).filter(isAllowedNumericUI);

  // Confusion matrix (compact)
  const cmOpt = React.useMemo(() => {
    if (!smetrics?.confusion_matrix) return null;
    const labels = (smetrics.labels && smetrics.labels.length) ? smetrics.labels : [];
    const data: Array<[number, number, number]> = [];
    for (let i=0;i<smetrics.confusion_matrix.length;i++)
      for (let j=0;j<smetrics.confusion_matrix[i].length;j++)
        data.push([j, i, smetrics.confusion_matrix[i][j]]);
    const vmax = Math.max(...data.map(d=>d[2]));
    const opt: echarts.EChartsOption = {
      tooltip: { position: "top" },
      grid: { left: 70, right: 10, bottom: 10, top: 6 },
      xAxis: { type: "category", data: labels, name: "Predicted", axisLabel: { rotate: 25, fontSize: 11 } },
      yAxis: { type: "category", data: labels, name: "True", axisLabel: { fontSize: 11 } },
      visualMap: { show: false, min: 0, max: vmax, inRange: { color: ["#262626", "#8E1616", "#D84040"] } },
      series: [{ type: "heatmap", data, label: { show: true, color: "#fff", fontWeight: 600, fontSize: 11 } }]
    };
    return opt;
  }, [smetrics]);

  const blended = overallPct(dlPct, initPct);

  return (
    <div className="model-scope">
      <div className="model-two-col" style={{ gap: 16, padding: "16px 24px 24px" }}>
        {/* LEFT */}
        <div className="grid gap-4">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Severity — Calculator</div>
            </div>

            {loading ? (
              <div style={{ marginBottom: 8 }}>
                <LoadingRing pct={blended} />
              </div>
            ) : null}
            {err && <div style={{ color: "crimson", marginBottom: 8 }}>{err}</div>}

            {meta ? (
              <div className="form-grid" style={{ marginTop: 8 }}>
                {/* time of day / day of week */}
                {timeOfDay && (
                  <label className="field">
                    <span className="field-label">{columnDisplayName(dict, timeOfDay)}</span>
                    <CustomSelect
                      value={catVals[timeOfDay] ?? (meta.cat_categories[timeOfDay]?.[0] ?? "")}
                      options={meta.cat_categories[timeOfDay] || []}
                      onChange={(v)=> setCatVals(prev => ({ ...prev, [timeOfDay]: String(v) }))}
                      display={(v)=> optionDisplayLabel(dict, timeOfDay, String(v))}
                    />
                  </label>
                )}
                {dayOfWeek && (
                  <label className="field">
                    <span className="field-label">{columnDisplayName(dict, dayOfWeek)}</span>
                    <CustomSelect
                      value={catVals[dayOfWeek] ?? (meta.cat_categories[dayOfWeek]?.[0] ?? "")}
                      options={meta.cat_categories[dayOfWeek] || []}
                      onChange={(v)=> setCatVals(prev => ({ ...prev, [dayOfWeek]: String(v) }))}
                      display={(v)=> optionDisplayLabel(dict, dayOfWeek, String(v))}
                    />
                  </label>
                )}

                {/* numeric trio */}
                {numericUI.map(col => (
                  <label key={col} className="field">
                    <span className="field-label">{columnDisplayName(dict, col)}</span>
                    <input
                      className="input ctrl-xs"
                      inputMode="numeric"
                      type="number"
                      value={Number.isFinite(numVals[col]) ? numVals[col] : 0}
                      onChange={(e)=> setNumVals(prev => ({ ...prev, [col]: Number(e.target.value) }))}
                    />
                  </label>
                ))}

                {/* env block */}
                {envCols.map(col => (
                  <label key={col} className="field">
                    <span className="field-label">{columnDisplayName(dict, col)}</span>
                    <CustomSelect
                      value={catVals[col] ?? (meta.cat_categories[col]?.[0] ?? "")}
                      options={meta.cat_categories[col] || []}
                      onChange={(v)=> setCatVals(prev => ({ ...prev, [col]: String(v) }))}
                      display={(v)=> optionDisplayLabel(dict, col, String(v))}
                    />
                  </label>
                ))}

                {/* remaining categorical */}
                {otherCat.map(col => (
                  <label key={col} className="field">
                    <span className="field-label">{columnDisplayName(dict, col)}</span>
                    <CustomSelect
                      value={catVals[col] ?? (meta.cat_categories[col]?.[0] ?? "")}
                      options={meta.cat_categories[col] || []}
                      onChange={(v)=> setCatVals(prev => ({ ...prev, [col]: String(v) }))}
                      display={(v)=> optionDisplayLabel(dict, col, String(v))}
                    />
                  </label>
                ))}
              </div>
            ) : <div className="text-sm">Loading form…</div>}

            <div className="mt-3">
              <button className="btn primary" onClick={predict} disabled={!ready}>Predict</button>
            </div>

            {(label || score!=null) && (
              <div className="mt-3">
                <div className="text-sm mono">Predicted severity:</div>
                {label && <div style={{ fontSize: 20, fontWeight: 600 }}>{label}</div>}
                {score!=null && <div className="text-sm">Model score: <span className="mono">{score.toFixed(3)}</span></div>}
              </div>
            )}
          </div>

          {/* About — body text style normalized (unchanged logic) */}
          <div className="body-text">
            <ModelAbout/>
          </div>
        </div>

        {/* RIGHT */}
        <div className="grid gap-4">
          <div className="card" style={{ minHeight: 380 }}>
            <div className="card-header">
              <div className="card-title">Confusion Matrix</div>
            </div>
            {cmOpt ? (
              <ReactECharts
                option={{
                  ...cmOpt,
                  grid: { left: 90, right: 20, top: 20, bottom: 60 }, // more breathing space
                  xAxis: {
                    ...(cmOpt.xAxis as any),
                    axisLabel: { rotate: 35, fontSize: 12, color: "#ddd" },
                    nameGap: 30,
                  },
                  yAxis: {
                    ...(cmOpt.yAxis as any),
                    axisLabel: { fontSize: 12, color: "#ddd" },
                    nameGap: 30,
                  },
                }}
                theme={modelThemeName}
                style={{ width: "100%", height: 320 }} // slightly taller
              />
            ) : (
              <div className="text-sm">No confusion matrix available.</div>
            )}
          </div>


          {/* Key indices — classification report + KPIs */}
          <div className="card body-text">
            <div className="card-header">
              <div className="card-title">Key indices</div>
            </div>

            {smetrics?.per_class ? (
              <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid #2a2a2a", borderRadius: 10 }}>
                <table className="text-sm mono" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ background: "#121212" }}>
                      <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #2a2a2a" }}>Class</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid #2a2a2a" }}>Precision</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid #2a2a2a" }}>Recall</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid #2a2a2a" }}>F1</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid #2a2a2a" }}>Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smetrics.per_class.map((r, i) => (
                      <tr key={r.label} style={{ background: i % 2 ? "#0f0f0f" : "transparent" }}>
                        <td style={{ padding: "6px 10px" }}>{r.label}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>{r.precision==null?"":r.precision.toFixed(3)}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>{r.recall==null?"":r.recall.toFixed(3)}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>{r.f1==null?"":r.f1.toFixed(3)}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>{r.support==null?"":r.support}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-sm">No classification report.</div>}

            {smetrics?.overall ? (
              <div className="mono" style={{ display:"flex", gap: 24, flexWrap:"wrap", marginTop: 10 }}>
                {"qwk" in smetrics.overall && <div>QWK: {Number(smetrics.overall.qwk).toFixed(4)}</div>}
                {"threshold_0" in smetrics.overall && <div>t0: {Number(smetrics.overall.threshold_0).toFixed(3)}</div>}
                {"threshold_1" in smetrics.overall && <div>t1: {Number(smetrics.overall.threshold_1).toFixed(3)}</div>}
                {"threshold_2" in smetrics.overall && <div>t2: {Number(smetrics.overall.threshold_2).toFixed(3)}</div>}
                {"threshold_3" in smetrics.overall && <div>t3: {Number(smetrics.overall.threshold_3).toFixed(3)}</div>}
              </div>
            ) : null}
          </div>

          {/* Feature importance — separate section with fullscreen */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Feature importance — Permutation</div>
              {permOpt && <button className="icon-btn" onClick={openPerm} title="Full screen">⤢</button>}
            </div>
            {permOpt ? (
              <div style={{ width: "100%", height: 320 }}>
                <ReactECharts option={permOpt} theme={modelThemeName} style={{ width:"100%", height:"100%" }}/>
              </div>
            ) : (
              <div className="text-sm">No permutation table found.</div>
            )}

            <PermOverlay title="Feature importance — Permutation">
              {permOpt && (
                <div className="fullscreen-chart" style={{ width: "100%", height: "100%" }}>
                  <ReactECharts option={permOpt} theme={modelThemeName} style={{ width:"100%", height:"100%" }}/>
                </div>
              )}
            </PermOverlay>
          </div>
        </div>
      </div>
    </div>
  );
}
