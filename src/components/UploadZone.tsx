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
    <section className="mx-auto w-full max-w-4xl">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-[32px] border-2 border-dashed p-10 text-center shadow-[0_20px_60px_-30px_rgba(14,116,144,0.4)] transition sm:p-16 ${
          isDragActive
            ? "border-sky-500 bg-sky-50"
            : "border-slate-300 bg-white/80 hover:border-sky-400 hover:bg-slate-50"
        }`}
        role="button"
        tabIndex={0}
        aria-label="Upload image drop zone"
      >
        <input {...getInputProps()} />

        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-sky-100 text-sky-700">
          <UploadCloud className="h-8 w-8" aria-hidden="true" />
        </div>

        <p className="text-2xl font-semibold tracking-tight text-slate-900">
          {isDragActive ? "Drop your image here" : "Drop an image here"}
        </p>
        <p className="mt-2 text-sm text-slate-600">or click to browse from your device</p>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          PNG · JPG · WEBP · GIF · SVG &nbsp;•&nbsp; Up to 20 MB
        </p>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-600">
          <FileImage className="h-5 w-5 text-sky-600" />
          Select, crop, and rotate in one focused workspace.
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-600">
          <ShieldCheck className="h-5 w-5 text-sky-600" />
          Private by default — no image leaves your browser.
        </div>
      </div>
    </section>
  );
}