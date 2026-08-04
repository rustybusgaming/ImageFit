import { useCallback, useState } from "react";
import { ArrowRight, CheckCircle2, Download, ImagePlus, LockKeyhole, RefreshCcw, Sparkles } from "lucide-react";
import UploadZone from "./components/UploadZone";
import PlatformSelector from "./components/PlatformSelector";
import type { PlatformPreset } from "./data/platforms";
import ImageEditor from "./components/ImageEditor";
import ExportPanel from "./components/ExportPanel";
import ImageSquisher from "./components/ImageSquisher";
import { useImage } from "./hooks/useImage";
import type { ImageTransform } from "./lib/imageProcessor";

export default function App() {
  const { image, imageFile, loadImage, clearImage } = useImage();
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformPreset[]>([]);
  const [transform, setTransform] = useState<ImageTransform>();

  const handleTransformChange = useCallback((nextTransform: ImageTransform) => {
    setTransform(nextTransform);
  }, []);

  function handleReset() {
    clearImage();
    setSelectedPlatforms([]);
    setTransform(undefined);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_35%),linear-gradient(135deg,_#f8fbff_0%,_#f4f7fb_55%,_#eef4ff_100%)] text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-slate-200/80 bg-white/80 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
                <Sparkles className="h-4 w-4" />
                Resize once. Export everywhere.
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">ImageFit</h1>
              <p className="mt-3 text-lg text-slate-600">
                One perfect frame, every social size. Crop once, then export a clean, platform-ready bundle.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReset}
              disabled={!image}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className="h-4 w-4" />
              Start over
            </button>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              { icon: ImagePlus, title: "Upload once", copy: "Drop in any JPG, PNG, or WebP file and begin editing instantly." },
              { icon: CheckCircle2, title: "Choose presets", copy: "Pick the exact social platform sizes you need for your workflow." },
              { icon: Download, title: "Export in bulk", copy: "Download a single file or bundle everything into a zip archive." },
            ].map(({ icon: Icon, title, copy }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <Icon className="h-5 w-5 text-sky-600" />
                <h2 className="mt-3 font-semibold text-slate-900">{title}</h2>
                <p className="mt-1 text-sm text-slate-600">{copy}</p>
              </div>
            ))}
          </div>
        </header>

        {!image ? (
          <UploadZone onUpload={loadImage} />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-6">
              <ImageEditor image={image} onChange={handleTransformChange} />
              <PlatformSelector onSelect={setSelectedPlatforms} />

              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Selection</p>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {selectedPlatforms.length === 0 ? "Build your export set" : `${selectedPlatforms.length} preset${selectedPlatforms.length === 1 ? "" : "s"} ready`}
                    </h2>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                    {selectedPlatforms.length > 0 ? `${selectedPlatforms.length} selected` : "None yet"}
                  </div>
                </div>

                {selectedPlatforms.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {selectedPlatforms.map((platform) => (
                      <div key={platform.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="font-medium text-slate-900">{platform.platform} · {platform.name}</span>
                        <span className="text-slate-600">
                          {platform.width}×{platform.height} · {platform.format.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">
                    Choose one or more presets to build your export bundle.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <ExportPanel image={image} platforms={selectedPlatforms} transform={transform} />
              <ImageSquisher image={image} sourceFile={imageFile} />

              <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-slate-100 shadow-sm">
                <h3 className="text-lg font-semibold">What happens next</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
                    Preview the current crop and rotation before export.
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
                    Download each preset as its own file or as a zip bundle.
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
                    Reuse the same source image whenever you need a fresh set of sizes.
                  </li>
                </ul>
              </div>
              <div className="flex items-center gap-3 rounded-[24px] border border-sky-100 bg-sky-50 p-4 text-sm text-slate-600">
                <LockKeyhole className="h-5 w-5 shrink-0 text-sky-600" />
                <span>Your images stay on this device. Processing happens entirely in your browser.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}