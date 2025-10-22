import React, { Suspense } from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import "./mstyles.css"; // model-only styles

const Occurrence = React.lazy(() => import("./components/ModelOccurrence"));
const Severity   = React.lazy(() => import("./components/ModelSeverity"));

function HeaderBar() {
  const loc = useLocation();
  const active = loc.pathname.endsWith("/occurrence") ? "occurrence" : "severity";
  const linkBaseStyle: React.CSSProperties = { textDecoration: "none" };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      {/* Left: Back to landing */}
      <Link className="nav-btn" style={linkBaseStyle} to="/">← Back</Link>

      {/* Right: Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        <Link
          className="nav-btn"
          style={{ ...linkBaseStyle, ...(active === "occurrence" ? { borderColor: "#D84040", color: "#fff" } : null) }}
          to="/model/occurrence"
        >
          Occurrence
        </Link>
        <Link
          className="nav-btn"
          style={{ ...linkBaseStyle, ...(active === "severity" ? { borderColor: "#D84040", color: "#fff" } : null) }}
          to="/model/severity"
        >
          Severity
        </Link>
      </div>
    </div>
  );
}

export default function ModelPage() {
  return (
    <div className="model-scope">
      <HeaderBar />
      <div className="page-body">
        <Suspense fallback={<div className="card">Loading…</div>}>
          <Routes>
            <Route path="occurrence" element={<Occurrence />} />
            <Route path="severity" element={<Severity />} />
            {/* Default + catch-all → SEVERITY */}
            <Route index element={<Navigate to="/model/severity" replace />} />
            <Route path="*" element={<Navigate to="/model/severity" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}
