"use client";

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import * as Tone from "tone";
import { Pad, PAD_COLORS, Pattern } from "@/lib/types";
import { detectBPM, rateToSemitones } from "@/lib/beatDetect";

interface BeatMatchInfo { detectedBpm: number; rate: number; active: boolean; }

interface AudioContextValue {
  isStarted: boolean;
  bpm: number; setBpm: (bpm: number) => void;
  isPlaying: boolean; togglePlay: () => void;
  pads: Pad[]; setPads: React.Dispatch<React.SetStateAction<Pad[]>>;
  triggerPad: (padId: number) => void;
  loadSampleToPad: (padId: number, file: File) => Promise<void>;
  loadSampleUrlToPad: (padId: number, url: string, name: string) => Promise<void>;
  beatMatchPad: (padId: number) => Promise<BeatMatchInfo | null>;
  beatMatchInfo: Map<number, BeatMatchInfo>;
  // Sequencer
  pattern: Pattern; toggleStep: (padId: number, step: number) => void;
  clearPattern: () => void; loadPattern: (p: Pattern) => void;
  currentStep: number;
  stepCount: number; setStepCount: (n: number) => void;
  // Bounce
  bounce: (bars?: number) => Promise<Blob>;
  // Volume
  masterVolume: number; setMasterVolume: (v: number) => void;
  startAudio: () => Promise<void>;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

const DEFAULT_PADS: Pad[] = Array.from({ length: 16 }, (_, i) => ({
  id: i, label: `PAD ${i + 1}`, color: PAD_COLORS[i], pitch: 0, volume: 0.8, reverse: false,
}));

const EMPTY_PATTERN = (): Pattern => Array.from({ length: 16 }, () => new Array(16).fill(false));

function scheduleSynthHit(padId: number, time: number, dest: Tone.ToneAudioNode) {
  if (padId === 0 || padId === 4 || padId === 8 || padId === 12) {
    const s = new Tone.MembraneSynth({ pitchDecay: 0.07, octaves: 6 }).connect(dest);
    s.triggerAttackRelease("C1", "8n", time);
    setTimeout(() => s.dispose(), 600);
  } else if (padId === 1 || padId === 5 || padId === 9 || padId === 13) {
    const s = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 } }).connect(dest);
    s.triggerAttackRelease("16n", time);
    setTimeout(() => s.dispose(), 400);
  } else if (padId === 2 || padId === 6 || padId === 10 || padId === 14) {
    const s = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.08, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).connect(dest);
    s.triggerAttackRelease(400, "32n", time);
    setTimeout(() => s.dispose(), 300);
  } else {
    const notes = ["G1","A1","B1","D2","E2","F#2"];
    const s = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 3, envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 } }).connect(dest);
    s.triggerAttackRelease(notes[padId % notes.length], "16n", time);
    setTimeout(() => s.dispose(), 500);
  }
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isStarted, setIsStarted] = useState(false);
  const [bpm, setBpmState] = useState(90);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pads, setPads] = useState<Pad[]>(DEFAULT_PADS);
  const [masterVolume, setMasterVolumeState] = useState(0.8);
  const [beatMatchInfo, setBeatMatchInfo] = useState<Map<number, BeatMatchInfo>>(new Map());
  const [pattern, setPattern] = useState<Pattern>(EMPTY_PATTERN());
  const [currentStep, setCurrentStep] = useState(-1);
  const [stepCount, setStepCountState] = useState(16);

  const isStartedRef = useRef(false);
  const bpmRef = useRef(90);
  const stepCountRef = useRef(16);
  const players = useRef<Map<number, Tone.Player>>(new Map());
  const pitchShifters = useRef<Map<number, Tone.PitchShift>>(new Map());
  const sampleUrls = useRef<Map<number, string>>(new Map());
  const masterGain = useRef<Tone.Gain | null>(null);
  const patternRef = useRef<Pattern>(EMPTY_PATTERN());
  const padsRef = useRef<Pad[]>(DEFAULT_PADS);
  const seqRef = useRef<Tone.Sequence | null>(null);

  // Keep refs in sync with state
  useEffect(() => { patternRef.current = pattern; }, [pattern]);
  useEffect(() => { padsRef.current = pads; }, [pads]);

  const startAudio = useCallback(async () => {
    if (isStartedRef.current) return;
    await Tone.start();
    if (!masterGain.current) masterGain.current = new Tone.Gain(0.8).toDestination();

    // Create step sequencer tied to transport
    const seq = new Tone.Sequence(
      (time, step) => {
        Tone.getDraw().schedule(() => setCurrentStep(step as number), time);
        const s = step as number;
        const dest = masterGain.current ?? Tone.getDestination();
        for (let padId = 0; padId < 16; padId++) {
          if (s < stepCountRef.current && patternRef.current[padId]?.[s]) {
            const player = players.current.get(padId);
            const pad = padsRef.current.find(p => p.id === padId);
            if (player && pad) {
              player.volume.value = Tone.gainToDb(pad.volume);
              player.reverse = pad.reverse;
              if (!pitchShifters.current.has(padId)) player.playbackRate = Math.pow(2, pad.pitch / 12);
              if (player.state === "started") player.stop(time);
              player.start(time);
            } else {
              scheduleSynthHit(padId, time, dest);
            }
          }
        }
      },
      Array.from({ length: 16 }, (_, i) => i),
      "16n"
    );
    seq.start(0);
    seqRef.current = seq;

    isStartedRef.current = true;
    setIsStarted(true);
  }, []);

  const setBpm = useCallback((newBpm: number) => {
    setBpmState(newBpm);
    bpmRef.current = newBpm;
    Tone.getTransport().bpm.value = newBpm;
  }, []);

  const setStepCount = useCallback((n: number) => {
    setStepCountState(n);
    stepCountRef.current = n;
  }, []);

  const togglePlay = useCallback(async () => {
    if (!isStartedRef.current) await startAudio();
    if (Tone.getTransport().state === "started") {
      Tone.getTransport().stop();
      setIsPlaying(false);
      setCurrentStep(-1);
    } else {
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  }, [startAudio]);

  const setMasterVolume = useCallback((v: number) => {
    setMasterVolumeState(v);
    if (masterGain.current) masterGain.current.gain.value = v;
  }, []);

  const connectPlayer = useCallback((padId: number, player: Tone.Player) => {
    const dest = masterGain.current ?? Tone.getDestination();
    const shifter = pitchShifters.current.get(padId);
    if (shifter) { player.connect(shifter); shifter.connect(dest); }
    else player.connect(dest);
  }, []);

  const loadSampleToPad = useCallback(async (padId: number, file: File) => {
    const url = URL.createObjectURL(file);
    const player = new Tone.Player();
    await player.load(url);
    const old = players.current.get(padId);
    if (old) { old.disconnect(); old.dispose(); }
    players.current.set(padId, player);
    sampleUrls.current.set(padId, url);
    const oldS = pitchShifters.current.get(padId);
    if (oldS) { oldS.dispose(); pitchShifters.current.delete(padId); }
    setBeatMatchInfo(prev => { const n = new Map(prev); n.delete(padId); return n; });
    connectPlayer(padId, player);
    setPads(prev => prev.map(p => p.id === padId
      ? { ...p, label: file.name.replace(/\.[^.]+$/, "").slice(0, 10).toUpperCase(), sampleUrl: url } : p));
  }, [connectPlayer]);

  const loadSampleUrlToPad = useCallback(async (padId: number, url: string, name: string) => {
    const player = new Tone.Player();
    await player.load(url);
    const old = players.current.get(padId);
    if (old) { old.disconnect(); old.dispose(); }
    players.current.set(padId, player);
    sampleUrls.current.set(padId, url);
    const oldS = pitchShifters.current.get(padId);
    if (oldS) { oldS.dispose(); pitchShifters.current.delete(padId); }
    setBeatMatchInfo(prev => { const n = new Map(prev); n.delete(padId); return n; });
    connectPlayer(padId, player);
    setPads(prev => prev.map(p => p.id === padId
      ? { ...p, label: name.replace(/\.[^.]+$/, "").slice(0, 10).toUpperCase(), sampleUrl: url } : p));
  }, [connectPlayer]);

  const beatMatchPad = useCallback(async (padId: number): Promise<BeatMatchInfo | null> => {
    const url = sampleUrls.current.get(padId);
    const player = players.current.get(padId);
    if (!url || !player) return null;
    const detectedBpm = await detectBPM(url);
    const rate = bpmRef.current / detectedBpm;
    const semitones = rateToSemitones(rate);
    player.disconnect();
    const oldS = pitchShifters.current.get(padId);
    if (oldS) oldS.dispose();
    player.playbackRate = rate;
    const shifter = new Tone.PitchShift({ pitch: semitones, windowSize: 0.1 });
    pitchShifters.current.set(padId, shifter);
    const dest = masterGain.current ?? Tone.getDestination();
    player.connect(shifter); shifter.connect(dest);
    const info: BeatMatchInfo = { detectedBpm, rate, active: true };
    setBeatMatchInfo(prev => new Map(prev).set(padId, info));
    return info;
  }, []);

  const triggerPad = useCallback(async (padId: number) => {
    if (!isStartedRef.current) await startAudio();
    const player = players.current.get(padId);
    const pad = pads.find(p => p.id === padId);
    if (!pad) return;
    if (!player) { scheduleSynthHit(padId, Tone.now(), masterGain.current ?? Tone.getDestination()); return; }
    player.reverse = pad.reverse;
    player.volume.value = Tone.gainToDb(pad.volume);
    if (!pitchShifters.current.has(padId)) player.playbackRate = Math.pow(2, pad.pitch / 12);
    if (player.state === "started") player.stop();
    player.start();
  }, [pads, startAudio]);

  const toggleStep = useCallback((padId: number, step: number) => {
    setPattern(prev => {
      const next = prev.map(row => [...row]);
      next[padId][step] = !next[padId][step];
      patternRef.current = next;
      return next;
    });
  }, []);

  const clearPattern = useCallback(() => {
    const empty = EMPTY_PATTERN();
    setPattern(empty);
    patternRef.current = empty;
  }, []);

  const loadPattern = useCallback((p: Pattern) => {
    const safe = EMPTY_PATTERN();
    for (let i = 0; i < Math.min(p.length, 16); i++)
      for (let j = 0; j < Math.min(p[i].length, 16); j++)
        safe[i][j] = p[i][j];
    setPattern(safe);
    patternRef.current = safe;
  }, []);

  const bounce = useCallback(async (bars = 4): Promise<Blob> => {
    if (!isStartedRef.current) await startAudio();
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    const captureDest = rawCtx.createMediaStreamDestination();
    // Tap master gain output into capture destination
    masterGain.current?.connect(captureDest as unknown as Tone.ToneAudioNode);

    const recorder = new MediaRecorder(captureDest.stream, { mimeType: "audio/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    const durationMs = bars * (4 * 60 / bpmRef.current) * 1000;
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
    setCurrentStep(-1);

    recorder.start(100);
    Tone.getTransport().start();
    setIsPlaying(true);

    await new Promise(resolve => setTimeout(resolve, durationMs + 300));

    recorder.stop();
    Tone.getTransport().stop();
    setIsPlaying(false);
    setCurrentStep(-1);
    masterGain.current?.disconnect(captureDest as unknown as Tone.ToneAudioNode);

    return new Promise(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" })); });
  }, [startAudio]);

  return (
    <AudioCtx.Provider value={{
      isStarted, bpm, setBpm, isPlaying, togglePlay,
      pads, setPads, triggerPad, loadSampleToPad, loadSampleUrlToPad,
      beatMatchPad, beatMatchInfo,
      pattern, toggleStep, clearPattern, loadPattern, currentStep, stepCount, setStepCount,
      bounce,
      masterVolume, setMasterVolume, startAudio,
    }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used inside AudioProvider");
  return ctx;
}
