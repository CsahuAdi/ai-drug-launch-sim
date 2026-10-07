/**
 * Web Worker entry: runs the strategy grid search off the main thread so the UI stays
 * responsive. Protocol — in: { config }, out: { type: "progress" | "result" | "error" }.
 * Cancellation is done by the caller terminating the worker.
 */
import type { LaunchConfig } from "@/types/simulation";
import { findEfficientStrategies } from "./optimizer";

const ctx = self as unknown as {
  postMessage: (message: unknown) => void;
  onmessage: ((e: MessageEvent<{ config: LaunchConfig }>) => void) | null;
};

ctx.onmessage = async (e) => {
  try {
    const result = await findEfficientStrategies(e.data.config, (done, total) => ctx.postMessage({ type: "progress", done, total }), {
      yieldToEventLoop: false,
    });
    ctx.postMessage({ type: "result", result });
  } catch (err) {
    ctx.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
