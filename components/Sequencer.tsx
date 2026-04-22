"use client";

import { useState } from "react";
import { useAudio } from "@/context/AudioContext";

const BANK_SIZE = 8;

export default function Sequencer() {
  const { pads, pattern, toggleStep, clearPattern, currentStep, stepCount, setStepCount, bounce, isPlaying, togglePlay } = useAudio();
  const [bank, setBank] = useState(0); // 0 = pads 0-7, 1 = pads 8-15
  const [bouncing, setBouncing] = useState(false);
  const [bounceBar, setBounceBar] = useState(4);

  const bankPads = pads.slice(bank * BANK_SIZE, bank * BANK_SIZE + BANK_SIZE);

  const handleBounce = async () => {
    setBouncing(true);
    try {
      const blob = await bounce(bounceBar);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `summit-bounce-${bounceBar}bars-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBouncing(false);
    }
  };

  // Fill active pads with a random kick/snare/hat pattern
  const randomize = () => {
    const loadedPads = pads.filter(p => p.sampleUrl).map(p => p.id);
    const allPads = loadedPads.length > 0 ? loadedPads : [0, 1, 2, 3];
    for (let padId = 0; padId < 16; padId++) {
      for (let step = 0; step < stepCount; step++) {
        const on = allPads.includes(padId) ? Math.random() > 0.65 : false;
        if (on !== pattern[padId][step]) toggleStep(padId, step);
      }
    }
  };

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Controls row */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {/* Bank select */}
        <div className="flex rounded overflow-hidden border border-[var(--border)]">
          {[0, 1].map(b => (
            <button key={b} onClick={() => setBank(b)}
              className={`px-3 py-1 text-xs font-bold transition-colors ${bank === b ? "bg-[var(--accent)] text-black" : "bg-[var(--surface2)] text-gray-400"}`}>
              {b === 0 ? "1–8" : "9–16"}
            </button>
          ))}
        </div>

        {/* Step count */}
        <div className="flex rounded overflow-hidden border border-[var(--border)]">
          {[8, 16].map(n => (
            <button key={n} onClick={() => setStepCount(n)}
              className={`px-3 py-1 text-xs font-bold transition-colors ${stepCount === n ? "bg-[var(--accent2)] text-white" : "bg-[var(--surface2)] text-gray-400"}`}>
              {n}
            </button>
          ))}
        </div>

        <button onClick={randomize} className="px-3 py-1 text-xs rounded bg-[var(--surface2)] border border-[var(--border)] text-gray-300">RND</button>
        <button onClick={clearPattern} className="px-3 py-1 text-xs rounded bg-[var(--surface2)] border border-[var(--border)] text-[var(--red)]">CLR</button>

        <button onClick={togglePlay}
          className={`ml-auto px-3 py-1 text-xs rounded font-bold ${isPlaying ? "bg-[var(--red)] text-white" : "bg-[var(--green)] text-black"}`}>
          {isPlaying ? "■ STOP" : "▶ PLAY"}
        </button>
      </div>

      {/* Step header */}
      <div className="flex shrink-0">
        <div className="w-12 shrink-0" />
        {Array.from({ length: stepCount }, (_, i) => (
          <div key={i}
            className={`flex-1 text-center text-[8px] pb-1 font-bold transition-colors ${
              currentStep === i ? "text-[var(--accent)]" : i % 4 === 0 ? "text-gray-500" : "text-gray-700"
            }`}>
            {i % 4 === 0 ? i / 4 + 1 : "·"}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {bankPads.map((pad) => (
          <div key={pad.id} className="flex items-center gap-1">
            {/* Pad label */}
            <div className="w-12 shrink-0 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pad.sampleUrl ? pad.color : "#333" }} />
              <span className="text-[9px] text-gray-400 truncate">{pad.label}</span>
            </div>
            {/* Steps */}
            {Array.from({ length: stepCount }, (_, step) => {
              const on = pattern[pad.id][step];
              const active = currentStep === step;
              return (
                <button
                  key={step}
                  onClick={() => toggleStep(pad.id, step)}
                  className={`flex-1 rounded-sm transition-all ${
                    step % 4 === 0 ? "mx-px" : ""
                  }`}
                  style={{
                    height: 32,
                    backgroundColor: on
                      ? active ? `${pad.color}ff` : `${pad.color}cc`
                      : active ? "#ffffff22" : step % 4 === 0 ? "#1e1e1e" : "#161616",
                    border: on ? `1px solid ${pad.color}` : "1px solid #2a2a2a",
                    boxShadow: on && active ? `0 0 6px ${pad.color}88` : "none",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Bounce */}
      <div className="flex items-center gap-2 shrink-0 border-t border-[var(--border)] pt-3">
        <span className="text-[10px] text-gray-500">BOUNCE</span>
        {[1, 2, 4, 8].map(b => (
          <button key={b} onClick={() => setBounceBar(b)}
            className={`w-7 h-7 text-xs rounded border transition-colors ${bounceBar === b ? "bg-[var(--accent)] border-[var(--accent)] text-black font-bold" : "bg-[var(--surface2)] border-[var(--border)] text-gray-400"}`}>
            {b}
          </button>
        ))}
        <span className="text-[10px] text-gray-600">bars</span>
        <button
          onClick={handleBounce}
          disabled={bouncing}
          className="ml-auto px-4 py-1.5 text-xs rounded-lg bg-[var(--accent2)] text-white font-bold disabled:opacity-40"
        >
          {bouncing ? "Recording..." : "EXPORT"}
        </button>
      </div>
    </div>
  );
}
