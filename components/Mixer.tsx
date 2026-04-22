"use client";

import { useRef } from "react";
import { useAudio } from "@/context/AudioContext";

function dbLabel(v: number) {
  if (v <= 0.001) return "-∞";
  const db = 20 * Math.log10(v);
  return (db >= 0 ? "+" : "") + db.toFixed(1);
}

// Custom pointer-captured slider — works reliably in scrollable containers on mobile
function Slider({
  value, onChange, color = "var(--accent)",
}: {
  value: number;
  onChange: (v: number) => void;
  color?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const update = (e: React.PointerEvent) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChange(Math.round(ratio * 100) / 100);
  };

  return (
    <div
      ref={trackRef}
      className="flex-1 flex items-center h-8 cursor-pointer select-none"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); update(e); }}
      onPointerMove={(e) => { if (e.buttons) update(e); }}
    >
      <div className="w-full h-1 rounded-full bg-[var(--surface2)] relative">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${value * 100}%`, backgroundColor: color }}
        />
        <div
          className="absolute top-1/2 w-3.5 h-3.5 rounded-full border-2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${value * 100}%`, backgroundColor: color, borderColor: color }}
        />
      </div>
    </div>
  );
}

function ChannelRow({
  color, label, volume, muted, swing,
  onVolume, onMute, onSwing,
}: {
  color: string; label: string;
  volume: number; muted: boolean; swing?: number;
  onVolume: (v: number) => void;
  onMute: () => void;
  onSwing?: (v: number) => void;
}) {
  return (
    <div className={`border-b border-[var(--border)] ${muted ? "opacity-40" : ""}`}>
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[10px] text-gray-400 w-14 truncate shrink-0">{label}</span>
        <button
          onPointerDown={onMute}
          className={`w-7 h-6 rounded text-[9px] font-bold shrink-0 border transition-colors ${
            muted ? "bg-[var(--red)] border-[var(--red)] text-white" : "bg-[var(--surface2)] border-[var(--border)] text-gray-500"
          }`}
        >M</button>
        <Slider value={volume} onChange={onVolume} color={color !== "#444" ? color : "var(--accent)"} />
        <span className="text-[9px] text-gray-600 w-8 text-right tabular-nums shrink-0">{dbLabel(volume)}</span>
      </div>
      {onSwing !== undefined && (
        <div className="flex items-center gap-2 px-3 pb-1.5">
          <div className="w-2.5 shrink-0" />
          <span className="text-[8px] text-gray-700 w-14 shrink-0">swing</span>
          <div className="w-7 shrink-0" />
          <Slider value={swing ?? 0} onChange={onSwing} color="var(--accent2)" />
          <span className="text-[8px] text-gray-700 w-8 text-right tabular-nums shrink-0">
            {Math.round((swing ?? 0) * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}

export default function Mixer() {
  const {
    pads, setPads, mutedPads, togglePadMute,
    loopLayers, toggleMuteLayer, setLayerVolume,
    masterVolume, setMasterVolume,
  } = useAudio();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Master */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)] border-b-2 border-[var(--border)] shrink-0">
        <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-[var(--accent)]" />
        <span className="text-[10px] font-bold text-[var(--accent)] w-14 shrink-0">MASTER</span>
        <div className="w-7 shrink-0" />
        <Slider value={masterVolume} onChange={setMasterVolume} color="var(--accent)" />
        <span className="text-[9px] text-[var(--accent)] w-8 text-right tabular-nums shrink-0">{dbLabel(masterVolume)}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-1">
          <span className="text-[9px] text-gray-600 font-bold tracking-widest">PADS</span>
        </div>
        {pads.map(pad => (
          <ChannelRow
            key={pad.id}
            color={pad.sampleUrl ? pad.color : "#444"}
            label={pad.label}
            volume={pad.volume}
            muted={mutedPads.has(pad.id)}
            swing={pad.swing ?? 0}
            onVolume={v => setPads(prev => prev.map(p => p.id === pad.id ? { ...p, volume: v } : p))}
            onMute={() => togglePadMute(pad.id)}
            onSwing={v => setPads(prev => prev.map(p => p.id === pad.id ? { ...p, swing: v } : p))}
          />
        ))}

        {loopLayers.length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1">
              <span className="text-[9px] text-gray-600 font-bold tracking-widest">LOOP LAYERS</span>
            </div>
            {[...loopLayers].reverse().map((layer, i) => (
              <ChannelRow
                key={layer.id}
                color="var(--accent2)"
                label={`LAYER ${loopLayers.length - i}`}
                volume={layer.volume}
                muted={layer.muted}
                onVolume={v => setLayerVolume(layer.id, v)}
                onMute={() => toggleMuteLayer(layer.id)}
              />
            ))}
          </>
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}
