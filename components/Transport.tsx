"use client";

import { useAudio } from "@/context/AudioContext";

export default function Transport() {
  const { bpm, setBpm, isPlaying, togglePlay, masterVolume, setMasterVolume } = useAudio();

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
      {/* App name */}
      <span className="text-[var(--accent)] font-bold text-sm tracking-widest mr-2">
        SUMMIT<span className="text-white">.mpc</span>
      </span>

      {/* Play/Stop */}
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${
          isPlaying
            ? "bg-[var(--red)] text-white"
            : "bg-[var(--green)] text-black"
        }`}
      >
        {isPlaying ? "■" : "▶"}
      </button>

      {/* BPM */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setBpm(Math.max(40, bpm - 1))}
          className="w-6 h-6 rounded bg-[var(--surface2)] text-xs"
        >−</button>
        <div className="text-center">
          <div className="text-white font-bold text-sm leading-none">{bpm}</div>
          <div className="text-[10px] text-gray-500">BPM</div>
        </div>
        <button
          onClick={() => setBpm(Math.min(300, bpm + 1))}
          className="w-6 h-6 rounded bg-[var(--surface2)] text-xs"
        >+</button>
      </div>

      {/* Master vol */}
      <div className="flex-1 flex items-center gap-2 ml-2">
        <span className="text-[10px] text-gray-500 shrink-0">VOL</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
          className="flex-1 accent-[var(--accent)] h-1"
        />
      </div>
    </div>
  );
}
