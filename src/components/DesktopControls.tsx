import { useEffect, useState } from "react";
import { FolderOpen, HardDriveDownload, MonitorCog, RefreshCw, Upload } from "lucide-react";
import { getAvailableVideoEncoders } from "../lib/desktopVideoProcessor";

interface Props {
  onOpenMedia: () => void;
}

type UpdateState = "checking" | "downloading" | "ready" | "unavailable";

const CAPABILITIES = [
  { name: "NVIDIA NVENC", encoders: ["h264_nvenc", "hevc_nvenc", "av1_nvenc"], detail: "H.264, HEVC, and AV1 on compatible NVIDIA GPUs." },
  { name: "Intel Quick Sync", encoders: ["h264_qsv", "hevc_qsv", "av1_qsv"], detail: "H.264, HEVC, and AV1 on supported Intel graphics." },
  { name: "AMD AMF", encoders: ["h264_amf", "hevc_amf", "av1_amf"], detail: "H.264, HEVC, and AV1 on supported AMD graphics." },
  { name: "Apple VideoToolbox", encoders: ["h264_videotoolbox", "hevc_videotoolbox"], detail: "H.264 and HEVC on Apple hardware." },
] as const;

export default function DesktopControls({ onOpenMedia }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [outputDirectory, setOutputDirectory] = useState("");
  const [encoders, setEncoders] = useState<string[]>([]);
  const [update, setUpdate] = useState<{ state: UpdateState; version?: string } | null>(null);
  const desktop = window.imageFitDesktop;

  useEffect(() => {
    if (!desktop) return;

    void Promise.all([desktop.getOutputDirectory(), getAvailableVideoEncoders()]).then(([directory, availableEncoders]) => {
      setOutputDirectory(directory);
      setEncoders(availableEncoders);
    });
    return desktop.onUpdateStatus(setUpdate);
  }, [desktop]);

  if (!desktop) return null;

  async function chooseOutputDirectory() {
    if (!desktop) return;
    setOutputDirectory(await desktop.chooseOutputDirectory());
  }

  async function installUpdate() {
    if (!desktop) return;
    await desktop.installUpdate();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex items-center justify-center gap-2 border border-[#d7ff47]/45 bg-[#20251a] px-3 py-2 text-sm font-semibold text-[#d7ff47] transition hover:border-[#d7ff47] hover:bg-[#292f21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151714]"
        aria-expanded={isOpen}
      >
        <MonitorCog className="h-4 w-4" />
        Desktop
      </button>

      {isOpen ? (
        <section className="absolute right-0 z-20 mt-2 w-[min(32rem,calc(100vw-2rem))] border border-white/15 bg-[#11130f] p-4 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.95)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d7ff47]">Desktop controls</p>
              <h2 className="mt-1 text-lg font-semibold text-[#f4f4ed]">Native workspace</h2>
            </div>
            <button type="button" onClick={onOpenMedia} className="inline-flex items-center gap-2 border border-white/15 bg-[#20231e] px-3 py-2 text-xs font-semibold text-[#e8eadf] transition hover:border-[#d7ff47] hover:text-[#d7ff47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47]">
              <Upload className="h-4 w-4" />
              Open media
            </button>
          </div>

          <div className="mt-4 border border-white/10 bg-[#1b1e1a] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <FolderOpen className="h-4 w-4 shrink-0 text-[#ff9a7b]" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#f0f1e9]">Output folder</p>
                  <p className="truncate text-xs text-[#aeb2a5]" title={outputDirectory}>{outputDirectory || "Loading..."}</p>
                </div>
              </div>
              <button type="button" onClick={() => void chooseOutputDirectory()} className="grid h-8 w-8 shrink-0 place-items-center border border-white/15 text-[#d7ff47] transition hover:border-[#d7ff47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47]" aria-label="Choose output folder" title="Choose output folder">
                <FolderOpen className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 border border-white/10 bg-[#1b1e1a] p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-[#f0f1e9]"><HardDriveDownload className="h-4 w-4 text-[#d7ff47]" /> Hardware capabilities</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {CAPABILITIES.map((capability) => {
                const supported = capability.encoders.filter((encoder) => encoders.includes(encoder));
                return (
                  <div key={capability.name} className={`border p-2.5 ${supported.length > 0 ? "border-[#d7ff47]/40 bg-[#20251a]" : "border-white/10 bg-[#151714]"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#f0f1e9]">{capability.name}</p>
                      <span className={`font-mono text-[10px] uppercase ${supported.length > 0 ? "text-[#d7ff47]" : "text-[#8f9389]"}`}>{supported.length > 0 ? "Detected" : "Unavailable"}</span>
                    </div>
                    <p className="mt-1 text-xs leading-4 text-[#aeb2a5]">{supported.length > 0 ? supported.join(", ") : capability.detail}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-4 text-[#8f9389]">Unavailable engines are disabled because the required hardware, driver, operating system, or bundled FFmpeg encoder is not available. Software FFmpeg remains available for every codec.</p>
          </div>

          {update ? (
            <div className="mt-3 flex items-center gap-2 border border-[#d7ff47]/35 bg-[#20251a] p-3 text-xs text-[#d9dbd2]">
              <RefreshCw className={`h-4 w-4 shrink-0 text-[#d7ff47] ${update.state === "checking" || update.state === "downloading" ? "animate-spin" : ""}`} />
              <div className="min-w-0 flex-1">
                {update.state === "checking" ? "Checking for updates..." : update.state === "downloading" ? `Downloading ImageFit ${update.version ?? "update"}...` : update.state === "ready" ? `ImageFit ${update.version ?? "update"} is ready to install.` : "Updates are currently unavailable."}
              </div>
              {update.state === "ready" ? <button type="button" onClick={() => void installUpdate()} className="shrink-0 border border-[#d7ff47] px-2 py-1 font-semibold text-[#d7ff47] transition hover:bg-[#d7ff47] hover:text-[#11130f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47]">Install and restart</button> : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
