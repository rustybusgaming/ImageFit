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
    <div className="border border-white/10 bg-[#151714] p-4 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.9)] sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a6aa9d]">Frame controls</p>
          <h2 className="mt-1 text-xl font-semibold text-[#f4f4ed]">Position your subject</h2>
        </div>
        <button
          type="button"
          onClick={resetView}
          className="inline-flex items-center gap-2 border border-white/15 bg-[#20231e] px-3 py-2 text-sm font-semibold text-[#e8eadf] transition hover:border-[#d7ff47] hover:text-[#d7ff47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151714]"
        >
          <RotateCw className="h-4 w-4" />
          Reset view
        </button>
      </div>

      <div className="relative h-[380px] overflow-hidden border border-white/10 bg-[#090a09] sm:h-[500px]">
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

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="space-y-3 border border-white/10 bg-[#1b1e1a] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[#d9dbd2]">
            <ScanSearch className="h-4 w-4 text-[#d7ff47]" />
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
            className="w-full accent-[#d7ff47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151714]"
            aria-label="Adjust zoom level"
          />
        </div>

        <div className="space-y-3 border border-white/10 bg-[#1b1e1a] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[#d9dbd2]">
            <RotateCw className="h-4 w-4 text-[#d7ff47]" />
            <label htmlFor="rotation-slider">Rotation: {rotation}°</label>
          </div>
          <input
            id="rotation-slider"
            type="range"
            min="0"
            max="360"
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="w-full accent-[#d7ff47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151714]"
            aria-label="Adjust rotation angle"
          />
        </div>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-[#9ea296]">
        <Maximize2 className="h-4 w-4 text-[#aeb2a5]" />
        Your framing and rotation are applied to every export.
      </p>
    </div>
  );
}