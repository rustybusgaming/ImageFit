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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      // Several of these arrive as application/octet-stream because browsers do not know
      // them, so the extension list is what actually admits them.
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
    // Without this, files the dropzone filters out land nowhere and the drop looks like it did nothing.
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
        className={`group relative cursor-pointer overflow-hidden border border-dashed p-10 text-center shadow-[0_24px_70px_-42px_rgba(0,0,0,0.95)] transition sm:p-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47] ${
          isDragActive
            ? "border-[#d7ff47] bg-[#20251a]"
            : "border-white/20 bg-[#151714] hover:border-[#d7ff47]/70 hover:bg-[#191c17]"
        }`}
        role="button"
        tabIndex={0}
        aria-label="Upload image or video drop zone"
      >
        <input {...getInputProps()} />

        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center bg-[#d7ff47] text-[#141610] shadow-[5px_5px_0_#ff7448] transition-transform duration-200 group-hover:-translate-y-1">
          <UploadCloud className="h-8 w-8" aria-hidden="true" />
        </div>

        <p className="text-2xl font-semibold tracking-[0.02em] text-[#f6f7f0]">
          {isBusy ? "Preparing your file..." : isDragActive ? "Drop your media here" : "Drop images or videos here"}
        </p>
        <p className="mt-2 text-sm text-[#b7baaf]">or click to browse from your device</p>
        <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9ea296]">
          Images: PNG · APNG · JPG · WEBP · GIF · SVG · AVIF · BMP · TIFF · PSD · TGA · QOI · HEIC up to 50 MB &nbsp;•&nbsp; Videos: MP4 · WEBM · MOV · MKV · AVI {supportsLargeVideoFiles ? "any local size" : "up to 3 GB"}
        </p>

        {error ?? externalError ? <p className="mt-4 text-sm text-[#ff9a7b]">{error ?? externalError}</p> : null}
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