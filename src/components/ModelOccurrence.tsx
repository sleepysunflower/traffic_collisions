import React from "react";
import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import ModelAbout from "./ModelAbout2";
import { loadLabels } from "../lib/labels";
import { loadOccurrenceMeta, type OccurrenceMeta } from "../lib/modelMeta";
import { getSessionWithProgress } from "../lib/sessions";
import { run as runOnnx } from "../lib/infer";
import { useFullscreenModal } from "./useFullscreenModal";
import { modelThemeName, registerModelTheme } from "../mtheme";
import "../mstyles.css";

const OCC_ONNX_PATH     = "/data/models/occurrence.onnx";
const OCC_META_PATH     = "/data/models/occurrence_meta.json";
const DICT_PATH         = "/data/dictionary.json";
const OCC_GINI_CSV_PATH = "/data/models/occurrence_gini.csv";

const METRICS: Record<string, number> = {
  base_MAE: 0.37910470803572993,
  base_RMSE: 0.7530542861106703,
  base_R2: 0.3747244524635951,
  final_MAE: 0.37179685744658203,
  final_RMSE: 0.7396369785036166,
  final_R2: 0.39680725777706793
};

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

type GiniRow = { feature: string; importance: number };

function prettyFeatureUI(f: string): string {
  const rc = f.match(/^RC_rc_(\d{4})_(?:etat|indice)[ _]*(iri|pci)/i);
  if (rc) { const kind = (rc[1] || "").toUpperCase(); return kind==="PCI" ? "PCI value" : "IRI value"; }
  if (f.startsWith("landuse__")) return "Land use";
  if (f.startsWith("poi_type__")) return "POI type";
  if (f === "aadt" || f === "aadt_mean") return "AADT (avg daily traffic)";
  if (f === "population_aw" || f === "population") return "Population (area weighted)";
  if (f === "pop_density") return "Population density";
  if (f === "intersection_count") return "Intersection count";
  if (/_v$/.test(f)) return f.replace(/_v$/, "").replaceAll("_", " ");
  if (f === "year" || f === "annee") return "Year";
  return f;
}

type GroupedUI = {
  landuse?: string[];
  poi_type?: string[];
  rc_years: number[];
  rc_hasPCI: boolean;
  rc_hasIRI: boolean;
  atomic: string[];
};

