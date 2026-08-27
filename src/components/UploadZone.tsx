import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileImage, FileVideo, UploadCloud } from "lucide-react";
import { isDesktopApp } from "../lib/desktopVideoProcessor";
import { classifyMedia } from "../lib/imageFormats";

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
  /** Set while an upload is being converted into a format the browser can display. */
  isBusy?: boolean;
  /** Reported by the loader when a file could not be opened. */
  error?: string | null;
}

export default function UploadZone({ onUpload, isBusy = false, error: externalError = null }: UploadZoneProps) {
  const [error, setError] = useState<string | null>(null);
  const supportsLargeVideoFiles = isDesktopApp();

  function handleFiles(files: File[]) {
    const invalidFile = files.find((file) => classifyMedia(file) === "unsupported");
    if (invalidFile) {
      setError("Please choose a valid image or video file.");
      return;
    }

    const limitFor = (file: File) => {
      if (classifyMedia(file) !== "video") return 50 * 1024 * 1024;
      return supportsLargeVideoFiles ? Number.POSITIVE_INFINITY : 3 * 1024 * 1024 * 1024;
    };

    const oversizedFile = files.find((file) => file.size > limitFor(file));
    if (oversizedFile) {
      const isVideo = classifyMedia(oversizedFile) === "video";
      setError(`This ${isVideo ? "video" : "image"} is larger than ${isVideo ? "3 GB" : "50 MB"}.`);
      return;
    }

    setError(null);
    onUpload(files);
  }

  // Extracted isDragReject to handle invalid file hovers visually
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: {
      "image/*": [
        ".png", ".apng", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif",
        ".bmp", ".ico", ".tif", ".tiff", ".psd", ".qoi", ".tga", ".targa", ".dds", ".jp2", ".j2k", ".heic", ".heif",
      ],
      "video/*": [".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"],
    },
    multiple: true,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        handleFiles(acceptedFiles);
      }
    },
    onDropRejected: (rejections) => {
      if (rejections.length > 0) {
        setError("Please choose a valid image or video file.");
      }
    },
  });

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div
        {...getRootProps()}
        className={`group relative cursor-pointer overflow-hidden border-2 p-10 text-center shadow-[0_24px_70px_-42px_rgba(0,0,0,0.95)] transition-all duration-300 ease-out sm:p-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47] ${
          isDragReject 
            ? "border-[#ff7448] bg-[#2b1913] animate-pulse"
            : isDragActive
            ? "border-[#d7ff47] border-solid bg-[#202a16] shadow-[0_0_50px_-12px_rgba(215,255,71,0.4)] scale-[1.02]"
            : "border-dashed border-white/20 bg-[#151714] hover:border-[#d7ff47]/70 hover:bg-[#191c17]"
        }`}
        role="button"
        tabIndex={0}
        aria-label="Upload image or video drop zone"
      >
        <input {...getInputProps()} />

        <div className={`mx-auto mb-5 grid h-16 w-16 place-items-center bg-[#d7ff47] text-[#141610] transition-all duration-300 ${
          isDragReject
            ? "bg-[#ff7448] shadow-[5px_5px_0_#d7ff47] rotate-12"
            : isDragActive 
            ? "scale-125 shadow-[8px_8px_0_#ff7448] -translate-y-2 animate-pulse" 
            : "shadow-[5px_5px_0_#ff7448] group-hover:-translate-y-1"
        }`}>
          <UploadCloud className="h-8 w-8" aria-hidden="true" />
        </div>

        <p className={`text-2xl font-semibold tracking-[0.02em] transition-colors duration-300 ${
            isDragReject ? "text-[#ff9a7b]" : isDragActive ? "text-[#d7ff47]" : "text-[#f6f7f0]"
        }`}>
          {isBusy ? "Preparing your file..." : isDragReject ? "Invalid file type" : isDragActive ? "Drop to upload now!" : "Drop images or videos here"}
        </p>
        
        {/* Fade out extra text when dragging for a cleaner UI */}
        <div className={`transition-opacity duration-300 ${isDragActive || isDragReject ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
          <p className="mt-2 text-sm text-[#b7baaf]">or click to browse from your device</p>
          <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9ea296]">
            Images: PNG · APNG · JPG · WEBP · GIF · SVG · AVIF · BMP · TIFF · PSD · TGA · QOI · HEIC up to 50 MB &nbsp;•&nbsp; Videos: MP4 · WEBM · MOV · MKV · AVI {supportsLargeVideoFiles ? "any local size" : "up to 3 GB"}
          </p>
        </div>

        {error ?? externalError ? <p className="mt-4 text-sm font-semibold text-[#ff9a7b]">{error ?? externalError}</p> : null}
      </div>
      <div className="grid border-x border-b border-white/10 bg-[#121310] sm:grid-cols-2">
        <div className="flex items-center gap-3 border-b border-white/10 p-4 text-sm text-[#b7baaf] sm:border-b-0 sm:border-r">
          <FileImage className="h-5 w-5 text-[#d7ff47]" />
          Crop images or queue videos for Discord upload limits.
        </div>
        <div className="flex items-center gap-3 p-4 text-sm text-[#b7baaf]">
          <FileVideo className="h-5 w-5 text-[#d7ff47]" />
          Private by default — no image leaves your browser.
        </div>
      </div>
    </section>
  );
}