import { useId, useState } from "react";
import { KB, MB, formatBytes } from "../lib/fileSize";

type SizeUnit = "KB" | "MB";

const UNIT_BYTES: Record<SizeUnit, number> = { KB, MB };

interface Props {
  initialBytes: number;
  minBytes: number;
  maxBytes: number;
  /** Receives the chosen size in bytes, or null while the entry is empty or out of range. */
  onChange: (bytes: number | null) => void;
}

function toBytes(text: string, unit: SizeUnit): number | null {
  const value = Number(text.trim().replace(",", "."));
  if (text.trim() === "" || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value * UNIT_BYTES[unit]);
}

function trimNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** A free-form file-size limit: a number plus a KB/MB unit. */
export default function SizeTargetInput({ initialBytes, minBytes, maxBytes, onChange }: Props) {
  const inputId = useId();
  const hintId = useId();
  const [unit, setUnit] = useState<SizeUnit>(initialBytes >= MB ? "MB" : "KB");
  const [text, setText] = useState(() => trimNumber(initialBytes / UNIT_BYTES[initialBytes >= MB ? "MB" : "KB"]));

  const bytes = toBytes(text, unit);
  const isValid = bytes !== null && bytes >= minBytes && bytes <= maxBytes;

  function update(nextText: string, nextUnit: SizeUnit) {
    setText(nextText);
    setUnit(nextUnit);
    const nextBytes = toBytes(nextText, nextUnit);
    onChange(nextBytes !== null && nextBytes >= minBytes && nextBytes <= maxBytes ? nextBytes : null);
  }

  return (
    <div className="mt-2">
      <label htmlFor={inputId} className="text-sm font-medium text-[#fff5ee]">Maximum file size</label>
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(event) => update(event.target.value, unit)}
          aria-invalid={!isValid}
          aria-describedby={hintId}
          className="min-w-0 flex-1 border border-[#ff7448]/30 bg-[#211814] px-3 py-2 text-sm text-[#fff5ee] placeholder:text-[#8a6d63] focus-visible:border-[#ff7448] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] aria-invalid:border-[#ffb39d]"
          placeholder="e.g. 8"
        />
        <div className="flex" role="group" aria-label="Size unit">
          {(["KB", "MB"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={unit === option}
              // The typed number is kept and reinterpreted: people type "300" and then pick KB,
              // so converting it (to 307200 KB) would undo what they just entered.
              onClick={() => update(text, option)}
              className="border border-[#ff7448]/30 bg-[#211814] px-3 py-2 text-xs font-semibold text-[#e8bbae] transition first:border-r-0 hover:border-[#ff7448]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] aria-pressed:border-[#ff7448] aria-pressed:bg-[#2b1913] aria-pressed:text-[#fff5ee]"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <p id={hintId} className={`mt-1 text-xs ${isValid ? "text-[#aeb2a5]" : "text-[#ffb39d]"}`}>
        {isValid
          ? `Output will be ${formatBytes(bytes)} or smaller.`
          : `Enter a size between ${formatBytes(minBytes)} and ${formatBytes(maxBytes)}.`}
      </p>
    </div>
  );
}