function groupFeatures(features: string[]): GroupedUI {
  const landuse = new Set<string>(), poi=new Set<string>(), rc_years=new Set<number>();
  let rc_hasPCI = false, rc_hasIRI = false;
  const atomic:string[]=[];
  for (const f of features) {
    if (f.startsWith("landuse__")) { landuse.add(f.slice(9)); continue; }
    if (f.startsWith("poi_type__")) { poi.add(f.slice(10)); continue; }
    const m = f.match(/^RC_rc_(\d{4})_(?:etat|indice)[ _]*(iri|pci)/i);
    if (m) {
      rc_years.add(Number(m[1]));
      if ((m[2] || "").toLowerCase()==="pci") rc_hasPCI = true;
      if ((m[2] || "").toLowerCase()==="iri") rc_hasIRI = true;
      continue;
    }
    atomic.push(f);
  }
  return {
    landuse: landuse.size?Array.from(landuse):undefined,
    poi_type: poi.size?Array.from(poi):undefined,
    rc_years: Array.from(rc_years).filter(y => y !== 2020).sort(),
    rc_hasPCI, rc_hasIRI,
    atomic
  };
}


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
/* ——— custom compact select (same as in severity) ——— */
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
type CustomSelectProps = { value: string; options: string[]; onChange: (v: string) => void; };
function CustomSelect({ value, options, onChange }: CustomSelectProps) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  useClickAway(wrapRef, () => setOpen(false));
  const current = value || options[0] || "";
  return (
    <div className="select-shell" ref={wrapRef}>
      <div className="input ctrl-xs select-display" onClick={() => setOpen(v => !v)} role="button" aria-haspopup="listbox" aria-expanded={open}>{current}</div>
      <div className="select-caret">▾</div>
      {open && (
        <div className="select-list" role="listbox">
          {options.map(opt => {
            const active = opt === value;
            return (
              <div key={opt} role="option" aria-selected={active} className={`select-item${active ? " is-active" : ""}`} onClick={() => { onChange(opt); setOpen(false); }}>
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ModelOccurrence() {
  React.useEffect(() => { registerModelTheme?.(); }, []);

  // Row 1
  const [month, setMonth] = React.useState<number>(1);
  const [dow, setDow] = React.useState<string>("Mon");
  const [year, setYear] = React.useState<number>(2018);

  // Row 2
  const [landuseCat, setLanduseCat] = React.useState<string>("");
  const [landusePct, setLandusePct] = React.useState<number>(0);

  // Row 3
  const [poiCat, setPoiCat] = React.useState<string>("");
  const [poiCount, setPoiCount] = React.useState<number>(0);

  // Pavement (no year selector in UI)
  const [rcYear, setRcYear] = React.useState<number>(2018);
  const [pciValue, setPciValue] = React.useState<number>(70);
  const [iriValue, setIriValue] = React.useState<number>(2.5);

  // Row 6/7
  const [aadt, setAadt] = React.useState<number>(12000);
  const [populationAw, setPopulationAw] = React.useState<number>(0);
  const [intersectionCount, setIntersectionCount] = React.useState<number>(0);

  const [dyn, setDyn] = React.useState<Record<string, number>>({});
  const setDynVal = (f: string, val: number) => setDyn(prev => ({ ...prev, [f]: val }));

  const [meta, setMeta] = React.useState<OccurrenceMeta | null>(null);
  const [grouped, setGrouped] = React.useState<GroupedUI | null>(null);

  const [session, setSession] = React.useState<any>(null);
  const [dlPct, setDlPct] = React.useState<number>(0);
  const [initPct, setInitPct] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [yhat, setYhat] = React.useState<number | null>(null);

  const [giniOpt, setGiniOpt] = React.useState<any>(null);
  const { openModal: openGini, Overlay: GiniOverlay } = useFullscreenModal();

  React.useEffect(() => { loadLabels(DICT_PATH).catch(()=>{}); }, []);

  React.useEffect(() => {
    loadOccurrenceMeta(OCC_META_PATH)
      .then(m => {
        setMeta(m);
        const g = groupFeatures(m.features || []);
        setGrouped(g);

        // init atomics default = 0
        const init: Record<string, number> = {};
        for (const f of g.atomic) init[f] = 0;
        setDyn(prev => ({ ...init, ...prev }));

        if ((m.features||[]).includes("year")) setYear(2018);
        if ((m.features||[]).includes("annee")) setYear(2018);
        if (g.rc_years.length) setRcYear(g.rc_years[g.rc_years.length-1]); // latest non-2020
      })
      .catch(e => setErr(String(e)));
  }, []);

  React.useEffect(() => {
    fetch(OCC_GINI_CSV_PATH)
      .then(r => r.ok ? r.text() : "")
      .then(txt => {
        if (!txt) return;
        const rows = txt.trim().split(/\r?\n/).map(l => l.split(","));
        if (!rows.length) return;
        const header = rows[0].map(h => h.trim().toLowerCase());
        const dataRows = rows.slice(1);
        let fi: GiniRow[] = [];

        if (header.includes("feature") && (header.includes("importance") || header.includes("gini") || header.includes("gain"))) {
          const fIdx = header.indexOf("feature");
          const iIdx = header.indexOf("importance") >= 0 ? header.indexOf("importance")
                    : header.indexOf("gini") >= 0 ? header.indexOf("gini")
                    : header.indexOf("gain");
          fi = dataRows.map(r => ({ feature: r[fIdx], importance: Number(r[iIdx]) }))
                       .filter(d => d.feature && Number.isFinite(d.importance));
        } else if (rows[0].length === 2) {
          fi = rows.map(r => ({ feature: r[0], importance: Number(r[1]) }))
                   .filter(d => d.feature && Number.isFinite(d.importance));
        }

        fi.sort((a,b)=> b.importance - a.importance);
        if (fi.length) {
          setGiniOpt({
            grid: { left: 120, right: 20, top: 8, bottom: 20 },
            xAxis: { type: "value", name: "importance" },
            yAxis: { type: "category", data: fi.map(d => d.feature), axisLabel:{ fontSize: 11 } },
            series: [{ type: "bar", data: fi.map(d => d.importance) }],
            tooltip: { trigger: "item" }
          });
        }
      })
      .catch(()=>{});
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    (async () => {
      try {
        const { session, onDownload, onInit } = await getSessionWithProgress(OCC_ONNX_PATH);
        onDownload((p:number)=>!cancelled && setDlPct(p));
        onInit((p:number)=>!cancelled && setInitPct(p));
        setSession(session);
      } catch (e:any) { if (!cancelled) setErr(String(e)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return ()=>{ cancelled = true; };
  }, []);

  function buildInputVector(): Float32Array {
    const feats = (meta?.features && Array.isArray(meta.features)) ? meta.features : [];
    const v = new Float32Array(feats.length);

    const dowNum = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(dow) + 1 || 1;
    const yearKey = feats.includes("year") ? "year" : (feats.includes("annee") ? "annee" : null);
    const pciKeyA = (y:number)=>`RC_rc_${y}_etat_pci`;
    const pciKeyB = (y:number)=>`RC_rc_${y}_indice pci`;
    const iriKeyA = (y:number)=>`RC_rc_${y}_etat_iri`;
    const iriKeyB = (y:number)=>`RC_rc_${y}_indice iri`;

    for (let i=0;i<feats.length;i++){
      const f = feats[i];

      if (f === "month")            { v[i] = clamp(month, 1, 12); continue; }
      if (f === "dow_num")          { v[i] = dowNum; continue; }
      if (yearKey && f === yearKey) { v[i] = Number(year); continue; }

      if (f.startsWith("landuse__")) { const cat=f.slice(9); v[i]=(landuseCat===cat)?Number(landusePct??0):0; continue; }
      if (f.startsWith("poi_type__")) { const cat=f.slice(10); v[i]=(poiCat===cat)?Number(poiCount??0):0; continue; }

      // bind to chosen (hidden) rcYear; 2020 will never match because rcYear!=2020
      if ((f === pciKeyA(rcYear) || f === pciKeyB(rcYear))) { v[i] = Number(pciValue ?? 0); continue; }
      if ((f === iriKeyA(rcYear) || f === iriKeyB(rcYear))) { v[i] = Number(iriValue ?? 0); continue; }

      if (f === "aadt" || f === "aadt_mean") { v[i] = clamp(aadt, 0, 200000); continue; }
      if (f === "population_aw" || f === "population") { v[i] = Number(populationAw ?? 0); continue; }
      if (f === "intersection_count") { v[i] = Number(intersectionCount ?? 0); continue; }

      // Filter out precipitation-like variables entirely from UI; keep default 0
      const lower = f.toLowerCase();
      if (lower.includes("precip")) { v[i] = 0; continue; }

      if (Object.prototype.hasOwnProperty.call(dyn, f)) { v[i] = Number(dyn[f] ?? 0); continue; }
      v[i] = 0;
    }
    return v;
  }

  // Atomics: exclude *all* RC features robustly + precip + poi_total
  const atomicList = React.useMemo(()=>{
    const feats = meta?.features || [];
    const exclude = new Set([
      "month","dow_num","year","annee",
      "aadt","aadt_mean","population_aw","population","intersection_count",
      "max_temperature_v","min_temperature_v","max_dew_point_v","min_dew_point_v",
      "max_relative_humidity_v","min_relative_humidity_v","max_wind_speed_v",
      "rain_v","snow_v","snow_on_ground_v","solar_radiation_v","poi_total"
    ]);
    const isRC = (f:string)=>/^RC_rc_\d{4}_(?:etat|indice)[ _]*(iri|pci).*$/i.test(f); // ← more forgiving
    return feats.filter(f =>
      !exclude.has(f) &&
      !isRC(f) &&
      !f.toLowerCase().includes("precip") &&
      !f.startsWith("landuse__") &&
      !f.startsWith("poi_type__")
    );
  }, [meta?.features]);

  async function predict() {
    if (!session || !meta || !meta.features?.length) return;
    try {
      setErr(null); setYhat(null);
      const x = buildInputVector();
      const inputName = (session.inputNames && session.inputNames[0]) || "input";
      const out = await runOnnx(session, inputName, x, { batch: 1, features: x.length });
      let pred = (typeof out === "number") ? out : (() => {
        const anyOut: any = out as any; const k = anyOut && Object.keys(anyOut)[0];
        const arr = k ? anyOut[k]?.data : null; return (arr && arr.length) ? Number(arr[0]) : NaN;
      })();
      if (meta.is_log_target) pred = Math.max(0, Math.exp(pred) - 1e-9);
      setYhat(pred);
    } catch (e:any) { setErr(String(e)); }
  }

  return (
    <div className="model-scope">
      <div className="model-two-col" style={{ gap: 16, padding: "16px 24px 24px" }}>
        {/* LEFT */}
        <div className="grid gap-4">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Occurrence — Calculator</div>
              {/* subtitle + badge removed as requested */}
            </div>

            {loading ? (
              <div style={{ marginBottom: 8 }}>
                <LoadingRing pct={Math.round(0.7 * dlPct + 0.3 * initPct)} />
              </div>
            ) : null}

            {err && <div style={{ color: "crimson", marginBottom: 8 }}>{err}</div>}

            {/* Row 1 */}
            <div className="form-grid" style={{ marginTop: 8 }}>
              <label className="field">
                <span className="field-label">Month</span>
                <input className="input ctrl-xs" type="number" value={month} min={1} max={12} onChange={(e)=>setMonth(Number(e.target.value))}/>
              </label>
              <label className="field">
                <span className="field-label">Day of week</span>
                <CustomSelect value={dow} options={["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]} onChange={setDow}/>
              </label>

              {(meta?.features?.includes("year") || meta?.features?.includes("annee")) && (
                <>
                  <label className="field">
                    <span className="field-label">Year</span>
                    <input className="input ctrl-xs" type="number" value={year} onChange={(e)=>setYear(Number(e.target.value))}/>
                  </label>
                  <div />
                </>
              )}
            </div>

            {/* Row 2: Landuse */}
            {grouped?.landuse && grouped.landuse.length>0 && (
              <div className="form-grid" style={{ marginTop: 8 }}>
                <label className="field">
                  <span className="field-label">Land use category</span>
                  <CustomSelect value={landuseCat} options={["", ...grouped.landuse]} onChange={setLanduseCat}/>
                </label>
                <label className="field">
                  <span className="field-label">Land use — % area</span>
                  <input className="input ctrl-xs" type="number" value={landusePct} onChange={(e)=>setLandusePct(Number(e.target.value))}/>
                </label>
              </div>
            )}

            {/* Row 3: POI */}
            {grouped?.poi_type && grouped.poi_type.length>0 && (
              <div className="form-grid" style={{ marginTop: 8 }}>
                <label className="field">
                  <span className="field-label">POI type category</span>
                  <CustomSelect value={poiCat} options={["", ...grouped.poi_type]} onChange={setPoiCat}/>
                </label>
                <label className="field">
                  <span className="field-label">POI — total count</span>
                  <input className="input ctrl-xs" type="number" value={poiCount} onChange={(e)=>setPoiCount(Number(e.target.value))}/>
                </label>
              </div>
            )}

            {/* Row 4/5: Pavement inputs (no 'Pavement year' selector in UI) */}
            {(grouped?.rc_years?.length && (grouped.rc_hasPCI || grouped.rc_hasIRI)) ? (
              <div className="form-grid" style={{ marginTop: 8 }}>
                {grouped.rc_hasPCI && (
                  <label className="field">
                    <span className="field-label">PCI value</span>
                    <input className="input ctrl-xs" type="number" value={pciValue} onChange={(e)=>setPciValue(Number(e.target.value))}/>
                  </label>
                )}
                {grouped.rc_hasIRI && (
                  <label className="field">
                    <span className="field-label">IRI value</span>
                    <input className="input ctrl-xs" type="number" value={iriValue} onChange={(e)=>setIriValue(Number(e.target.value))}/>
                  </label>
                )}
              </div>
            ) : null}

            {/* Row 6 */}
            <div className="form-grid" style={{ marginTop: 8 }}>
              <label className="field">
                <span className="field-label">AADT (veh/day)</span>
                <input className="input ctrl-xs" type="number" value={aadt} min={0} max={200000} onChange={(e)=>setAadt(Number(e.target.value))}/>
              </label>
              <label className="field">
                <span className="field-label">Population (area-weighted)</span>
                <input className="input ctrl-xs" type="number" value={populationAw} onChange={(e)=>setPopulationAw(Number(e.target.value))}/>
              </label>
            </div>

            {/* Row 7 */}
            <div className="form-grid" style={{ marginTop: 8 }}>
              <label className="field">
                <span className="field-label">Intersection count</span>
                <input className="input ctrl-xs" type="number" value={intersectionCount} onChange={(e)=>setIntersectionCount(Number(e.target.value))}/>
              </label>
            </div>

            {/* Atomics (RC + precip removed robustly) */}
            {atomicList.length>0 && (
              <div className="form-grid" style={{ marginTop: 10 }}>
                {atomicList.map(f => (
                  <label key={f} className="field">
                    <span className="field-label" title={f}>{prettyFeatureUI(f)}</span>
                    <input className="input ctrl-xs" type="number" value={Number.isFinite(dyn[f]) ? dyn[f] : 0}
                           onChange={(e)=>setDynVal(f, Number(e.target.value))}/>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-3">
              <button className="btn primary" onClick={predict} disabled={!session || !meta?.features?.length}>Predict</button>
            </div>
            {(typeof yhat === "number" && !Number.isNaN(yhat)) && (
              <div className="mt-3">
                <div className="text-sm mono">Predicted collisions (cell/time):</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{yhat.toFixed(2)}</div>
              </div>
            )}
          </div>

          <div className="body-text">
            <ModelAbout />
          </div>
        </div>

        {/* RIGHT (Gini first, then Key indices) */}
        <div className="grid gap-4">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Feature importance — Gini</div>
              {giniOpt && <button className="icon-btn" onClick={openGini} title="Full screen">⤢</button>}
            </div>
            {giniOpt ? (
              <div style={{ width: "100%", height: 320 }}>
                <ReactECharts option={giniOpt} theme={modelThemeName} style={{ width: "100%", height: "100%" }} />
              </div>
            ) : <div className="text-sm">No Gini table found.</div>}

            <GiniOverlay title="Feature importance — Gini">
              {giniOpt && <div className="fullscreen-chart" style={{ width: "100%", height: "100%" }}><ReactECharts option={giniOpt} theme={modelThemeName} style={{ width:"100%", height:"100%" }}/></div>}
            </GiniOverlay>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Key indices</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="mono">
              <div>{["base_MAE","base_RMSE","base_R2"].map(k => (<div key={k}>{k}: {Number(METRICS[k]).toFixed(6)}</div>))}</div>
              <div>{["final_MAE","final_RMSE","final_R2"].map(k => (<div key={k}>{k}: {Number(METRICS[k]).toFixed(6)}</div>))}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
