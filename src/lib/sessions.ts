// Simple caching wrapper around createSessionWithProgress so models init once.
import type * as ort from "onnxruntime-web";
import { createSessionWithProgress } from "./infer";

type ProgressFn = (pct: number) => void;

type Bundle = {
  session: ort.InferenceSession;
  onDownload: (fn: ProgressFn) => void;
  onInit: (fn: ProgressFn) => void;
};

const cache = new Map<string, Promise<Bundle>>();

export function getSessionWithProgress(url: string): Promise<Bundle> {
  if (!cache.has(url)) {
    const promise = (async () => {
      const { session, onDownload, onInit } = await createSessionWithProgress(url);
      return { session, onDownload, onInit };
    })();
    cache.set(url, promise);
  }
  return cache.get(url)!;
}
