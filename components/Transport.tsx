"use client";

import { useAudio } from "@/context/AudioContext";
import { PadMode } from "@/lib/types";

interface Props { onProjectsOpen: () => void; mode: PadMode; }

const BAR_OPTIONS = [1, 2, 4, 8] as const;

export default function Transport({ onProjectsOpen, mode }: Props) {
  const {
    bpm, setBpm, isPlaying, togglePlay, masterVolume, setMasterVolume,
    loopBars, setLoopBars, metronomeActive, setMetronomeActive,
    isLoopRecording, loopRecord, loopPosition,
  } = useAudio();

  return (
    <div className="flex flex-col border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
      {/* Row 1: playback + BPM + volume */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        {/* Play/stop */}
        <button
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shrink-0 transition-colors ${
            isPlaying ? "bg-[var(--red)] text-white" : "bg-[var(--green)] text-black"
          }`}
        >
          {isPlaying ? "■" : "▶"}
        </button>

        {/* BPM */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setBpm(Math.max(40, bpm - 1))} className="w-6 h-6 rounded bg-[var(--surface2)] text-xs leading-none">−</button>
          <div className="text-center w-9">
            <div className="text-white font-bold text-sm leading-none tabular-nums">{bpm}</div>
            <div className="text-[9px] text-gray-500 leading-none mt-0.5">BPM</div>
          </div>
          <button onClick={() => setBpm(Math.min(300, bpm + 1))} className="w-6 h-6 rounded bg-[var(--surface2)] text-xs leading-none">+</button>
        </div>

        {/* App name */}
        <span className="text-[var(--accent)] font-bold text-xs tracking-widest shrink-0">
          SUMMIT<span className="text-white">.mpc</span>
        </span>

        {/* Vol slider — takes remaining space */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] text-gray-600 shrink-0">VOL</span>
          <input
            type="range" min={0} max={1} step={0.01}
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="flex-1 accent-[var(--accent)] h-1 min-w-0"
          />
        </div>
      </div>

      {/* Row 2: loop engine */}
      <div className="flex items-center gap-1.5 px-3 pb-2">
        {/* Bar count */}
        <div className="flex rounded overflow-hidden border border-[var(--border)] shrink-0">
          {BAR_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => setLoopBars(n)}
              className={`w-7 py-1 text-[10px] font-bold transition-colors ${
                loopBars === n ? "bg-[var(--accent2)] text-white" : "bg-[var(--surface2)] text-gray-500"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-[9px] text-gray-600 shrink-0">bar</span>

        {/* Metronome */}
        <button
          onClick={() => setMetronomeActive(!metronomeActive)}
          className={`w-7 h-7 rounded flex items-center justify-center text-sm shrink-0 border transition-colors ${
            metronomeActive
              ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]"
              : "bg-[var(--surface2)] border-[var(--border)] text-gray-600"
          }`}
          title="Metronome"
        >
          ♩
        </button>

        {/* Loop progress bar */}
        <div className="flex-1 h-2 rounded-full bg-[var(--surface2)] border border-[var(--border)] overflow-hidden">
          <div
            className="h-full rounded-full transition-none"
            style={{
              width: `${loopPosition * 100}%`,
              backgroundColor: isLoopRecording ? "var(--red)" : "var(--accent2)",
            }}
          />
        </div>

        {/* Record */}
        <button
          onPointerDown={() => loopRecord(mode === "recorder" ? "mic" : "output")}
          className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 border-2 transition-colors ${
            isLoopRecording
              ? "bg-[var(--red)] border-[var(--red)] text-white animate-pulse"
              : "bg-[var(--surface2)] border-[var(--red)] text-[var(--red)]"
          }`}
        >
          {isLoopRecording ? "■" : "●"}
        </button>

        {/* Projects */}
        <button
          onClick={onProjectsOpen}
          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-white transition-colors text-base shrink-0"
          title="Projects"
        >
          💾
        </button>
      </div>
    </div>
  );
}
