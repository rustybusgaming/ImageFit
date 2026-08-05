  import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileImage, FileVideo, UploadCloud } from "lucide-react";
  import { isDesktopApp } from "../lib/desktopVideoProcessor";

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
}

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const [error, setError] = useState<string | null>(null);
  const supportsLargeVideoFiles = isDesktopApp();

  function handleFiles(files: File[]) {
    const invalidFile = files.find((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/"));
    if (invalidFile) {
      setError("Please choose a valid image or video file.");
      return;
    }

    const oversizedFile = files.find((file) => file.size > (file.type.startsWith("video/") && supportsLargeVideoFiles ? Number.POSITIVE_INFINITY : file.type.startsWith("video/") ? 3 * 1024 * 1024 * 1024 : 50 * 1024 * 1024));
    if (oversizedFile) {
      setError(`This ${oversizedFile.type.startsWith("video/") ? "video" : "image"} is larger than ${oversizedFile.type.startsWith("video/") ? "3 GB" : "50 MB"}.`);
      return;
    }

    setError(null);
    onUpload(files);
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
      "video/*": [".mp4", ".webm", ".mov", ".m4v"],
    },
    multiple: true,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        handleFiles(acceptedFiles);
      }
    },
  });

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div
        {...getRootProps()}
        className={`group relative cursor-pointer overflow-hidden border border-dashed p-10 text-center shadow-[0_24px_70px_-42px_rgba(0,0,0,0.95)] transition sm:p-16 ${
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
          {isDragActive ? "Drop your media here" : "Drop images or videos here"}
        </p>
        <p className="mt-2 text-sm text-[#b7baaf]">or click to browse from your device</p>
        <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9ea296]">
          Images: PNG · JPG · WEBP · GIF · SVG up to 50 MB &nbsp;•&nbsp; Videos: MP4 · WEBM · MOV {supportsLargeVideoFiles ? "any local size" : "up to 3 GB"}
        </p>

        {error ? <p className="mt-4 text-sm text-[#ff9a7b]">{error}</p> : null}
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