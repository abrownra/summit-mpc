"use client";

import { useAudio } from "@/context/AudioContext";

function dbLabel(v: number) {
  if (v <= 0.001) return "-∞";
  const db = 20 * Math.log10(v);
  return (db >= 0 ? "+" : "") + db.toFixed(1);
}

function VolumeRow({
  color, label, volume, muted,
  onVolume, onMute,
}: {
  color: string;
  label: string;
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onMute: () => void;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] ${muted ? "opacity-40" : ""}`}>
      {/* Color dot */}
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />

      {/* Name */}
      <span className="text-[10px] text-gray-400 w-14 truncate shrink-0">{label}</span>

      {/* Mute */}
      <button
        onClick={onMute}
        className={`w-7 h-6 rounded text-[9px] font-bold shrink-0 border transition-colors ${
          muted
            ? "bg-[var(--red)] border-[var(--red)] text-white"
            : "bg-[var(--surface2)] border-[var(--border)] text-gray-500"
        }`}
      >
        M
      </button>

      {/* Fader */}
      <input
        type="range" min={0} max={1} step={0.01}
        value={volume}
        onChange={e => onVolume(parseFloat(e.target.value))}
        className="flex-1 accent-[var(--accent)] h-1"
        style={{ touchAction: "none" }}
      />

      {/* dB readout */}
      <span className="text-[9px] text-gray-600 w-8 text-right tabular-nums shrink-0">
        {dbLabel(volume)}
      </span>
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
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--surface)] border-b-2 border-[var(--border)] shrink-0">
        <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-[var(--accent)]" />
        <span className="text-[10px] font-bold text-[var(--accent)] w-14 shrink-0">MASTER</span>
        <div className="w-7 h-6 shrink-0" /> {/* spacer for mute col */}
        <input
          type="range" min={0} max={1} step={0.01}
          value={masterVolume}
          onChange={e => setMasterVolume(parseFloat(e.target.value))}
          className="flex-1 accent-[var(--accent)] h-1"
          style={{ touchAction: "none" }}
        />
        <span className="text-[9px] text-[var(--accent)] w-8 text-right tabular-nums shrink-0">
          {dbLabel(masterVolume)}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Pads section */}
        <div className="px-3 pt-2 pb-1">
          <span className="text-[9px] text-gray-600 font-bold tracking-widest">PADS</span>
        </div>
        {pads.map(pad => (
          <div key={pad.id}>
            <VolumeRow
              color={pad.sampleUrl ? pad.color : "#444"}
              label={pad.label}
              volume={pad.volume}
              muted={mutedPads.has(pad.id)}
              onVolume={v => setPads(prev => prev.map(p => p.id === pad.id ? { ...p, volume: v } : p))}
              onMute={() => togglePadMute(pad.id)}
            />
            {/* Swing sub-row — only shown if non-zero or pad has a sample */}
            <div className="flex items-center gap-2 px-3 pb-1.5 -mt-1">
              <div className="w-2.5 shrink-0" />
              <span className="text-[8px] text-gray-700 w-14 shrink-0">swing</span>
              <div className="w-7 shrink-0" />
              <input
                type="range" min={0} max={1} step={0.01}
                value={pad.swing ?? 0}
                onChange={e => setPads(prev => prev.map(p => p.id === pad.id ? { ...p, swing: parseFloat(e.target.value) } : p))}
                className="flex-1 h-0.5 accent-[var(--accent2)]"
                style={{ touchAction: "none" }}
              />
              <span className="text-[8px] text-gray-700 w-8 text-right tabular-nums shrink-0">
                {Math.round((pad.swing ?? 0) * 100)}%
              </span>
            </div>
          </div>
        ))}

        {/* Loop layers section */}
        {loopLayers.length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1">
              <span className="text-[9px] text-gray-600 font-bold tracking-widest">LOOP LAYERS</span>
            </div>
            {[...loopLayers].reverse().map((layer, i) => (
              <VolumeRow
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
