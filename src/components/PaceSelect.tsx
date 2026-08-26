"use client";

import {
  PACE_MINUTE_MAX,
  PACE_MINUTE_MIN,
  PACE_SECOND_OPTIONS,
  combinePace,
  splitPace,
} from "@/lib/format";

const selectClassName =
  "rounded-md border border-emerald-800/60 bg-[#0c1812] px-2 py-2 text-sm text-emerald-50";

type PaceSelectProps = {
  label: string;
  value: number;
  onChange: (secondsPerKm: number) => void;
};

export function PaceSelect({ label, value, onChange }: PaceSelectProps) {
  const { minutes, seconds } = splitPace(value);
  const secondOptions =
    minutes >= PACE_MINUTE_MAX
      ? ([0] as const)
      : PACE_SECOND_OPTIONS;

  function setMinutes(nextMin: number) {
    const nextSec =
      nextMin >= PACE_MINUTE_MAX
        ? 0
        : (PACE_SECOND_OPTIONS as readonly number[]).includes(seconds)
          ? seconds
          : 0;
    onChange(combinePace(nextMin, nextSec));
  }

  function setSeconds(nextSec: number) {
    onChange(combinePace(minutes, nextSec));
  }

  return (
    <div className="text-sm text-emerald-100/80">
      <p>{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <select
          aria-label={`${label} 分`}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className={`min-w-0 flex-1 ${selectClassName}`}
        >
          {Array.from(
            { length: PACE_MINUTE_MAX - PACE_MINUTE_MIN + 1 },
            (_, i) => PACE_MINUTE_MIN + i,
          ).map((m) => (
            <option key={m} value={m}>
              {m} 分
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} 秒`}
          value={seconds}
          onChange={(e) => setSeconds(Number(e.target.value))}
          className={`min-w-0 flex-1 ${selectClassName}`}
        >
          {secondOptions.map((s) => (
            <option key={s} value={s}>
              {s.toString().padStart(2, "0")} 秒
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
