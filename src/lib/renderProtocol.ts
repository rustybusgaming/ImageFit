/** Message contract between the main thread and the render worker pool. */

import type { CompressionSettings, ExportSettings, ImageTransform } from "./imageProcessor";
import type { PresetSize } from "./imageRenderCore";

export type RenderJob =
  | { kind: "resize"; preset: PresetSize; transform?: ImageTransform; settings: ExportSettings }
  | { kind: "compress"; scale: number; settings: CompressionSettings };

export interface RenderRequest {
  jobId: number;
  /**
   * Identifies the decoded source in the worker's cache. The source Blob is sent on every
   * request because structured-cloning a Blob hands over a reference rather than copying the
   * bytes; the decode it feeds is what the cache actually saves.
   */
  sourceKey: string;
  source: Blob;
  job: RenderJob;
  useGPUEffects: boolean;
}

export interface RenderResponse {
  jobId: number;
  blob?: Blob;
  error?: string;
  ready?: boolean;
  gpuEffects?: boolean;
}
