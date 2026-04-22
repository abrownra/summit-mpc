"use client";

import { useState, useCallback } from "react";
import * as Tone from "tone";
import { KEYS, SCALE_INTERVALS, CHORD_TYPES, ChordType } from "@/lib/types";
import { useAudio } from "@/context/AudioContext";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function keyToMidi(key: string, octave: number): number {
  return NOTE_NAMES.indexOf(key) + octave * 12;
}

export default function ChordKeys() {
  const { startAudio, isStarted } = useAudio();
  const [rootKey, setRootKey] = useState("C");
  const [scale, setScale] = useState<keyof typeof SCALE_INTERVALS>("minor");
  const [chordType, setChordType] = useState<ChordType>("min");
  const [octave, setOctave] = useState(4);
  const [mode, setMode] = useState<"chords" | "notes">("chords");

  const synthRef = useCallback(() => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
    }).toDestination();
    return synth;
  }, []);

  const playNotes = useCallback(
    async (midiNotes: number[]) => {
      if (!isStarted) await startAudio();
      const synth = synthRef();
      const freqs = midiNotes.map(midiToFreq);
      synth.triggerAttackRelease(freqs, "8n");
      setTimeout(() => synth.dispose(), 2000);
    },
    [isStarted, startAudio, synthRef]
  );

  // Build scale notes relative to root
  const intervals = SCALE_INTERVALS[scale];
  const rootMidi = keyToMidi(rootKey, octave);
  const scaleNotes = intervals.map((i) => rootMidi + i);
  // Second octave for range
  const allNotes = [...scaleNotes, ...scaleNotes.map((n) => n + 12)];

  // Build chord buttons (one per scale degree)
  const chordButtons = scaleNotes.map((midi) => {
    const offsets = CHORD_TYPES[chordType];
    const notes = offsets.map((o) => midi + o);
    const noteName = NOTE_NAMES[midi % 12];
    return { midi, notes, noteName };
  });

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        {/* Key */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500">KEY</span>
          <select
            value={rootKey}
            onChange={(e) => setRootKey(e.target.value)}
            className="bg-[var(--surface2)] border border-[var(--border)] rounded px-2 py-1 text-xs"
          >
            {KEYS.map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
        {/* Scale */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500">SCALE</span>
          <select
            value={scale}
            onChange={(e) => setScale(e.target.value as keyof typeof SCALE_INTERVALS)}
            className="bg-[var(--surface2)] border border-[var(--border)] rounded px-2 py-1 text-xs"
          >
            {Object.keys(SCALE_INTERVALS).map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {/* Chord type */}
        {mode === "chords" && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500">CHORD</span>
            <select
              value={chordType}
              onChange={(e) => setChordType(e.target.value as ChordType)}
              className="bg-[var(--surface2)] border border-[var(--border)] rounded px-2 py-1 text-xs"
            >
              {Object.keys(CHORD_TYPES).map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}
        {/* Octave */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500">OCT</span>
          <div className="flex gap-1 items-center">
            <button onClick={() => setOctave(Math.max(2, octave - 1))} className="w-6 h-7 rounded bg-[var(--surface2)] border border-[var(--border)] text-xs">−</button>
            <span className="text-sm w-4 text-center">{octave}</span>
            <button onClick={() => setOctave(Math.min(6, octave + 1))} className="w-6 h-7 rounded bg-[var(--surface2)] border border-[var(--border)] text-xs">+</button>
          </div>
        </div>
        {/* Mode toggle */}
        <div className="flex flex-col gap-1 ml-auto">
          <span className="text-[10px] text-gray-500">MODE</span>
          <div className="flex rounded overflow-hidden border border-[var(--border)]">
            {(["chords", "notes"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-1 text-xs capitalize transition-colors ${
                  mode === m ? "bg-[var(--accent)] text-black font-bold" : "bg-[var(--surface2)] text-gray-400"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Buttons */}
      {mode === "chords" ? (
        <div className="flex-1 grid grid-cols-2 gap-2">
          {chordButtons.map(({ midi, notes, noteName }) => (
            <button
              key={midi}
              onPointerDown={() => playNotes(notes)}
              className="rounded-xl bg-[var(--surface2)] border border-[var(--border)] active:bg-[var(--accent)]/20 active:border-[var(--accent)] transition-colors flex flex-col items-center justify-center gap-1"
            >
              <span className="text-base font-bold">{noteName}</span>
              <span className="text-[10px] text-gray-500">{chordType}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-2">
          {/* Piano-style note strip */}
          <div className="flex-1 flex gap-1">
            {allNotes.map((midi) => {
              const name = NOTE_NAMES[midi % 12];
              const isBlack = name.includes("#");
              return (
                <button
                  key={midi}
                  onPointerDown={() => playNotes([midi])}
                  className={`flex-1 rounded-lg flex items-end justify-center pb-1 active:opacity-70 transition-opacity ${
                    isBlack
                      ? "bg-[#1a1a1a] border border-gray-700 text-gray-400"
                      : "bg-[#e5e5e5] text-black"
                  }`}
                >
                  <span className="text-[8px]">{name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
