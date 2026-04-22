"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import { SampleSlice } from "@/lib/types";
import { useAudio } from "@/context/AudioContext";
import * as Tone from "tone";

export default function SampleChopper() {
  const { startAudio, isStarted } = useAudio();
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [slices, setSlices] = useState<SampleSlice[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#3b3b3b",
      progressColor: "var(--accent)",
      cursorColor: "#fff",
      height: 100,
      barWidth: 2,
      barGap: 1,
      interact: false,
    });
    wsRef.current = ws;
    ws.on("ready", () => setDuration(ws.getDuration()));
    return () => ws.destroy();
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      setAudioFile(file);
      setSlices([]);
      setSelStart(null);
      setSelEnd(null);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const url = URL.createObjectURL(file);
      audioUrlRef.current = url;
      wsRef.current?.load(url);
    },
    []
  );

  const getTimeFromX = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    const t = getTimeFromX(e);
    setSelStart(t);
    setSelEnd(t);
    setIsSelecting(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSelecting || !duration) return;
    setSelEnd(getTimeFromX(e));
  };

  const handlePointerUp = () => setIsSelecting(false);

  const addSlice = () => {
    if (selStart === null || selEnd === null) return;
    const start = Math.min(selStart, selEnd);
    const end = Math.max(selStart, selEnd);
    if (end - start < 0.05) return;
    const id = crypto.randomUUID();
    setSlices((prev) => [
      ...prev,
      { id, start, end, label: `SLICE ${prev.length + 1}` },
    ]);
    setSelStart(null);
    setSelEnd(null);
  };

  const playSlice = async (slice: SampleSlice) => {
    if (!audioUrlRef.current) return;
    if (!isStarted) await startAudio();
    const player = new Tone.Player(audioUrlRef.current);
    await player.load(audioUrlRef.current);
    player.toDestination();
    const offset = slice.start;
    const dur = slice.end - slice.start;
    player.start(Tone.now(), offset, dur);
    setTimeout(() => player.dispose(), dur * 1000 + 500);
  };

  const autoSlice = () => {
    if (!duration) return;
    const count = 8;
    const stepSize = duration / count;
    const newSlices: SampleSlice[] = Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(),
      start: i * stepSize,
      end: (i + 1) * stepSize,
      label: `SLICE ${i + 1}`,
    }));
    setSlices(newSlices);
  };

  const selLeft = selStart !== null && duration ? `${(Math.min(selStart, selEnd ?? selStart) / duration) * 100}%` : null;
  const selWidth = selStart !== null && selEnd !== null && duration
    ? `${(Math.abs(selEnd - selStart) / duration) * 100}%`
    : null;

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {!audioFile ? (
        <div
          className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)] rounded-xl gap-3"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="text-4xl">🎵</span>
          <p className="text-sm text-gray-400">Tap to load a sample</p>
        </div>
      ) : (
        <>
          <div
            className="relative rounded-lg overflow-hidden bg-[var(--surface2)] border border-[var(--border)]"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div ref={containerRef} className="w-full" />
            {selLeft && selWidth && (
              <div
                className="absolute top-0 h-full bg-[var(--accent)]/30 border-x border-[var(--accent)] pointer-events-none"
                style={{ left: selLeft, width: selWidth }}
              />
            )}
            {slices.map((s) => (
              <div
                key={s.id}
                className="absolute top-0 h-full border-l-2 border-[var(--accent2)] pointer-events-none"
                style={{ left: `${(s.start / duration) * 100}%` }}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={addSlice}
              disabled={selStart === null || selEnd === null}
              className="flex-1 py-2 text-xs rounded-lg bg-[var(--accent)] text-black font-bold disabled:opacity-30"
            >
              + ADD SLICE
            </button>
            <button
              onClick={autoSlice}
              className="flex-1 py-2 text-xs rounded-lg bg-[var(--surface2)] border border-[var(--border)]"
            >
              AUTO SLICE (8)
            </button>
            <button
              onClick={() => setSlices([])}
              className="py-2 px-3 text-xs rounded-lg bg-[var(--surface2)] border border-[var(--border)] text-[var(--red)]"
            >
              CLR
            </button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-1">
            {slices.length === 0 && (
              <p className="text-xs text-gray-600 text-center mt-4">
                Drag on waveform to select, then ADD SLICE
              </p>
            )}
            {slices.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 bg-[var(--surface2)] rounded-lg px-3 py-2"
              >
                <button
                  onClick={() => playSlice(s)}
                  className="w-7 h-7 rounded-full bg-[var(--accent2)] text-white text-xs shrink-0"
                >
                  ▶
                </button>
                <span className="text-xs flex-1">{s.label}</span>
                <span className="text-[10px] text-gray-500">
                  {s.start.toFixed(2)}s – {s.end.toFixed(2)}s
                </span>
                <button
                  onClick={() => setSlices((prev) => prev.filter((x) => x.id !== s.id))}
                  className="text-gray-600 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <button
        onClick={() => fileInputRef.current?.click()}
        className="py-2 text-xs text-gray-500 border border-[var(--border)] rounded-lg"
      >
        {audioFile ? `↺ Replace: ${audioFile.name}` : "Load Sample"}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
