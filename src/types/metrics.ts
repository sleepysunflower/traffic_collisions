export type KV = { k: string; rmse?: number; f1?: number; acc?: number };
export type FI = { name: string; importance: number };
export type CalBin = { bin: number; y_pred_mean: number; y_true_mean: number; count: number };
export type ResidualPt = { y_pred: number; residual: number };

export interface OccurrenceMetrics {
  version: string;
  dataset: string;
  n_train: number; n_test: number;
  metrics: { r2: number; rmse: number; mae: number; mape?: number };
  feature_importance: FI[];
  calibration?: CalBin[];
  residual_sample?: ResidualPt[];
  segment_scores?: { dow?: KV[]; month?: KV[]; quartier?: KV[]; arrondissement?: KV[] };
  pdp?: Record<string, Array<{x: number|string; y: number}>>;
}

export interface SeverityMetrics {
  version: string;
  labels: string[];
  support: number[];
  overall: { accuracy: number; macro_f1: number; weighted_f1: number };
  per_class: Array<{ label: string; precision: number; recall: number; f1: number; support: number }>;
  confusion_matrix: number[][];
  feature_importance: FI[];
  pr_curves?: Record<string, Array<{ r: number; p: number }>>;
}
