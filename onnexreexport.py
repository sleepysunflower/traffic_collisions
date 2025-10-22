# export_occurrence_onnx.py
from pathlib import Path
import json
import joblib
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

# Load your bundle
BUNDLE = joblib.load(r"C:\Users\ufojw\Documents\GIS projects\traffic_crash\models\occurrence\rf_bundle.joblib")
rf = BUNDLE["model"]
feature_names = BUNDLE["feature_names"]
use_log = bool(BUNDLE.get("use_log_target", True))

# ONNX export: flat float input (N features), web-friendly opset 13, no ZipMap
onnx_occ = convert_sklearn(
    rf,
    name="occurrence_model",
    initial_types=[("input", FloatTensorType([None, len(feature_names)]))],
    target_opset=13,
    options={"zipmap": False}
)

# Write to your web app’s static dir
OUT = Path(r"C:\Users\ufojw\OneDrive\Documents\GitHub\traffic_collisions\public\data\models")
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "occurrence.onnx").write_bytes(onnx_occ.SerializeToString())

# Save meta the TS code needs
(OUT / "occurrence_meta.json").write_text(
    json.dumps({"feature_names": feature_names, "use_log_target": use_log}, indent=2),
    encoding="utf-8"
)

print("Exported occurrence.onnx and occurrence_meta.json")
