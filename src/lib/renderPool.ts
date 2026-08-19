/**
 * A small pool of render workers.
 *
 * Exporting a preset batch used to run every full-size composite and encode back to back on the
 * main thread, freezing the UI for the whole run. The pool spreads those jobs across workers and
 * keeps them off the main thread entirely.
 */

import type { RenderJob, RenderRequest, RenderResponse } from "./renderProtocol";

interface PoolWorker {
  worker: Worker;
  pending: Map<number, { resolve: (blob: Blob) => void; reject: (error: Error) => void }>;
}

interface Pool {
  workers: PoolWorker[];
  supportsGPUEffects: boolean;
}

let pool: Pool | null = null;
let poolFailed = false;
let nextJobId = 0;

export function supportsWorkerRendering(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas.prototype.convertToBlob === "function"
  );
}

function getPoolSize(): number {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined;
  // Each worker holds its own decoded copy of the source, so the pool is capped well below the
  // core count to bound memory on large uploads.
  return Math.max(1, Math.min(4, (cores ?? 4) - 1));
}

function spawn(): PoolWorker {
  const worker = new Worker(new URL("./imageWorker.ts", import.meta.url), { type: "module" });
  const entry: PoolWorker = { worker, pending: new Map() };

  worker.addEventListener("message", (event: MessageEvent<RenderResponse>) => {
    const { jobId, blob, error, ready, gpuEffects } = event.data;

    if (ready) {
      if (pool && gpuEffects === false) pool.supportsGPUEffects = false;
      return;
    }

    const request = entry.pending.get(jobId);
    if (!request) return;

    entry.pending.delete(jobId);
    if (blob) {
      request.resolve(blob);
    } else {
      request.reject(new Error(error ?? "The render worker returned no image."));
    }
  });

  worker.addEventListener("error", (event) => {
    const failure = new Error(event.message || "The render worker stopped unexpectedly.");
    for (const request of entry.pending.values()) request.reject(failure);
    entry.pending.clear();
  });

  return entry;
}

function getPool(): Pool | null {
  if (pool) return pool;
  if (poolFailed || !supportsWorkerRendering()) return null;

  try {
    pool = {
      workers: Array.from({ length: getPoolSize() }, spawn),
      supportsGPUEffects: true,
    };
    return pool;
  } catch {
    poolFailed = true;
    return null;
  }
}

export function isWorkerRenderingActive(): boolean {
  return getPool() !== null;
}

export function areGPUEffectsActive(): boolean {
  return getPool()?.supportsGPUEffects === true;
}

/** Runs a render job in the pool, or resolves null when worker rendering is unavailable. */
export function runRenderJob(sourceKey: string, source: Blob, job: RenderJob): Promise<Blob> | null {
  const active = getPool();
  if (!active) return null;

  // Least-busy dispatch keeps a slow job from stalling the ones queued behind it.
  const target = active.workers.reduce((least, candidate) =>
    candidate.pending.size < least.pending.size ? candidate : least
  );

  const jobId = nextJobId++;
  const request: RenderRequest = {
    jobId,
    sourceKey,
    source,
    job,
    useGPUEffects: active.supportsGPUEffects,
  };

  return new Promise<Blob>((resolve, reject) => {
    target.pending.set(jobId, { resolve, reject });
    target.worker.postMessage(request);
  });
}
