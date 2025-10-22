export type FeatureInfo = {
  dtype?: "float" | "int" | "onehot";
  desc?: string;
  unit?: string;
  categories?: string[];
};

export type OccurrenceMeta = {
  model_name: string;
  target: string;
  is_log_target?: boolean;
  features: string[];
  feature_info?: Record<string, FeatureInfo>;
};

type RawMeta = Partial<OccurrenceMeta> & Record<string, any>;

function normalizeOccurrenceMeta(raw: RawMeta): OccurrenceMeta {
  // Accept various field aliases
  const features =
    raw.features ??
    raw.feature_names ??
    raw.input_features ??
    raw.columns ??
    [];

  const model_name =
    raw.model_name ??
    raw.name ??
    raw.model ??
    "";

  const target =
    raw.target ??
    raw.y_name ??
    raw.dependent ??
    "";

  const is_log_target =
    raw.is_log_target ??
    raw.log_target ??
    false;

  let feature_info = raw.feature_info as OccurrenceMeta["feature_info"] | undefined;

  return {
    model_name,
    target,
    is_log_target: Boolean(is_log_target),
    features: Array.isArray(features) ? features.map(String) : [],
    feature_info
  };
}

export async function loadOccurrenceMeta(path = "/data/models/occurrence_meta.json"): Promise<OccurrenceMeta> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load occurrence meta: ${r.status} ${r.statusText}`);
  const raw = (await r.json()) as RawMeta;
  const meta = normalizeOccurrenceMeta(raw);

  // Fail loudly if completely empty so UI can message clearly
  if (!meta.features?.length) {
    console.warn("Occurrence meta has no features. Raw keys:", Object.keys(raw));
  }
  return meta;
}
