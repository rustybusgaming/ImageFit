import Cropper from "react-easy-crop";
import { useState, useCallback, useEffect } from "react";
import type { Area } from "react-easy-crop";
import { Maximize2, RotateCw, ScanSearch } from "lucide-react";
import type { ImageTransform } from "../lib/imageProcessor";

interface Props {
  image: string;
  onChange: (transform: ImageTransform) => void;
}

export default function ImageEditor({ image, onChange }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [cropPixels, setCropPixels] = useState<Area | null>(null);

  const handleCropComplete = useCallback(
    (_croppedArea: Area, nextCropPixels: Area) => {
      setCropPixels(nextCropPixels);
    },
    []
  );

  useEffect(() => {
    if (cropPixels) {
      onChange({ crop: cropPixels, rotation });
    }
  }, [cropPixels, onChange, rotation]);

  function resetView() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Frame</p>
          <h2 className="text-xl font-semibold text-slate-900">Position your subject</h2>
        </div>
        <button
          type="button"
          onClick={resetView}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        >
          <RotateCw className="h-4 w-4" />
          Reset view
        </button>
      </div>

      <div className="relative h-[380px] overflow-hidden rounded-2xl bg-slate-950 sm:h-[500px]">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={handleCropComplete}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <ScanSearch className="h-4 w-4 text-sky-600" />
            <label htmlFor="zoom-slider">Zoom: {zoom.toFixed(1)}x</label>
          </div>
          <input
            id="zoom-slider"
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            aria-label="Adjust zoom level"
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <RotateCw className="h-4 w-4 text-sky-600" />
            <label htmlFor="rotation-slider">Rotation: {rotation}°</label>
          </div>
          <input
            id="rotation-slider"
            type="range"
            min="0"
            max="360"
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="w-full accent-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            aria-label="Adjust rotation angle"
          />
        </div>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
        <Maximize2 className="h-4 w-4 text-slate-400" />
        Your framing and rotation are applied to every export.
      </p>
    </div>
  );
}