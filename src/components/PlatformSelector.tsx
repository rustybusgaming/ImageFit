import { useState } from "react";
import { Plus } from "lucide-react";
import { platforms } from "../data/platforms";
import type { PlatformPreset } from "../data/platforms";

interface Props {
  onSelect: (platforms: PlatformPreset[]) => void;
}

export default function PlatformSelector({ onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PlatformPreset[]>([]);
  
  // Custom Preset Form State
  const [customW, setCustomW] = useState<number | "">("");
  const [customH, setCustomH] = useState<number | "">("");
  const [customPresets, setCustomPresets] = useState<PlatformPreset[]>([]);

  // Merge custom presets with the defaults so they appear in the grid
  const allPlatforms = [...customPresets, ...platforms];
  const filtered = allPlatforms.filter((item) =>
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

  function addCustomPreset(e: React.FormEvent) {
    e.preventDefault();
    if (!customW || !customH || customW < 1 || customH < 1) return;

    const customPreset: PlatformPreset = {
      id: `custom-${Date.now()}`,
      platform: "Custom",
      name: `${customW} × ${customH}`,
      width: Number(customW),
      height: Number(customH),
      format: "jpg",
    };

    setCustomPresets([customPreset, ...customPresets]);
    const updated = [...selected, customPreset];
    setSelected(updated);
    onSelect(updated);
    setCustomW("");
    setCustomH("");
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

      {/* CUSTOM PRESET BUILDER */}
      <form onSubmit={addCustomPreset} className="mt-5 flex items-end gap-3 border border-white/10 bg-[#1b1e1a] p-3">
        <div className="flex-1">
          <label htmlFor="custom-width" className="mb-1 block text-xs font-medium text-[#aeb2a5]">Width (px)</label>
          <input
            id="custom-width"
            type="number"
            min="1"
            placeholder="1080"
            value={customW}
            onChange={(e) => setCustomW(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full border border-white/10 bg-[#151714] px-3 py-2 text-sm text-[#f4f4ed] outline-none transition focus:border-[#d7ff47]"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="custom-height" className="mb-1 block text-xs font-medium text-[#aeb2a5]">Height (px)</label>
          <input
            id="custom-height"
            type="number"
            min="1"
            placeholder="1080"
            value={customH}
            onChange={(e) => setCustomH(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full border border-white/10 bg-[#151714] px-3 py-2 text-sm text-[#f4f4ed] outline-none transition focus:border-[#d7ff47]"
          />
        </div>
        <button
          type="submit"
          aria-disabled={!customW || !customH}
          title={!customW || !customH ? "Enter width and height to add a custom preset" : undefined}
          onClick={(e) => {
            if (!customW || !customH) {
              e.preventDefault();
            }
          }}
          className="inline-flex h-[38px] items-center gap-2 border border-[#d7ff47]/45 bg-[#20251a] px-4 text-sm font-semibold text-[#d7ff47] transition hover:border-[#d7ff47] hover:bg-[#292f21] aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

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
                aria-label={`${platform.platform} ${platform.name}, ${platform.width} ${platform.height}`}
              >
                <div className="font-semibold text-[#f0f1e9]">{platform.platform}</div>
                <div className="mt-1 text-sm text-[#b7baaf]">{platform.name}</div>
                <p className="mt-2 font-mono text-xs text-[#8f9389]">
                  {platform.width} × {platform.height}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}