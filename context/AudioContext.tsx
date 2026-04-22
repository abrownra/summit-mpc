"use client";

import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import * as Tone from "tone";
import { Pad, PAD_COLORS } from "@/lib/types";
import { detectBPM, rateToSemitones } from "@/lib/beatDetect";

interface BeatMatchInfo {
  detectedBpm: number;
  rate: number;
  active: boolean;
}

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
  beatMatchPad: (padId: number) => Promise<BeatMatchInfo | null>;
  beatMatchInfo: Map<number, BeatMatchInfo>;
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

function makeDefaultHit(padId: number): void {
  const dest = Tone.getDestination();
  if (padId === 0 || padId === 4 || padId === 8 || padId === 12) {
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.07, octaves: 6 }).connect(dest);
    kick.triggerAttackRelease("C1", "8n");
    setTimeout(() => kick.dispose(), 500);
  } else if (padId === 1 || padId === 5 || padId === 9 || padId === 13) {
    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
    }).connect(dest);
    snare.triggerAttackRelease("16n");
    setTimeout(() => snare.dispose(), 400);
  } else if (padId === 2 || padId === 6 || padId === 10 || padId === 14) {
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
  const [beatMatchInfo, setBeatMatchInfo] = useState<Map<number, BeatMatchInfo>>(new Map());

  const isStartedRef = useRef(false);
  const bpmRef = useRef(90);
  const players = useRef<Map<number, Tone.Player>>(new Map());
  const pitchShifters = useRef<Map<number, Tone.PitchShift>>(new Map());
  const sampleUrls = useRef<Map<number, string>>(new Map());
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
    bpmRef.current = newBpm;
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

  // Wire player through optional pitch shifter to master gain
  const connectPlayer = useCallback((padId: number, player: Tone.Player) => {
    const dest = masterGain.current ?? Tone.getDestination();
    const shifter = pitchShifters.current.get(padId);
    if (shifter) {
      player.connect(shifter);
      shifter.connect(dest);
    } else {
      player.connect(dest);
    }
  }, []);

  const loadSampleToPad = useCallback(async (padId: number, file: File) => {
    const url = URL.createObjectURL(file);
    const player = new Tone.Player();
    await player.load(url);
    const old = players.current.get(padId);
    if (old) { old.disconnect(); old.dispose(); }
    players.current.set(padId, player);
    sampleUrls.current.set(padId, url);
    // Clear any existing beat match
    const oldShifter = pitchShifters.current.get(padId);
    if (oldShifter) { oldShifter.dispose(); pitchShifters.current.delete(padId); }
    setBeatMatchInfo((prev) => { const n = new Map(prev); n.delete(padId); return n; });
    connectPlayer(padId, player);
    setPads((prev) =>
      prev.map((p) =>
        p.id === padId
          ? { ...p, label: file.name.replace(/\.[^.]+$/, "").slice(0, 10).toUpperCase(), sampleUrl: url }
          : p
      )
    );
  }, [connectPlayer]);

  const loadSampleUrlToPad = useCallback(async (padId: number, url: string, name: string) => {
    const player = new Tone.Player();
    await player.load(url);
    const old = players.current.get(padId);
    if (old) { old.disconnect(); old.dispose(); }
    players.current.set(padId, player);
    sampleUrls.current.set(padId, url);
    const oldShifter = pitchShifters.current.get(padId);
    if (oldShifter) { oldShifter.dispose(); pitchShifters.current.delete(padId); }
    setBeatMatchInfo((prev) => { const n = new Map(prev); n.delete(padId); return n; });
    connectPlayer(padId, player);
    setPads((prev) =>
      prev.map((p) =>
        p.id === padId
          ? { ...p, label: name.replace(/\.[^.]+$/, "").slice(0, 10).toUpperCase(), sampleUrl: url }
          : p
      )
    );
  }, [connectPlayer]);

  const beatMatchPad = useCallback(async (padId: number): Promise<BeatMatchInfo | null> => {
    const url = sampleUrls.current.get(padId);
    const player = players.current.get(padId);
    if (!url || !player) return null;

    const detectedBpm = await detectBPM(url);
    const projectBpm = bpmRef.current;
    const rate = projectBpm / detectedBpm;
    const semitones = rateToSemitones(rate);

    // Disconnect existing
    player.disconnect();
    const oldShifter = pitchShifters.current.get(padId);
    if (oldShifter) oldShifter.dispose();

    // Set rate on player
    player.playbackRate = rate;

    // Create pitch shifter to compensate
    const shifter = new Tone.PitchShift({ pitch: semitones, windowSize: 0.1 });
    pitchShifters.current.set(padId, shifter);

    // Reconnect
    const dest = masterGain.current ?? Tone.getDestination();
    player.connect(shifter);
    shifter.connect(dest);

    const info: BeatMatchInfo = { detectedBpm, rate, active: true };
    setBeatMatchInfo((prev) => new Map(prev).set(padId, info));
    return info;
  }, []);

  const triggerPad = useCallback(
    async (padId: number) => {
      if (!isStartedRef.current) await startAudio();
      const player = players.current.get(padId);
      const pad = pads.find((p) => p.id === padId);
      if (!pad) return;

      if (!player) {
        makeDefaultHit(padId);
        return;
      }

      player.volume.value = Tone.gainToDb(pad.volume);
      player.reverse = pad.reverse;
      // Only apply manual pitch if no beat-match active
      if (!pitchShifters.current.has(padId)) {
        player.playbackRate = Math.pow(2, pad.pitch / 12);
      }
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
        beatMatchPad,
        beatMatchInfo,
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
