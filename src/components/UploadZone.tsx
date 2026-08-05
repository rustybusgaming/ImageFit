import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileImage, FileVideo, UploadCloud } from "lucide-react";

interface UploadZoneProps {
  onUpload: (file: File) => void;
}

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      setError("Please choose a valid image or video file.");
      return;
    }

    const maxSize = isVideo ? 250 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`This ${isVideo ? "video" : "image"} is larger than ${isVideo ? "250" : "20"} MB.`);
      return;
    }

    setError(null);
    onUpload(file);
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
      "video/*": [".mp4", ".webm", ".mov", ".m4v"],
    },
    multiple: false,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        handleFile(file);
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
          {isDragActive ? "Drop your media here" : "Drop an image or video here"}
        </p>
        <p className="mt-2 text-sm text-[#b7baaf]">or click to browse from your device</p>
        <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9ea296]">
          Images: PNG · JPG · WEBP · GIF · SVG up to 20 MB &nbsp;•&nbsp; Videos: MP4 · WEBM · MOV up to 250 MB
        </p>

        {error ? <p className="mt-4 text-sm text-[#ff9a7b]">{error}</p> : null}
      </div>
      <div className="grid border-x border-b border-white/10 bg-[#121310] sm:grid-cols-2">
        <div className="flex items-center gap-3 border-b border-white/10 p-4 text-sm text-[#b7baaf] sm:border-b-0 sm:border-r">
          <FileImage className="h-5 w-5 text-[#d7ff47]" />
          Crop images or fit videos to Discord's upload limits.
        </div>
        <div className="flex items-center gap-3 p-4 text-sm text-[#b7baaf]">
          <FileVideo className="h-5 w-5 text-[#d7ff47]" />
          Private by default — no image leaves your browser.
        </div>
      </div>
    </section>
  );
}