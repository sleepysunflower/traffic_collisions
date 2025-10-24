// src/lib/infer.ts
import * as ort from 'onnxruntime-web';

export type ProgressFn = (percent: number) => void;

export interface InferOptions {
  onInit?: ProgressFn;
  onDownload?: ProgressFn;
  onProgress?: ProgressFn;
  onDone?: () => void;
}

/* safe-call helpers */
const safe = <T extends any[]>(fn?: (...args: T) => void) =>
  (...args: T) => { try { fn?.(...args) } catch { /* ignore */ } };

/** What your components expect */
export async function run(
  session: ort.InferenceSession,
  inputName: string,
  x: Float32Array,
  shape: { batch: number; features: number }
): Promise<ort.Tensor | Record<string, ort.Tensor>> {
  const input = new ort.Tensor('float32', x, [shape.batch, shape.features]);
  const feeds: Record<string, ort.Tensor> = { [inputName]: input };
  const out = await session.run(feeds);
  const keys = Object.keys(out);
  return keys.length === 1 ? out[keys[0]] : out;
}

/** What sessions.ts expects:
 *   const { session, onDownload, onInit } = await createSessionWithProgress(url);
 * Where onDownload/onInit are REGISTRARS: (fn: ProgressFn) => void
 */
export async function createSessionWithProgress(
  modelUrl: string,
  opts?: InferOptions
): Promise<{
  session: ort.InferenceSession;
  onDownload: (fn: ProgressFn) => void;
  onInit: (fn: ProgressFn) => void;
}> {
  // subscriber lists
  const downloadSubs: ProgressFn[] = [];
  const initSubs: ProgressFn[] = [];
  const emitTo = (subs: ProgressFn[], v: number) => {
    for (const fn of subs) { safe(fn)(v); }
  };

  // registrar functions (what sessions.ts wants)
  const onDownload = (fn: ProgressFn) => { if (typeof fn === 'function') downloadSubs.push(fn); };
  const onInit     = (fn: ProgressFn) => { if (typeof fn === 'function') initSubs.push(fn); };

  // initial ticks
  safe(opts?.onInit)(5);
  emitTo(initSubs, 5);
  safe(opts?.onDownload)(10);
  emitTo(downloadSubs, 10);

  // (optional) set wasm paths once elsewhere:
  // ort.env.wasm.wasmPaths = import.meta.env.BASE_URL + 'onnx/';

  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ['wasm'],
  });

  // finished ticks
  safe(opts?.onProgress)(100);
  safe(opts?.onDownload)(100);
  safe(opts?.onInit)(100);
  emitTo(downloadSubs, 100);
  emitTo(initSubs, 100);
  safe(opts?.onDone)();

  return { session, onDownload, onInit };
}