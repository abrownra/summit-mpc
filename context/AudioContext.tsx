"use client";

import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import * as Tone from "tone";
import { Pad, PAD_COLORS } from "@/lib/types";

interface AudioContextValue {
  isStarted: boolean;
  bpm: number;
  setBpm: (bpm: number) => void;
  isPlaying: boolean;
  togglePlay: () => void;
  pads: Pad[];
  setPads: React.Dispatch<React.SetStateAction<Pad[]>>;
  triggerPad: (padId: number) => void;
  loadSampleToPad: (padId: number, file: File) => Promise<void>;
  loadSampleUrlToPad: (padId: number, url: string, name: string) => Promise<void>;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  startAudio: () => Promise<void>;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

const DEFAULT_PADS: Pad[] = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  label: `PAD ${i + 1}`,
  color: PAD_COLORS[i],
  pitch: 0,
  volume: 0.8,
  reverse: false,
}));

// Default synth hit per pad index when no sample is loaded
function makeDefaultHit(padId: number): void {
  const dest = Tone.getDestination();
  if (padId === 0 || padId === 4 || padId === 8 || padId === 12) {
    // Kick
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.07, octaves: 6 }).connect(dest);
    kick.triggerAttackRelease("C1", "8n");
    setTimeout(() => kick.dispose(), 500);
  } else if (padId === 1 || padId === 5 || padId === 9 || padId === 13) {
    // Snare
    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
    }).connect(dest);
    snare.triggerAttackRelease("16n");
    setTimeout(() => snare.dispose(), 400);
  } else if (padId === 2 || padId === 6 || padId === 10 || padId === 14) {
    // Hi-hat
    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).connect(dest);
    hat.triggerAttackRelease(400, "32n");
    setTimeout(() => hat.dispose(), 300);
  } else {
    // Perc
    const perc = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    }).connect(dest);
    const notes = ["G1", "A1", "B1", "D2", "E2", "F#2"];
    perc.triggerAttackRelease(notes[padId % notes.length], "16n");
    setTimeout(() => perc.dispose(), 500);
  }
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isStarted, setIsStarted] = useState(false);
  const [bpm, setBpmState] = useState(90);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pads, setPads] = useState<Pad[]>(DEFAULT_PADS);
  const [masterVolume, setMasterVolumeState] = useState(0.8);

  // Use ref to avoid stale closure issues with isStarted
  const isStartedRef = useRef(false);
  const players = useRef<Map<number, Tone.Player>>(new Map());
  const masterGain = useRef<Tone.Gain | null>(null);

  const startAudio = useCallback(async () => {
    if (isStartedRef.current) return;
    await Tone.start();
    if (!masterGain.current) {
      masterGain.current = new Tone.Gain(0.8).toDestination();
    }
    isStartedRef.current = true;
    setIsStarted(true);
  }, []);

  const setBpm = useCallback((newBpm: number) => {
    setBpmState(newBpm);
    Tone.getTransport().bpm.value = newBpm;
  }, []);

  const togglePlay = useCallback(async () => {
    if (!isStartedRef.current) await startAudio();
    if (Tone.getTransport().state === "started") {
      Tone.getTransport().stop();
      setIsPlaying(false);
    } else {
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  }, [startAudio]);

  const setMasterVolume = useCallback((v: number) => {
    setMasterVolumeState(v);
    if (masterGain.current) masterGain.current.gain.value = v;
  }, []);

  const loadSampleToPad = useCallback(async (padId: number, file: File) => {
    const url = URL.createObjectURL(file);
    const dest = masterGain.current ?? Tone.getDestination();
    const player = new Tone.Player().connect(dest);
    await player.load(url);
    const old = players.current.get(padId);
    if (old) old.dispose();
    players.current.set(padId, player);
    setPads((prev) =>
      prev.map((p) =>
        p.id === padId
          ? { ...p, label: file.name.replace(/\.[^.]+$/, "").slice(0, 10).toUpperCase(), sampleUrl: url }
          : p
      )
    );
  }, []);

  const loadSampleUrlToPad = useCallback(async (padId: number, url: string, name: string) => {
    const dest = masterGain.current ?? Tone.getDestination();
    const player = new Tone.Player().connect(dest);
    await player.load(url);
    const old = players.current.get(padId);
    if (old) old.dispose();
    players.current.set(padId, player);
    setPads((prev) =>
      prev.map((p) =>
        p.id === padId
          ? { ...p, label: name.replace(/\.[^.]+$/, "").slice(0, 10).toUpperCase(), sampleUrl: url }
          : p
      )
    );
  }, []);

  const triggerPad = useCallback(
    async (padId: number) => {
      if (!isStartedRef.current) await startAudio();
      const player = players.current.get(padId);
      const pad = pads.find((p) => p.id === padId);
      if (!pad) return;

      if (!player) {
        // No sample loaded — use default synth hit
        makeDefaultHit(padId);
        return;
      }

      player.reverse = pad.reverse;
      player.volume.value = Tone.gainToDb(pad.volume);
      player.playbackRate = Math.pow(2, pad.pitch / 12);
      if (player.state === "started") player.stop();
      player.start();
    },
    [pads, startAudio]
  );

  return (
    <AudioCtx.Provider
      value={{
        isStarted,
        bpm,
        setBpm,
        isPlaying,
        togglePlay,
        pads,
        setPads,
        triggerPad,
        loadSampleToPad,
        loadSampleUrlToPad,
        masterVolume,
        setMasterVolume,
        startAudio,
      }}
    >
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used inside AudioProvider");
  return ctx;
}
