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

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isStarted, setIsStarted] = useState(false);
  const [bpm, setBpmState] = useState(90);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pads, setPads] = useState<Pad[]>(DEFAULT_PADS);
  const [masterVolume, setMasterVolumeState] = useState(0.8);

  const players = useRef<Map<number, Tone.Player>>(new Map());
  const masterGain = useRef<Tone.Gain | null>(null);

  const startAudio = useCallback(async () => {
    if (isStarted) return;
    await Tone.start();
    masterGain.current = new Tone.Gain(masterVolume).toDestination();
    setIsStarted(true);
  }, [isStarted, masterVolume]);

  const setBpm = useCallback((newBpm: number) => {
    setBpmState(newBpm);
    Tone.getTransport().bpm.value = newBpm;
  }, []);

  const togglePlay = useCallback(async () => {
    if (!isStarted) await startAudio();
    if (Tone.getTransport().state === "started") {
      Tone.getTransport().stop();
      setIsPlaying(false);
    } else {
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  }, [isStarted, startAudio]);

  const setMasterVolume = useCallback((v: number) => {
    setMasterVolumeState(v);
    if (masterGain.current) masterGain.current.gain.value = v;
  }, []);

  const loadSampleToPad = useCallback(async (padId: number, file: File) => {
    const url = URL.createObjectURL(file);
    const player = new Tone.Player(url).connect(
      masterGain.current ?? Tone.getDestination()
    );
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
    const player = new Tone.Player(url).connect(
      masterGain.current ?? Tone.getDestination()
    );
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
      if (!isStarted) await startAudio();
      const player = players.current.get(padId);
      const pad = pads.find((p) => p.id === padId);
      if (!player || !pad) return;
      player.reverse = pad.reverse;
      player.volume.value = Tone.gainToDb(pad.volume);
      player.playbackRate = Math.pow(2, pad.pitch / 12);
      if (player.state === "started") player.stop();
      player.start();
    },
    [isStarted, pads, startAudio]
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
