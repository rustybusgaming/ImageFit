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
    <div className="rounded-[24px] border border-slate-200 bg-white/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Presets</p>
          <h2 className="text-xl font-semibold text-slate-900">Social platform sizes</h2>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
          {selected.length} selected
        </div>
      </div>

      <label htmlFor="platform-search" className="sr-only">
        Search platforms
      </label>
      <input
        id="platform-search"
        type="search"
        placeholder="Search platforms..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-0 transition focus:border-sky-400"
        aria-label="Search for social media platforms"
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2" role="group" aria-label="Platform selection">
        {filtered.length === 0 ? (
          <p className="col-span-2 rounded-2xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
            No platforms found
          </p>
        ) : (
          filtered.map((platform) => {
            const isSelected = selected.some((item) => item.id === platform.id);
            return (
              <button
                key={platform.id}
                onClick={() => toggle(platform)}
                className={`rounded-2xl border p-4 text-left transition ${
                  isSelected
                    ? "border-sky-400 bg-sky-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
                aria-pressed={isSelected}
                aria-label={`${platform.platform} ${platform.name}, ${platform.width}×${platform.height}`}
              >
                <div className="font-semibold text-slate-900">{platform.platform}</div>
                <div className="mt-1 text-sm text-slate-600">{platform.name}</div>
                <p className="mt-2 text-sm text-slate-500">
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