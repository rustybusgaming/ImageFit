import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { ArrowRight, Download, FileImage, ImagePlus, LockKeyhole, RefreshCcw, Sparkles, X } from "lucide-react";
import DesktopControls from "./components/DesktopControls";
import UploadZone from "./components/UploadZone";
import PlatformSelector from "./components/PlatformSelector";
import type { PlatformPreset } from "./data/platforms";
import ImageEditor from "./components/ImageEditor";
import ExportPanel from "./components/ExportPanel";
import ImageSquisher from "./components/ImageSquisher";
import VideoSquisher from "./components/VideoSquisher";
import { useImage } from "./hooks/useImage";
import type { ImageTransform } from "./lib/imageProcessor";

export default function App() {
  const { image, imageFile, isVideo, loadImage, clearImage } = useImage();
  const isDesktop = typeof window !== "undefined" && Boolean(window.imageFitDesktop);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformPreset[]>([]);
  const [transform, setTransform] = useState<ImageTransform>();
  const [videoQueue, setVideoQueue] = useState<File[]>([]);
  const [imageQueue, setImageQueue] = useState<File[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const handleDesktopPaths = useEffectEvent((paths: string[]) => {
    const desktop = window.imageFitDesktop;
    if (!desktop) return;
    void desktop.readMediaFiles(paths).then(loadDesktopFiles);
  });

  useEffect(() => {
    if (!isDesktop) return;
    const desktop = window.imageFitDesktop;
    if (!desktop) return;

    return desktop.onOpenPaths(handleDesktopPaths);
  }, [isDesktop]);

  const handleTransformChange = useCallback((nextTransform: ImageTransform) => {
    setTransform(nextTransform);
  }, []);

  function handleReset() {
    clearImage();
    setSelectedPlatforms([]);
    setTransform(undefined);
    setVideoQueue([]);
    setImageQueue([]);
    setActiveImageIndex(0);
  }

  function handleUpload(files: File[]) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    const videos = files.filter((file) => file.type.startsWith("video/"));

    if (images.length > 0) {
      setImageQueue(images);
      setActiveImageIndex(0);
      setVideoQueue([]);
      setTransform(undefined);
      loadImage(images[0]);
      return;
    }

    if (videos.length > 0) {
      setImageQueue([]);
      setActiveImageIndex(0);
      setVideoQueue(videos);
      loadImage(videos[0]);
    }
  }

  function loadDesktopFiles(files: Array<{ name: string; bytes: Uint8Array }>) {
    handleUpload(files.map((file) => {
      const bytes = new Uint8Array(file.bytes.byteLength);
      bytes.set(file.bytes);
      return new File([bytes.buffer], file.name, { type: getMediaType(file.name) });
    }));
  }

  async function openDesktopMedia() {
    const desktop = window.imageFitDesktop;
    if (!desktop) return;

    loadDesktopFiles(await desktop.openMediaDialog());
  }

  function selectImage(index: number) {
    const nextImage = imageQueue[index];
    if (!nextImage) return;

    setActiveImageIndex(index);
    setTransform(undefined);
    loadImage(nextImage);
  }

  function removeImage(index: number) {
    const nextQueue = imageQueue.filter((_, queueIndex) => queueIndex !== index);

    if (nextQueue.length === 0) {
      clearImage();
      setImageQueue([]);
      setActiveImageIndex(0);
      setTransform(undefined);
      return;
    }

    setImageQueue(nextQueue);
    if (index === activeImageIndex) {
      const nextIndex = Math.min(index, nextQueue.length - 1);
      setActiveImageIndex(nextIndex);
      setTransform(undefined);
      loadImage(nextQueue[nextIndex]);
    } else if (index < activeImageIndex) {
      setActiveImageIndex(activeImageIndex - 1);
    }
  }

  return (
    <main className="min-h-screen bg-[#0c0d0c] bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:32px_32px] text-[#f4f4ed]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="border border-white/10 bg-[#151714]/90 p-4 shadow-[0_20px_70px_-40px_rgba(0,0,0,0.9)] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center bg-[#d7ff47] text-[#11120f] shadow-[4px_4px_0_#ff7448]">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h1 className="text-2xl font-bold tracking-[0.08em] text-[#f8f8f1]">IMAGEFIT</h1>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#a6aa9d]">Local media workstation</span>
                </div>
                <p className="mt-0.5 text-sm text-[#b7baaf]">Prepare images and Discord-ready video files.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isDesktop ? <DesktopControls onOpenMedia={() => void openDesktopMedia()} /> : null}
              <button
                type="button"
                onClick={(e) => {
                  if (!image) {
                    e.preventDefault();
                    return;
                  }
                  handleReset();
                }}
                aria-disabled={!image}
                title={!image ? "No media loaded" : undefined}
                className="inline-flex items-center justify-center gap-2 border border-white/15 bg-[#20231e] px-3 py-2 text-sm font-semibold text-[#e8eadf] transition hover:border-[#d7ff47] hover:text-[#d7ff47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151714] aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-white/15 aria-disabled:hover:text-[#e8eadf]"
              >
                <RefreshCcw className="h-4 w-4" />
                Start over
              </button>
            </div>
          </div>

          <div className="mt-5 grid border-t border-white/10 pt-4 sm:grid-cols-3">
            {[
              { icon: ImagePlus, title: "01", copy: "Load a source file" },
              { icon: Sparkles, title: "02", copy: "Edit or compress" },
              { icon: Download, title: "03", copy: "Download ready files" },
            ].map(({ icon: Icon, title, copy }) => (
              <div key={title} className="flex items-center gap-3 py-2 sm:border-r sm:border-white/10 sm:px-4 sm:first:pl-0 sm:last:border-r-0">
                <Icon className="h-4 w-4 shrink-0 text-[#d7ff47]" aria-hidden="true" />
                <div>
                  <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#ff9a7b]">{title}</span>
                  <p className="text-sm font-medium text-[#d9dbd2]">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </header>

        {!image ? (
          <UploadZone onUpload={handleUpload} />
        ) : isVideo && imageFile ? (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <section className="border border-white/10 bg-[#151714] p-5 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.9)]">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a6aa9d]">Video source</p>
              <h2 className="mt-1 text-xl font-semibold text-[#f4f4ed]">{imageFile.name}</h2>
              <video className="mt-5 max-h-[640px] w-full bg-[#090a09]" controls src={image} />
            </section>
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <VideoSquisher sourceFiles={videoQueue.length > 0 ? videoQueue : [imageFile]} />
            </aside>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-6">
              {imageQueue.length > 1 ? (
                <section className="border border-white/10 bg-[#151714] p-4 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.9)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a6aa9d]">Image queue</p>
                      <h2 className="mt-1 text-lg font-semibold text-[#f4f4ed]">{imageQueue.length} images loaded</h2>
                    </div>
                    <span className="font-mono text-xs text-[#d7ff47]">{activeImageIndex + 1} / {imageQueue.length}</span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {imageQueue.map((file, index) => (
                      <div key={`${file.name}-${file.lastModified}-${index}`} className={`flex min-w-0 items-center gap-2 border p-2 ${index === activeImageIndex ? "border-[#d7ff47] bg-[#242a1c]" : "border-white/10 bg-[#1b1e1a]"}`}>
                        <button type="button" onClick={() => selectImage(index)} className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47]">
                          <FileImage className="h-4 w-4 shrink-0 text-[#d7ff47]" />
                          <span className="truncate text-sm font-medium text-[#f0f1e9]">{file.name}</span>
                        </button>
                        <button type="button" onClick={() => removeImage(index)} className="grid h-7 w-7 shrink-0 place-items-center text-[#aeb2a5] transition hover:bg-[#3a201a] hover:text-[#ff9a7b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448]" aria-label={`Remove ${file.name} from the image queue`}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              <ImageEditor key={imageFile ? `${imageFile.name}-${imageFile.lastModified}` : image} image={image} onChange={handleTransformChange} />
              <PlatformSelector onSelect={setSelectedPlatforms} />

              <div className="border border-white/10 bg-[#151714] p-5 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.9)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a6aa9d]">Output queue</p>
                    <h2 className="mt-1 text-xl font-semibold text-[#f4f4ed]">
                      {selectedPlatforms.length === 0 ? "Build your export set" : `${selectedPlatforms.length} preset${selectedPlatforms.length === 1 ? "" : "s"} ready`}
                    </h2>
                  </div>
                  <div className="border border-[#d7ff47]/35 bg-[#20251a] px-3 py-1 font-mono text-xs font-semibold text-[#d7ff47]">
                    {selectedPlatforms.length > 0 ? `${selectedPlatforms.length} selected` : "None yet"}
                  </div>
                </div>

                {selectedPlatforms.length > 0 ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {selectedPlatforms.map((platform) => (
                      <div key={platform.id} className="flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-[#1b1e1a] px-3 py-2 text-sm">
                        <span className="font-medium text-[#f0f1e9]">{platform.platform} · {platform.name}</span>
                        <span className="font-mono text-xs text-[#aeb2a5]">
                          {platform.width}×{platform.height} · {platform.format.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#aeb2a5]">
                    Choose one or more presets to build your export bundle.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <ExportPanel image={image} platforms={selectedPlatforms} transform={transform} />
              <ImageSquisher image={image} sourceFile={imageFile} />

              <div className="border border-[#ff7448]/35 bg-[#241713] p-5 text-[#fff5ee] shadow-[0_16px_40px_-28px_rgba(0,0,0,0.9)]">
                <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[#ff9a7b]">Studio notes</h3>
                <ul className="mt-3 space-y-2 text-sm text-[#f3c6b8]">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9a7b]" />
                    Preview the current crop and rotation before export.
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9a7b]" />
                    Download each preset as its own file or as a zip bundle.
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9a7b]" />
                    Reuse the same source image whenever you need a fresh set of sizes.
                  </li>
                </ul>
              </div>
              <div className="flex items-center gap-3 border border-white/10 bg-[#151714] p-4 text-sm text-[#b7baaf]">
                <LockKeyhole className="h-5 w-5 shrink-0 text-[#d7ff47]" />
                <span>Your media stays on this device. Processing happens entirely in your browser.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function getMediaType(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  return ({
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/x-m4v", avi: "video/x-msvideo", mkv: "video/x-matroska",
  }[extension ?? ""] ?? "application/octet-stream");
}