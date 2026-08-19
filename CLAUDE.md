# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install              # pnpm 11 is pinned via packageManager
pnpm dev                  # Vite dev server (browser build)
pnpm lint                 # ESLint
pnpm build                # tsc -b && vite build  -> dist/
pnpm test                 # node:test over test/**/*.test.cjs
pnpm desktop              # build with --base=./ then launch Electron
pnpm desktop:package:linux    # AppImage into release/
pnpm desktop:package:win      # NSIS + portable into release/
```

Run one test file or one test case:

```bash
node --test test/desktop-video-config.test.cjs
node --test --test-name-pattern "output filenames" test/desktop-video-config.test.cjs
```

`pnpm build` and `pnpm build:desktop` differ only in `--base`: the web build hardcodes
`base: "/ImageFit/"` (GitHub Pages path) in `vite.config.ts`, and the desktop build must
override it to `./` because Electron loads `dist/index.html` from the filesystem. Using the
wrong one produces a blank Electron window.

## Architecture

### One React app, two runtimes

The same UI runs in a browser tab and inside Electron. `desktop/preload.cjs` exposes
`window.imageFitDesktop`; its presence is the only runtime switch, checked through
`isDesktopApp()` (`src/lib/desktopVideoProcessor.ts`) or directly in `src/App.tsx`.
Every media operation forks on it:

| Operation | Browser | Desktop |
|---|---|---|
| Save output | anchor `download` click (`src/lib/download.ts`) | `saveFile` IPC → native save dialog |
| Encode video | ffmpeg.wasm (`src/lib/videoProcessor.ts`) | spawned FFmpeg binary (`desktop/main.cjs`) |
| Open media | react-dropzone | OS dialog / file associations → bytes over IPC |

Desktop file opens arrive as `{name, bytes}` over IPC and are rebuilt into real `File`
objects in `App.tsx` (`loadDesktopFiles` / `getMediaType`), so everything downstream sees
the same `File` shape regardless of origin.

### The two FFmpeg pipelines are parallel implementations

`src/lib/videoProcessor.ts` (wasm) and the `desktop:video-encode` handler in
`desktop/main.cjs` (native) independently duplicate the codec argument table, audio
argument table, hardware-encoder map, target-bitrate math, and filter construction.
**A change to encoding behaviour almost always belongs in both files.** `HARDWARE_ENCODERS`
exists a third time in `VideoSquisher.tsx` (to grey out unsupported engines) and the
codec↔container matrix a fourth time in `desktop/video-config.cjs`.

They are not identical, and the differences matter:

- The wasm path builds a `-filter_complex` graph because it overlays a generated
  "ImageFit" watermark PNG as a second input, so it must `-map` streams explicitly. The
  native path uses plain `-vf` and relies on FFmpeg's default stream selection.
- Commas inside filter expressions must be escaped: `scale=-2:min(720\,ih)`. An unescaped
  one makes FFmpeg read it as a filter separator and abort with `No such filter: 'ih)'`.
- Both size-target their output in a single pass from `duration` and `maxBytes`, then
  reject the result if it overshoots. There is no bitrate retry loop (the image path in
  `compressImageToTarget` does iterate).

Hardware encoding is desktop-only. Engine→encoder names live in `HARDWARE_ENCODERS`
(`desktop/main.cjs`), but whether an engine can actually run lives in `ENGINE_REQUIREMENTS`
(`desktop/video-config.cjs`), because FFmpeg lists an encoder whenever the build was compiled
with it — which says nothing about the OS or device behind it. VAAPI needs a DRM render node
(`getVaapiDevice()`) and is the only engine that changes the filter chain
(`format=nv12,hwupload`); Media Foundation is Windows-only and VideoToolbox macOS-only, and
both take software frames like the vendor engines. Adding a platform-bound engine means adding
it to `ENGINE_REQUIREMENTS` rather than writing a new conditional. Non-VAAPI jobs get
`-hwaccel auto` for decode, which falls back to software on its own.

When changing FFmpeg arguments, verify them against the real binary rather than reasoning
about them — `node_modules/ffmpeg-static` is present after install and accepts the same
argument arrays. The browser render path can be exercised end to end with the pre-installed
Chromium: run `pnpm dev` and drive `/src/lib/*.ts` through `page.evaluate` dynamic imports.

### IPC validation boundary

`desktop/video-config.cjs` is deliberately Electron-free so it can be unit-tested under
plain `node --test`; it holds the only tests in the repo. That is also why the engine
platform gating lives there rather than in `main.cjs` — its helpers take an optional
`platform` argument so tests can simulate win32/darwin/linux. `assertVideoPayload` validates
every renderer-supplied encode payload in the main process, and `getOutputFilename` must
return a flat, sanitised filename — it is joined onto the user's output directory, so any
segment interpolated into it needs sanitising. New IPC payload fields belong in its
validator plus `src/types/desktop.d.ts` (which types `window.imageFitDesktop` globally).

Progress streaming is correlated by `jobId`: preload mints a UUID per `encodeVideo` call,
main tags `desktop:video-progress` events with it, preload routes them back to the right
callback.

### Image export pipeline

`src/lib/imageProcessor.ts` is the public API (`resizeImage` for `ExportPanel`'s platform
presets, `compressImage` / `compressImageToTarget` for `ImageSquisher`, which works on the
original upload and deliberately ignores the editor crop and export settings). It owns no
drawing code — it decides where the work runs:

1. `renderPool.ts` dispatches to a pool of `imageWorker.ts` workers (OffscreenCanvas), so a
   preset batch composites in parallel and off the main thread. Preferred whenever
   `Worker` + `OffscreenCanvas.convertToBlob` + `createImageBitmap` are available.
2. Otherwise the same job runs inline on a DOM canvas.

Both call **`imageRenderCore.ts`**, which holds the only copy of the compositing logic and is
parameterised by a `CanvasBackend` (offscreen or DOM) so the two runtimes cannot drift apart —
unlike the video pipelines below. New drawing behaviour belongs there, not in either caller.

Colour treatments have two equivalent implementations that must stay in agreement:
`webglEffects.ts` runs them as a WebGL2 fragment shader (composed colour matrices plus a
contrast transfer, following the Filter Effects spec), and `getCanvasFilter` returns the
equivalent CSS filter string used when WebGL2 is unavailable. They agree to within ~2/255 per
channel; if you change one, re-check it against the other. The GPU pass is applied to the
foreground bitmap only, which is what keeps the blurred backdrop untreated.

Two details worth not "fixing":

- `transform.crop` comes from react-easy-crop's `croppedAreaPixels` and is expressed **relative
  to the rotated bounding box**, so rotation is applied by drawing into an intermediate canvas
  sized `w·cos+h·sin × w·sin+h·cos` before cropping out of it (this matches react-easy-crop's
  own `getCroppedImg` example — don't reorder it to crop-then-rotate).
- `background === "cover"` doubles as the fill/crop flag: it selects `Math.max` scaling
  (fill and overflow), every other background mode selects `Math.min` (contain and letterbox).

`gpuImageProcessor.ts` reports which of these paths is live (`getRenderPath()`) for the desktop
panel; it decides nothing itself.

### State ownership

`App.tsx` holds all workflow state. `imageQueue` and `videoQueue` are mutually exclusive —
`handleUpload` picks images if any are present and otherwise videos. `useImage` owns the
single active object URL and revokes the previous one on every load, so nothing else should
call `createObjectURL` on the source file. `ImageEditor` is remounted via a `key` derived
from the file identity to reset crop state between images.

## Conventions

- Buttons that are unavailable use `aria-disabled` plus an early return in `onClick`, not the
  native `disabled` attribute, so `title` tooltips stay reachable on hover and to screen
  readers. Style them with Tailwind's `aria-disabled:` variant. This is recorded in
  `.Jules/palette.md`, a running log of UI learnings that other agents append to.
- Tailwind v4 through `@tailwindcss/vite`; there is no `tailwind.config`. Colours are inline
  hex literals in class strings (`bg-[#151714]`, `text-[#d7ff47]`), not theme tokens — match
  the surrounding palette rather than introducing named colours.
- Platform presets live in `src/data/platforms.ts`; `id` is used as the export filename stem
  and must stay unique.

## CI

Push to `main` builds and deploys `dist/` to GitHub Pages after running `pnpm test` and
`pnpm build`. Pushing a `v*` tag additionally builds Linux and Windows desktop targets and
publishes them to a GitHub release, which is what `electron-updater` and the in-app update
check read.
