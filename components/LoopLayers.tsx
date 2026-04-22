"use client";

import { useAudio } from "@/context/AudioContext";
import { useState, useRef } from "react";

function formatDur(s: number) {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}` : `${s.toFixed(1)}s`;
}

export default function LoopLayers() {
  const { loopLayers, deleteLoopLayer, toggleMuteLayer, isLoopRecording, loopRecord, loopBars, isPlaying, togglePlay } = useAudio();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const previewLayer = (id: string, url: string) => {
    audioRefs.current.forEach(a => { a.pause(); a.currentTime = 0; });
    setPlayingId(null);
    if (playingId === id) return;
    const a = new Audio(url);
    audioRefs.current.set(id, a);
    a.play();
    setPlayingId(id);
    a.onended = () => setPlayingId(null);
  };

  const stopPreview = (id: string) => {
    audioRefs.current.get(id)?.pause();
    setPlayingId(null);
  };

  const exportLayer = (layer: { url: string; createdAt: number }) => {
    const a = document.createElement("a");
    a.href = layer.url;
    a.download = `summit-layer-${new Date(layer.createdAt).toISOString().slice(0, 19)}.webm`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Status / hint */}
      <div className="flex items-center justify-between shrink-0">
        <div className="text-[10px] text-gray-500">
          {isLoopRecording
            ? <span className="text-[var(--red)] animate-pulse">● RECORDING — {loopBars} bars</span>
            : isPlaying
            ? `Loop playing · ${loopLayers.length} layer${loopLayers.length !== 1 ? "s" : ""}`
            : "Hit ▶ to start loop · ● to record a layer"
          }
        </div>
        <button
          onClick={isPlaying ? togglePlay : togglePlay}
          className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${
            isPlaying
              ? "bg-[var(--red)]/20 border-[var(--red)] text-[var(--red)]"
              : "bg-[var(--green)]/20 border-[var(--green)] text-[var(--green)]"
          }`}
        >
          {isPlaying ? "■ STOP" : "▶ PLAY"}
        </button>
      </div>

      {/* Quick record shortcut */}
      <button
        onPointerDown={() => loopRecord("mic")}
        className={`w-full py-3 rounded-xl text-sm font-bold border-2 transition-all ${
          isLoopRecording
            ? "bg-[var(--red)] border-[var(--red)] text-white animate-pulse"
            : "bg-[var(--surface2)] border-[var(--red)] text-[var(--red)]"
        }`}
      >
        {isLoopRecording ? "■  STOP RECORDING" : "●  RECORD NEW LAYER"}
      </button>

      {/* Layers list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {loopLayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
            <div className="text-3xl opacity-20">🎙</div>
            <p className="text-xs text-gray-600">No layers yet</p>
            <p className="text-[10px] text-gray-700">Start the loop, then record a layer<br />from here or the ● button above</p>
          </div>
        ) : (
          [...loopLayers].reverse().map((layer, i) => (
            <div
              key={layer.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 border transition-colors ${
                layer.muted
                  ? "bg-[var(--surface)] border-[var(--border)] opacity-50"
                  : "bg-[var(--surface2)] border-[var(--border)]"
              }`}
            >
              {/* Mute */}
              <button
                onClick={() => toggleMuteLayer(layer.id)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 border transition-colors ${
                  layer.muted
                    ? "bg-[var(--surface)] border-[var(--border)] text-gray-600"
                    : "bg-[var(--accent2)]/20 border-[var(--accent2)] text-[var(--accent2)]"
                }`}
                title={layer.muted ? "Unmute" : "Mute"}
              >
                {layer.muted ? "🔇" : "🔊"}
              </button>

              {/* Preview */}
              <button
                onClick={() => playingId === layer.id ? stopPreview(layer.id) : previewLayer(layer.id, layer.url)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  playingId === layer.id ? "bg-[var(--red)] text-white" : "bg-[var(--surface)] border border-[var(--border)] text-gray-400"
                }`}
              >
                {playingId === layer.id ? "■" : "▶"}
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold">LAYER {loopLayers.length - i}</div>
                <div className="text-[10px] text-gray-500">{layer.bars} bars · {formatDur(layer.duration)}</div>
              </div>

              {/* Export */}
              <button onClick={() => exportLayer(layer)} className="text-[10px] text-gray-500 px-2 py-1 rounded border border-[var(--border)] shrink-0">
                EXPORT
              </button>

              {/* Delete */}
              <button onClick={() => deleteLoopLayer(layer.id)} className="text-[var(--red)] text-sm shrink-0">✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
