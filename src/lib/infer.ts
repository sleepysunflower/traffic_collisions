import * as ort from "onnxruntime-web";

// Serve WASM locally to avoid MIME/CORS issues
ort.env.wasm.wasmPaths = "/onnx/";
// (optional) tune if you like:
// ort.env.wasm.simd = true;
// ort.env.wasm.numThreads = 4;

export type RunShape = { batch: number; features: number };
type ProgressFn = (pct: number) => void;

export async function createSessionWithProgress(
  url: string,
  sessionOptions?: ort.InferenceSession.SessionOptions
) {
  const dlSubs: ProgressFn[] = [];
  const initSubs: ProgressFn[] = [];
  const onDownload = (fn: ProgressFn) => dlSubs.push(fn);
  const onInit = (fn: ProgressFn) => initSubs.push(fn);

  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Failed to fetch ONNX: ${url} (${res.status})`);
  const total = Number(res.headers.get("Content-Length") || 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      if (total > 0) {
        const pct = Math.min(100, Math.round((loaded / total) * 100));
        dlSubs.forEach(fn => fn(pct));
      }
    }
  }
  dlSubs.forEach(fn => fn(100));

  const blob = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) { blob.set(c, off); off += c.byteLength; }

  onInit(5);
  const session = await ort.InferenceSession.create(blob, sessionOptions);
  onInit(100);

  return { session, onDownload, onInit };
}

export async function run(
  session: ort.InferenceSession,
  inputName: string,
  data: Float32Array,
  shape: RunShape
) {
  const tensor = new ort.Tensor("float32", data, [shape.batch, shape.features]);
  const feeds: Record<string, ort.Tensor> = { [inputName]: tensor };
  const results = await session.run(feeds);
  const firstKey = Object.keys(results)[0];
  const arr = results[firstKey].data as Float32Array | Float64Array | Int32Array;
  if (arr && (arr as any).length === 1) return Number((arr as any)[0]);
  return results;
}
