import { useState } from "react";
import UploadZone from "./components/UploadZone";
import PlatformSelector from "./components/PlatformSelector";
import type { PlatformPreset } from "./data/platforms";
import ImageEditor from "./components/ImageEditor";
import ExportPanel from "./components/ExportPanel";
import { useImage } from "./hooks/useImage";

export default function App() {
  const { image, loadImage } = useImage();
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformPreset[]>([]);

  return (
    <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold mb-3">ImageFit</h1>
        <p className="opacity-60 mb-10">Resize once. Export everywhere.</p>

        {!image && <UploadZone onUpload={loadImage} />}

        {image && (
          <>
            <ImageEditor image={image} />

            <div className="mt-10">
              <PlatformSelector onSelect={setSelectedPlatforms} />
            </div>

            {selectedPlatforms.length > 0 && (
              <div className="mt-6 rounded-xl border p-5">
                <h2 className="text-xl font-bold mb-2">
                  Selected ({selectedPlatforms.length})
                </h2>
                <div className="space-y-2">
                  {selectedPlatforms.map((platform) => (
                    <div key={platform.id} className="text-sm">
                      <span className="font-medium">{platform.platform}</span>
                      {" - "}
                      {platform.name}
                      <span className="opacity-60 ml-2">
                        {platform.width}×{platform.height} {platform.format.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ExportPanel image={image} platforms={selectedPlatforms} />
          </>
        )}
      </div>
    </main>
  );
}