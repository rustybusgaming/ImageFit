import { useState } from "react";
import { platforms } from "../data/platforms";
import type { PlatformPreset } from "../data/platforms";

interface Props {
  onSelect: (platforms: PlatformPreset[]) => void;
}

export default function PlatformSelector({ onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PlatformPreset[]>([]);

  const filtered = platforms.filter((item) =>
    `${item.platform} ${item.name}`.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(platform: PlatformPreset) {
    const exists = selected.some((item) => item.id === platform.id);
    const updated = exists
      ? selected.filter((item) => item.id !== platform.id)
      : [...selected, platform];

    setSelected(updated);
    onSelect(updated);
  }

  return (
    <div className="space-y-4">
      <label htmlFor="platform-search" className="sr-only">
        Search platforms
      </label>
      <input
        id="platform-search"
        type="search"
        placeholder="Search platforms..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border p-3 dark:bg-neutral-900 dark:border-neutral-700"
        aria-label="Search for social media platforms"
      />

      <div className="grid gap-3 md:grid-cols-2" role="group" aria-label="Platform selection">
        {filtered.length === 0 ? (
          <p className="col-span-2 text-center py-8 opacity-60">No platforms found</p>
        ) : (
          filtered.map((platform) => {
            const isSelected = selected.some((item) => item.id === platform.id);
            return (
              <button
                key={platform.id}
                onClick={() => toggle(platform)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  isSelected
                    ? "bg-neutral-200 dark:bg-neutral-800 border-neutral-400 dark:border-neutral-600"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
                }`}
                aria-pressed={isSelected}
                aria-label={`${platform.platform} ${platform.name}, ${platform.width}×${platform.height}`}
              >
                <div className="font-bold">{platform.platform}</div>
                <div className="text-sm">{platform.name}</div>
                <p className="text-sm opacity-60 mt-1">
                  {platform.width}×{platform.height}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}