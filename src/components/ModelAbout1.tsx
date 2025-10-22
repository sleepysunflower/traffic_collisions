import React from "react";

export default function ModelAbout1() {
  return (
    <div className="card">
      <h3>About this model</h3>

      <details open>
        <summary>Objective</summary>
        <div className="text-sm" style={{ marginTop: 8, lineHeight: 1.6 }}>
          <p>
            Model collision <strong>severity levels</strong> (from property damage to fatal) with a
            Random-Forest–based <strong>ordinal regressor</strong>. Each <em>collision record</em> is one observation.
          </p>
        </div>
      </details>

      <details style={{ marginTop: 10 }} open>
        <summary>Prepreprocessing</summary>
        <div className="text-sm" style={{ marginTop: 8, lineHeight: 1.6 }}>
          <p>
            <strong>Numeric features:</strong> vehicle counts (<code>nb_*</code>),{" "}
            <code>VITESSE_AUTOR</code>, year (<code>AN</code>), month, quarter, hour.
          </p>
          <p>
            <strong>Categorical features:</strong> all coded variables from the "Collisions routières"
            dataset (e.g., <code>CD_GENRE_ACCDN</code>, <code>CD_ETAT_SURFC</code>,{" "}
            <code>CD_COND_METEO</code>, etc.).
          </p>
          <p>
            <strong>Missing values:</strong> imputed (median for numeric, most-frequent for categorical).
          </p>
        </div>
      </details>

      <details style={{ marginTop: 10 }} open>
        <summary>Target</summary>
        <div className="text-sm" style={{ marginTop: 8, lineHeight: 1.6 }}>
          <p>
            <code>GRAVITE</code> — 5 ordered categories mapped to integer
            codes <code>0–4</code>:
          </p>
          <ul style={{ marginLeft: 18 }}>
            <li>0 — Below reporting threshold</li>
            <li>1 — Material damage only</li>
            <li>2 — Minor injury</li>
            <li>3 — Serious injury</li>
            <li>4 — Fatal</li>
          </ul>
        </div>
      </details>

      <details style={{ marginTop: 10 }} open>
        <summary>Modeling workflow</summary>
        <div className="text-sm" style={{ marginTop: 8, lineHeight: 1.6 }}>
          <p>
            Train a <strong>RandomForestRegressor</strong> as an ordinal regressor that predicts a
            continuous <em>severity score</em>. After training, perform a grid search to find{" "}
            <strong>optimal thresholds</strong> that map the score back into the 5 classes, maximizing{" "}
            <strong>Quadratic Weighted Kappa (QWK)</strong> for robust ordinal agreement.
          </p>
        </div>
      </details>
    </div>
  );
}
