"use client";

import { useAudio } from "@/context/AudioContext";
import { PadMode } from "@/lib/types";

interface Props { onProjectsOpen: () => void; mode: PadMode; }

const BAR_OPTIONS = [1, 2, 4, 8] as const;

export default function Transport({ onProjectsOpen, mode }: Props) {
  const {
    bpm, setBpm, isPlaying, togglePlay,
    loopBars, setLoopBars, metronomeActive, setMetronomeActive,
    isLoopRecording, loopRecord, loopPosition,
  } = useAudio();

  return (
    <div className="flex flex-col border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
      {/* Single compact row */}
      <div className="flex items-center gap-2 px-2 py-1.5">

        {/* Play/Stop */}
        <button
          onClick={togglePlay}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
            isPlaying ? "bg-[var(--red)] text-white" : "bg-[var(--green)] text-black"
          }`}
        >
          {isPlaying ? "■" : "▶"}
        </button>

        {/* BPM */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button onPointerDown={() => setBpm(Math.max(40, bpm - 1))} className="w-5 h-5 rounded bg-[var(--surface2)] text-[10px] leading-none">−</button>
          <div className="w-8 text-center">
            <div className="text-white font-bold text-xs leading-none tabular-nums">{bpm}</div>
            <div className="text-[8px] text-gray-600 leading-none">BPM</div>
          </div>
          <button onPointerDown={() => setBpm(Math.min(300, bpm + 1))} className="w-5 h-5 rounded bg-[var(--surface2)] text-[10px] leading-none">+</button>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-[var(--border)] shrink-0" />

        {/* Bar count */}
        <div className="flex rounded overflow-hidden border border-[var(--border)] shrink-0">
          {BAR_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => setLoopBars(n)}
              className={`w-6 h-6 text-[9px] font-bold transition-colors ${
                loopBars === n ? "bg-[var(--accent2)] text-white" : "bg-[var(--surface2)] text-gray-500"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-[8px] text-gray-600 shrink-0 -ml-1">bar</span>

        {/* Metronome */}
        <button
          onClick={() => setMetronomeActive(!metronomeActive)}
          className={`w-7 h-7 rounded flex items-center justify-center text-xs shrink-0 border transition-colors ${
            metronomeActive
              ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]"
              : "bg-[var(--surface2)] border-[var(--border)] text-gray-600"
          }`}
        >
          ♩
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Record */}
        <button
          onPointerDown={() => loopRecord(mode === "recorder" ? "mic" : "output")}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 border-2 transition-colors ${
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
          className="w-8 h-8 flex items-center justify-center text-gray-500 text-base shrink-0"
        >
          💾
        </button>
      </div>

      {/* Loop progress — thin strip, always visible */}
      <div className="h-1 w-full bg-[var(--surface2)]">
        <div
          className="h-full transition-none"
          style={{
            width: `${loopPosition * 100}%`,
            backgroundColor: isLoopRecording ? "var(--red)" : isPlaying ? "var(--accent2)" : "transparent",
          }}
        />
      </div>
    </div>
  );
}
