"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import { SampleSlice } from "@/lib/types";
import { useAudio } from "@/context/AudioContext";
import SampleBrowser from "@/components/SampleBrowser";
import { detectBPM } from "@/lib/beatDetect";
import * as Tone from "tone";

export default function SampleChopper() {
  const { startAudio, isStarted, bpm: projectBpm } = useAudio();
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [slices, setSlices] = useState<SampleSlice[]>([]);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [duration, setDuration] = useState(0);
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [stretchRate, setStretchRate] = useState(1);
  const [isSelecting, setIsSelecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioUrlRef = useRef<string | null>(null);
  const hasAudio = !!audioName;

  // Always mount the WaveSurfer container — init once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#3b3b3b",
      progressColor: "#ff6b35",
      cursorColor: "#ffffff",
      height: 96,
      barWidth: 2,
      barGap: 1,
      interact: false,
    });
    wsRef.current = ws;
    ws.on("ready", () => setDuration(ws.getDuration()));
    return () => ws.destroy();
  }, []);

  const loadUrl = useCallback((url: string, name: string) => {
    setSlices([]);
    setSelStart(null);
    setSelEnd(null);
    setDetectedBpm(null);
    setStretchRate(1);
    setAudioName(name);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = url;
    wsRef.current?.load(url);
    setShowBrowser(false);
  }, []);

  const loadFile = useCallback((file: File) => {
    setSlices([]);
    setSelStart(null);
    setSelEnd(null);
    setDetectedBpm(null);
    setStretchRate(1);
    setAudioName(file.name);
    const url = URL.createObjectURL(file);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = url;
    wsRef.current?.load(url);
  }, []);

  const getTimeFromX = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
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
    setSlices((prev) => [...prev, { id: crypto.randomUUID(), start, end, label: `SLICE ${prev.length + 1}` }]);
    setSelStart(null);
    setSelEnd(null);
  };

  const autoSlice = () => {
    if (!duration) return;
    const step = duration / 8;
    setSlices(Array.from({ length: 8 }, (_, i) => ({
      id: crypto.randomUUID(), start: i * step, end: (i + 1) * step, label: `SLICE ${i + 1}`,
    })));
  };

  const playSlice = async (slice: SampleSlice) => {
    if (!audioUrlRef.current) return;
    if (!isStarted) await startAudio();
    const player = new Tone.Player();
    await player.load(audioUrlRef.current);
    player.playbackRate = stretchRate;
    const dur = (slice.end - slice.start) / stretchRate;
    if (stretchRate !== 1) {
      const shifter = new Tone.PitchShift({ pitch: -12 * Math.log2(stretchRate) });
      player.connect(shifter);
      shifter.toDestination();
      player.start(Tone.now(), slice.start, slice.end - slice.start);
      setTimeout(() => { player.dispose(); shifter.dispose(); }, dur * 1000 + 500);
    } else {
      player.toDestination();
      player.start(Tone.now(), slice.start, slice.end - slice.start);
      setTimeout(() => player.dispose(), dur * 1000 + 500);
    }
  };

  const handleMatchBpm = async () => {
    if (!audioUrlRef.current) return;
    setIsDetecting(true);
    try {
      const detected = await detectBPM(audioUrlRef.current);
      setDetectedBpm(detected);
      setStretchRate(projectBpm / detected);
    } finally {
      setIsDetecting(false);
    }
  };

  const selLeft = selStart !== null && duration
    ? `${(Math.min(selStart, selEnd ?? selStart) / duration) * 100}%` : null;
  const selWidth = selStart !== null && selEnd !== null && duration
    ? `${(Math.abs(selEnd - selStart) / duration) * 100}%` : null;

  return (
    <div className="flex flex-col h-full p-3 gap-3">

      {/* Empty state buttons — shown when no audio loaded */}
      {!hasAudio && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <button
            onClick={() => setShowBrowser(true)}
            className="w-full py-4 rounded-xl bg-[var(--accent)]/20 border-2 border-[var(--accent)] text-[var(--accent)] font-bold text-sm"
          >
            Browse Sounds
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 rounded-xl bg-[var(--surface2)] border-2 border-dashed border-[var(--border)] text-gray-400 text-sm"
          >
            Load from Device
          </button>
        </div>
      )}

      {/* Waveform — always in DOM so WaveSurfer can attach, hidden until audio loaded */}
      <div className={hasAudio ? "flex flex-col gap-3 flex-1 min-h-0" : "hidden"}>
        {/* Name + replace */}
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-[10px] text-gray-400 flex-1 truncate">{audioName}</p>
          <button onClick={() => setShowBrowser(true)} className="text-[10px] text-[var(--accent)] px-2 py-1 border border-[var(--accent)] rounded">Browse</button>
          <button onClick={() => fileInputRef.current?.click()} className="text-[10px] text-gray-500 px-2 py-1 border border-[var(--border)] rounded">Device</button>
        </div>

        {/* Waveform + selection overlay */}
        <div
          className="relative rounded-lg overflow-hidden bg-[var(--surface2)] border border-[var(--border)] shrink-0"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div ref={containerRef} className="w-full" />
          {selLeft && selWidth && (
            <div
              className="absolute top-0 h-full bg-[var(--accent)]/30 border-x-2 border-[var(--accent)] pointer-events-none"
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

        {/* Beat match */}
        <button
          onClick={handleMatchBpm}
          disabled={isDetecting}
          className={`shrink-0 w-full py-2 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 ${
            detectedBpm
              ? "bg-[var(--green)]/20 border-[var(--green)] text-[var(--green)]"
              : "bg-[var(--surface2)] border-[var(--border)] text-gray-300"
          }`}
        >
          {isDetecting ? "Detecting BPM..." : detectedBpm
            ? `MATCHED ${detectedBpm} → ${projectBpm} BPM (${stretchRate.toFixed(2)}x)`
            : "AUTO MATCH BPM"}
        </button>

        {/* Slice controls */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={addSlice}
            disabled={selStart === null || selEnd === null}
            className="flex-1 py-2 text-xs rounded-lg bg-[var(--accent)] text-black font-bold disabled:opacity-30"
          >
            + ADD SLICE
          </button>
          <button onClick={autoSlice} className="flex-1 py-2 text-xs rounded-lg bg-[var(--surface2)] border border-[var(--border)]">
            AUTO (8)
          </button>
          <button onClick={() => setSlices([])} className="py-2 px-3 text-xs rounded-lg bg-[var(--surface2)] border border-[var(--border)] text-[var(--red)]">
            CLR
          </button>
        </div>

        {/* Slice list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0">
          {slices.length === 0 && (
            <p className="text-xs text-gray-600 text-center mt-4">Drag on waveform to select, then ADD SLICE</p>
          )}
          {slices.map((s) => (
            <div key={s.id} className="flex items-center gap-2 bg-[var(--surface2)] rounded-lg px-3 py-2">
              <button onClick={() => playSlice(s)} className="w-7 h-7 rounded-full bg-[var(--accent2)] text-white text-xs shrink-0">▶</button>
              <span className="text-xs flex-1">{s.label}</span>
              <span className="text-[10px] text-gray-500">{s.start.toFixed(2)}s–{s.end.toFixed(2)}s</span>
              <button onClick={() => setSlices((prev) => prev.filter((x) => x.id !== s.id))} className="text-gray-600 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>

      {showBrowser && (
        <SampleBrowser
          mode="loop"
          title="LOAD TO CHOPPER"
          onSelect={loadUrl}
          onClose={() => setShowBrowser(false)}
        />
      )}

      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
      />
    </div>
  );
}
