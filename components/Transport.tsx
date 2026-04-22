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
      {/* Row 1: name + playback controls */}
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-[var(--accent)] font-bold text-sm tracking-widest mr-1">
          SUMMIT<span className="text-white">.mpc</span>
        </span>

        <button
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold transition-colors shrink-0 ${
            isPlaying ? "bg-[var(--red)] text-white" : "bg-[var(--green)] text-black"
          }`}
        >
          {isPlaying ? "■" : "▶"}
        </button>

        <div className="flex items-center gap-1">
          <button onClick={() => setBpm(Math.max(40, bpm - 1))} className="w-6 h-6 rounded bg-[var(--surface2)] text-xs">−</button>
          <div className="text-center w-10">
            <div className="text-white font-bold text-sm leading-none tabular-nums">{bpm}</div>
            <div className="text-[9px] text-gray-500">BPM</div>
          </div>
          <button onClick={() => setBpm(Math.min(300, bpm + 1))} className="w-6 h-6 rounded bg-[var(--surface2)] text-xs">+</button>
        </div>

        <div className="flex-1 flex items-center gap-2">
          <span className="text-[9px] text-gray-500 shrink-0">VOL</span>
          <input
            type="range" min={0} max={1} step={0.01}
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="flex-1 accent-[var(--accent)] h-1"
          />
        </div>

        <button onClick={onProjectsOpen} className="w-8 h-8 flex items-center justify-center text-gray-400 text-lg" title="Projects">
          💾
        </button>
      </div>

      {/* Row 2: loop engine */}
      <div className="flex items-center gap-2 px-3 pb-2">
        {/* Bar count */}
        <div className="flex rounded overflow-hidden border border-[var(--border)] shrink-0">
          {BAR_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => setLoopBars(n)}
              className={`px-2 py-1 text-[10px] font-bold transition-colors ${
                loopBars === n
                  ? "bg-[var(--accent2)] text-white"
                  : "bg-[var(--surface2)] text-gray-500"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-[9px] text-gray-600 shrink-0">bars</span>

        {/* Metronome */}
        <button
          onClick={() => setMetronomeActive(!metronomeActive)}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 transition-colors border ${
            metronomeActive
              ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]"
              : "bg-[var(--surface2)] border-[var(--border)] text-gray-600"
          }`}
          title="Metronome"
        >
          🎵
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

        {/* Record button */}
        <button
          onPointerDown={() => loopRecord(mode === "recorder" ? "mic" : "output")}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 transition-colors border-2 ${
            isLoopRecording
              ? "bg-[var(--red)] border-[var(--red)] text-white animate-pulse"
              : "bg-[var(--surface2)] border-[var(--red)] text-[var(--red)]"
          }`}
          title={mode === "recorder" ? "Record mic" : "Record output"}
        >
          {isLoopRecording ? "■" : "●"}
        </button>
      </div>
    </div>
  );
}
