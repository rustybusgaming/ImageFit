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
    <div className="border border-white/10 bg-[#151714] p-5 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.9)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a6aa9d]">Destination presets</p>
          <h2 className="mt-1 text-xl font-semibold text-[#f4f4ed]">Social platform sizes</h2>
        </div>
        <div className="border border-[#d7ff47]/35 bg-[#20251a] px-3 py-1 font-mono text-xs font-semibold text-[#d7ff47]">
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
        className="mt-4 w-full border border-white/10 bg-[#1b1e1a] px-4 py-3 text-sm text-[#f4f4ed] outline-none transition placeholder:text-[#72766d] focus:border-[#d7ff47]"
        aria-label="Search for social media platforms"
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2" role="group" aria-label="Platform selection">
        {filtered.length === 0 ? (
          <p className="col-span-2 border border-dashed border-white/20 py-8 text-center text-sm text-[#9ea296]">
            No platforms found
          </p>
        ) : (
          filtered.map((platform) => {
            const isSelected = selected.some((item) => item.id === platform.id);
            return (
              <button
                key={platform.id}
                onClick={() => toggle(platform)}
                className={`border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151714] ${
                  isSelected
                    ? "border-[#d7ff47] bg-[#242a1c] shadow-[3px_3px_0_#d7ff47]"
                    : "border-white/10 bg-[#1b1e1a] hover:border-white/30 hover:bg-[#20231e]"
                }`}
                aria-pressed={isSelected}
                aria-label={`${platform.platform} ${platform.name}, ${platform.width}×${platform.height}`}
              >
                <div className="font-semibold text-[#f0f1e9]">{platform.platform}</div>
                <div className="mt-1 text-sm text-[#b7baaf]">{platform.name}</div>
                <p className="mt-2 font-mono text-xs text-[#8f9389]">
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