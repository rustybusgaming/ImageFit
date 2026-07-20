import Cropper from "react-easy-crop";
import { useState, useCallback } from "react";
import type { Area } from "react-easy-crop";

interface Props {
  image: string;
  onCropComplete?: (croppedArea: Area, croppedAreaPixels: Area) => void;
}

export default function ImageEditor({ image, onCropComplete }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleCropComplete = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      onCropComplete?.(croppedArea, croppedAreaPixels);
    },
    [onCropComplete]
  );

  return (
    <div className="space-y-6">
      <div className="relative h-[500px] bg-black rounded-xl overflow-hidden">
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

      <div className="space-y-3">
        <label htmlFor="zoom-slider" className="block text-sm font-medium">
          Zoom: {zoom.toFixed(1)}x
        </label>
        <input
          id="zoom-slider"
          type="range"
          min="1"
          max="3"
          step="0.1"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
          aria-label="Adjust zoom level"
        />
      </div>

      <div className="space-y-3">
        <label htmlFor="rotation-slider" className="block text-sm font-medium">
          Rotation: {rotation}°
        </label>
        <input
          id="rotation-slider"
          type="range"
          min="0"
          max="360"
          value={rotation}
          onChange={(e) => setRotation(Number(e.target.value))}
          className="w-full"
          aria-label="Adjust rotation angle"
        />
      </div>
    </div>
  );
}