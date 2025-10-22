import React from "react";

export default function ModelAbout2() {
  return (
    <div className="card">
      <h3>About this model</h3>

      <details open>
        <summary>Objective</summary>
        <div className="text-sm" style={{ marginTop: 8, lineHeight: 1.6 }}>
          <p>
            Quantify <strong>monthly collision risk</strong> across urban cells and explain variation via
            built environment, traffic, and weather factors.
          </p>
        </div>
      </details>

      <details style={{ marginTop: 10 }} open>
        <summary>Spatial framework</summary>
        <div className="text-sm" style={{ marginTop: 8, lineHeight: 1.6 }}>
          <p>
            The Island of Montréal is divided into <strong>H3 resolution 9</strong> hexagons (~315 m).
            Each hex cell is a consistent spatial unit for aggregating and modeling collisions.
          </p>
        </div>
      </details>

      <details style={{ marginTop: 10 }} open>
        <summary>Monthly panel & features</summary>
        <div className="text-sm" style={{ marginTop: 8, lineHeight: 1.6 }}>
          <p>
            Build a unified <em>hex × month</em> table combining:
          </p>
          <ul style={{ marginLeft: 18 }}>
            <li>
              <strong>Built environment (static):</strong> AADT raster mean per hex, Population
              (areal-weighted), Intersection density, POI counts/types, Land-use proportions.
            </li>
            <li>
              <strong>Road condition (PCI, IRI):</strong> Aggregated from surveys (2010, 2015, 2018, 2020);
              choose the latest survey ≤ current year-month (length/area-weighted).
            </li>
            <li>
              <strong>Weather (monthly):</strong> city-level averages by month (temperature, precipitation,
              snow, etc.).
            </li>
          </ul>
        </div>
      </details>

      <details style={{ marginTop: 10 }} open>
        <summary>Target</summary>
        <div className="text-sm" style={{ marginTop: 8, lineHeight: 1.6 }}>
          <p>
            <strong>collision_count</strong> = number of collisions per <em>hex × month</em> (with
            auxiliary severity indicators). We fit on <code>log1p(collision_count)</code>.
          </p>
        </div>
      </details>

      <details style={{ marginTop: 10 }} open>
        <summary>Model training & evaluation</summary>
        <div className="text-sm" style={{ marginTop: 8, lineHeight: 1.6 }}>
          <p>
            <strong>Algorithm:</strong> <code>RandomForestRegressor</code> (light, regularized).
          </p>
          <p>
            <strong>Predictors:</strong> all features except IDs, time columns, and severity fields.
          </p>
          <p>
            <strong>Split:</strong> 80/20 train–test.
          </p>
          <p>
            <strong>Base config:</strong> 300 trees, <code>max_depth=20</code>,{" "}
            <code>min_samples_leaf=5</code>, <code>max_samples=0.7</code>.
          </p>
          <p>
            <strong>Metrics:</strong> MAE, RMSE, R² on test set.
          </p>
          <p>
            <strong>Feature selection:</strong> rank by Gini importance → keep top 60 → retrain final RF.
          </p>
          <p>
            <strong>Permutation importance (mini):</strong> 10,000-row subsample × 5 repeats for
            interpretability.
          </p>
        </div>
      </details>
    </div>
  );
}
