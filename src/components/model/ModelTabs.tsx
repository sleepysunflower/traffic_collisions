import React from "react";
const ModelOccurrence = React.lazy(() => import("../ModelOccurrence"));
const ModelSeverity   = React.lazy(() => import("../ModelSeverity"));
import ModelInsights from "./ModelInsights";
import ModelScenarios from "./ModelScenarios";

export default function ModelTabs(){
  const [tab, setTab] = React.useState<"occ"|"sev"|"insights"|"scenarios">("occ");
  return (
    <div className="p-4">
      <div className="tabs mb-4">
        {["occ","sev","insights","scenarios"].map(t => (
          <button key={t} className={`tab ${tab===t ? "active":""}`} onClick={()=>setTab(t as any)}>
            {t==="occ"?"Occurrence":t==="sev"?"Severity":t==="insights"?"Insights":"Scenarios"}
          </button>
        ))}
      </div>
      <React.Suspense fallback={<div>Loading…</div>}>
        {tab==="occ" && <ModelOccurrence/>}
        {tab==="sev" && <ModelSeverity/>}
        {tab==="insights" && <ModelInsights/>}
        {tab==="scenarios" && <ModelScenarios/>}
      </React.Suspense>
    </div>
  );
}
