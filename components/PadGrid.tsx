"use client";

import { useRef, useState, useCallback } from "react";
import { useAudio } from "@/context/AudioContext";
import SampleBrowser from "@/components/SampleBrowser";

export default function PadGrid() {
  const { pads, triggerPad, loadSampleToPad, loadSampleUrlToPad, setPads, beatMatchPad, beatMatchInfo, bpm } = useAudio();
  const [activePads, setActivePads] = useState<Set<number>>(new Set());
  const [editingPad, setEditingPad] = useState<number | null>(null);
  const [browserForPad, setBrowserForPad] = useState<number | null>(null);
  const [matchingPad, setMatchingPad] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingPadRef = useRef<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPad = useRef<number | null>(null);
  const activePointerCount = useRef(0);

  const handlePadDown = useCallback(
    (padId: number) => {
      activePointerCount.current += 1;
      // Cancel any pending long-press the moment a second finger lands
      if (activePointerCount.current > 1) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        longPressPad.current = null;
      }
      setActivePads(prev => new Set(prev).add(padId));
      triggerPad(padId);
      if (activePointerCount.current === 1) {
        longPressPad.current = padId;
        longPressTimer.current = setTimeout(() => {
          setEditingPad(padId);
          longPressPad.current = null;
        }, 600);
      }
    },
    [triggerPad]
  );

  const handlePadUp = useCallback((padId: number) => {
    activePointerCount.current = Math.max(0, activePointerCount.current - 1);
    if (longPressTimer.current && longPressPad.current === padId) {
      clearTimeout(longPressTimer.current);
      longPressPad.current = null;
    }
    setActivePads(prev => { const n = new Set(prev); n.delete(padId); return n; });
  }, []);

  const openFilePicker = (padId: number) => {
    pendingPadRef.current = padId;
    fileInputRef.current?.click();
    setEditingPad(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingPadRef.current !== null) {
      await loadSampleToPad(pendingPadRef.current, file);
    }
    e.target.value = "";
  };

  const handleBrowserSelect = async (url: string, name: string) => {
    if (browserForPad !== null) {
      await loadSampleUrlToPad(browserForPad, url, name);
    }
    setBrowserForPad(null);
    setEditingPad(null);
  };

  const editPad = editingPad !== null ? pads.find((p) => p.id === editingPad) : null;

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="grid grid-cols-4 gap-2 flex-1" style={{ touchAction: "none" }}>
        {pads.map((pad) => {
          const isActive = activePads.has(pad.id);
          return (
            <div
              key={pad.id}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handlePadDown(pad.id); }}
              onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); handlePadUp(pad.id); }}
              onPointerCancel={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); handlePadUp(pad.id); }}
              onContextMenu={(e) => e.preventDefault()}
              className="rounded-lg flex flex-col items-center justify-center gap-1 select-none cursor-pointer"
              style={{
                touchAction: "none",
                backgroundColor: isActive
                  ? pad.sampleUrl ? `${pad.color}55` : "#2a2a2a"
                  : pad.sampleUrl ? `${pad.color}33` : "var(--surface2)",
                border: `2px solid ${pad.sampleUrl ? pad.color : "var(--border)"}`,
                boxShadow: isActive ? `0 0 16px ${pad.color}99` : "none",
                transform: isActive ? "scale(0.95)" : "scale(1)",
              }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: pad.sampleUrl ? pad.color : "#333" }}
              />
              <span className="text-[9px] text-gray-400 text-center px-1 leading-tight line-clamp-2">
                {pad.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-600 text-center">
        TAP to play · HOLD to edit pad
      </p>

      {/* Pad edit overlay */}
      {editingPad !== null && editPad && (
        <div className="absolute inset-0 bg-black/80 flex items-end z-50">
          <div className="w-full bg-[var(--surface)] rounded-t-2xl p-5 pb-8">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-sm" style={{ color: editPad.color }}>
                {editPad.label}
              </span>
              <button onClick={() => setEditingPad(null)} className="text-gray-400 text-lg">✕</button>
            </div>

            {/* Load options */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => openFilePicker(editPad.id)}
                className="flex-1 py-3 rounded-lg bg-[var(--surface2)] border border-[var(--border)] text-sm"
              >
                From Device
              </button>
              <button
                onClick={() => { setBrowserForPad(editPad.id); setEditingPad(null); }}
                className="flex-1 py-3 rounded-lg bg-[var(--accent)]/20 border border-[var(--accent)] text-sm text-[var(--accent)] font-bold"
              >
                Browse Sounds
              </button>
            </div>

            {/* Beat match */}
            {editPad.sampleUrl && (() => {
              const info = beatMatchInfo.get(editPad.id);
              return (
                <button
                  disabled={matchingPad === editPad.id}
                  onClick={async () => {
                    setMatchingPad(editPad.id);
                    await beatMatchPad(editPad.id);
                    setMatchingPad(null);
                  }}
                  className={`w-full py-2 rounded-lg text-sm font-bold mb-3 border transition-colors ${
                    info?.active
                      ? "bg-[var(--green)]/20 border-[var(--green)] text-[var(--green)]"
                      : "bg-[var(--surface2)] border-[var(--border)] text-gray-300"
                  } disabled:opacity-40`}
                >
                  {matchingPad === editPad.id
                    ? "Detecting BPM..."
                    : info?.active
                    ? `MATCHED ${info.detectedBpm} → ${bpm} BPM (${info.rate.toFixed(2)}x)`
                    : "AUTO MATCH BPM"}
                </button>
              );
            })()}

            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-gray-400 w-12">Pitch</span>
              <input
                type="range" min={-12} max={12} step={1}
                value={editPad.pitch}
                onChange={(e) =>
                  setPads((prev) =>
                    prev.map((p) =>
                      p.id === editPad.id ? { ...p, pitch: parseInt(e.target.value) } : p
                    )
                  )
                }
                className="flex-1 accent-[var(--accent)]"
              />
              <span className="text-xs text-white w-6 text-right">{editPad.pitch > 0 ? `+${editPad.pitch}` : editPad.pitch}</span>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-gray-400 w-12">Volume</span>
              <input
                type="range" min={0} max={1} step={0.01}
                value={editPad.volume}
                onChange={(e) =>
                  setPads((prev) =>
                    prev.map((p) =>
                      p.id === editPad.id ? { ...p, volume: parseFloat(e.target.value) } : p
                    )
                  )
                }
                className="flex-1 accent-[var(--accent)]"
              />
              <span className="text-xs text-white w-6 text-right">{Math.round(editPad.volume * 100)}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-12">Reverse</span>
              <button
                onClick={() =>
                  setPads((prev) =>
                    prev.map((p) =>
                      p.id === editPad.id ? { ...p, reverse: !p.reverse } : p
                    )
                  )
                }
                className={`px-4 py-1 rounded-full text-xs border transition-colors ${
                  editPad.reverse
                    ? "bg-[var(--accent)] border-[var(--accent)] text-black"
                    : "border-[var(--border)] text-gray-400"
                }`}
              >
                {editPad.reverse ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sample browser for pad */}
      {browserForPad !== null && (
        <SampleBrowser
          mode="oneshot"
          title={`LOAD TO PAD ${browserForPad + 1}`}
          onSelect={handleBrowserSelect}
          onClose={() => setBrowserForPad(null)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
