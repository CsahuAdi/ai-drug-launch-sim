import type { LaunchConfig } from "@/types/simulation";
import { OptimizerCancelled, findEfficientStrategies, type OptimizerResult } from "./optimizer";

export interface OptimizerJob {
  promise: Promise<OptimizerResult>;
  /** Stops the search; `promise` rejects with OptimizerCancelled. */
  cancel: () => void;
  /** Where the search is running — worker thread, or main thread if Workers are unavailable. */
  mode: "worker" | "main";
}

type WorkerMessage =
  | { type: "progress"; done: number; total: number }
  | { type: "result"; result: OptimizerResult }
  | { type: "error"; message: string };

function runOnMainThread(config: LaunchConfig, onProgress: (p: number) => void): OptimizerJob {
  let cancelled = false;
  const promise = findEfficientStrategies(config, (d, t) => onProgress(d / t), {
    yieldToEventLoop: true,
    isCancelled: () => cancelled,
  });
  return { promise, cancel: () => (cancelled = true), mode: "main" };
}

/** Start the grid search in a Web Worker, falling back to the main thread if that isn't possible. */
export function startOptimizer(config: LaunchConfig, onProgress: (fraction: number) => void): OptimizerJob {
  if (typeof Worker === "undefined") return runOnMainThread(config, onProgress);

  let worker: Worker;
  try {
    worker = new Worker(new URL("./optimizer.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return runOnMainThread(config, onProgress);
  }

  let rejectFn: (e: unknown) => void = () => {};
  const promise = new Promise<OptimizerResult>((resolve, reject) => {
    rejectFn = reject;
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data;
      if (m.type === "progress") onProgress(m.done / m.total);
      else if (m.type === "result") {
        worker.terminate();
        resolve(m.result);
      } else {
        worker.terminate();
        reject(new Error(m.message));
      }
    };
    worker.onerror = (ev) => {
      worker.terminate();
      reject(new Error(ev.message || "Optimizer worker failed"));
    };
    worker.postMessage({ config });
  });

  return {
    promise,
    mode: "worker",
    cancel: () => {
      worker.terminate();
      rejectFn(new OptimizerCancelled());
    },
  };
}
