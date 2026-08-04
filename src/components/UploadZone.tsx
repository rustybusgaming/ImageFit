import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileImage, ShieldCheck, UploadCloud } from "lucide-react";

interface UploadZoneProps {
  onUpload: (file: File) => void;
}

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("This file is larger than 20MB. Please pick a smaller image.");
      return;
    }

    setError(null);
    onUpload(file);
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
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
        aria-label="Upload image drop zone"
      >
        <input {...getInputProps()} />

        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center bg-[#d7ff47] text-[#141610] shadow-[5px_5px_0_#ff7448] transition-transform duration-200 group-hover:-translate-y-1">
          <UploadCloud className="h-8 w-8" aria-hidden="true" />
        </div>

        <p className="text-2xl font-semibold tracking-[0.02em] text-[#f6f7f0]">
          {isDragActive ? "Drop your image here" : "Drop an image here"}
        </p>
        <p className="mt-2 text-sm text-[#b7baaf]">or click to browse from your device</p>
        <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9ea296]">
          PNG · JPG · WEBP · GIF · SVG &nbsp;•&nbsp; Up to 20 MB
        </p>

        {error ? <p className="mt-4 text-sm text-[#ff9a7b]">{error}</p> : null}
      </div>
      <div className="grid border-x border-b border-white/10 bg-[#121310] sm:grid-cols-2">
        <div className="flex items-center gap-3 border-b border-white/10 p-4 text-sm text-[#b7baaf] sm:border-b-0 sm:border-r">
          <FileImage className="h-5 w-5 text-[#d7ff47]" />
          Select, crop, and rotate in one focused workspace.
        </div>
        <div className="flex items-center gap-3 p-4 text-sm text-[#b7baaf]">
          <ShieldCheck className="h-5 w-5 text-[#d7ff47]" />
          Private by default — no image leaves your browser.
        </div>
      </div>
    </section>
  );
}