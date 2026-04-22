"use client";

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import * as Tone from "tone";
import { Pad, PAD_COLORS, Pattern, LoopLayer } from "@/lib/types";
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
  // Loop engine
  loopBars: number; setLoopBars: (n: number) => void;
  metronomeActive: boolean; setMetronomeActive: (on: boolean) => void;
  isLoopRecording: boolean; loopRecord: (source: "mic" | "output") => void;
  loopLayers: LoopLayer[];
  deleteLoopLayer: (id: string) => void;
  toggleMuteLayer: (id: string) => void;
  loopPosition: number;
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
  const [loopBars, setLoopBarsState] = useState(2);
  const [metronomeActive, setMetronomeActiveState] = useState(false);
  const [isLoopRecording, setIsLoopRecording] = useState(false);
  const [loopLayers, setLoopLayers] = useState<LoopLayer[]>([]);
  const [loopPosition, setLoopPosition] = useState(0);

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
  const loopBarsRef = useRef(2);
  const metronomeActiveRef = useRef(false);
  const metronomeSeqRef = useRef<Tone.Sequence | null>(null);
  const metroSynthRef = useRef<Tone.Synth | null>(null);
  const isLoopRecordingRef = useRef(false);
  const loopMRRef = useRef<MediaRecorder | null>(null);
  const loopLayerPlayersRef = useRef<Map<string, Tone.Player>>(new Map());
  const loopLayerSchedulesRef = useRef<Map<string, number>>(new Map());
  const mutedLayersRef = useRef<Set<string>>(new Set());
  const loopRAFRef = useRef<number>(0);

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

    // Metronome — single reusable synth routed DIRECTLY to destination,
    // bypassing masterGain so clicks are never captured in loop recordings.
    const metroSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    }).toDestination();
    metroSynth.volume.value = -8;
    metroSynthRef.current = metroSynth;

    const metroSeq = new Tone.Sequence(
      (time, beat) => {
        if (!metronomeActiveRef.current) return;
        const isDown = beat === 0;
        metroSynth.triggerAttackRelease(isDown ? "C5" : "G4", "32n", time);
      },
      [0, 1, 2, 3],
      "4n"
    );
    metroSeq.start(0);
    metronomeSeqRef.current = metroSeq;

    // Enable transport loop
    const t = Tone.getTransport();
    t.loop = true;
    t.loopStart = 0;
    t.loopEnd = `${loopBarsRef.current}m`;

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

  const setLoopBars = useCallback((n: number) => {
    setLoopBarsState(n);
    loopBarsRef.current = n;
    const t = Tone.getTransport();
    t.loop = true;
    t.loopStart = 0;
    t.loopEnd = `${n}m`;
  }, []);

  const setMetronomeActive = useCallback((on: boolean) => {
    setMetronomeActiveState(on);
    metronomeActiveRef.current = on;
  }, []);

  const loopRecord = useCallback(async (source: "mic" | "output") => {
    // Toggle off
    if (isLoopRecordingRef.current) {
      loopMRRef.current?.stop();
      return;
    }

    if (!isStartedRef.current) await startAudio();
    const t = Tone.getTransport();
    if (t.state !== "started") {
      t.start();
      setIsPlaying(true);
    }

    let stream: MediaStream;
    let captureDest: MediaStreamAudioDestinationNode | null = null;

    if (source === "mic") {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        alert("Microphone permission denied.");
        return;
      }
    } else {
      // Tap the master gain into a capture destination
      const rawCtx = Tone.getContext().rawContext as AudioContext;
      captureDest = rawCtx.createMediaStreamDestination();
      masterGain.current?.connect(captureDest as unknown as Tone.ToneAudioNode);
      stream = captureDest.stream;
    }

    const beatMs = (60 / bpmRef.current) * 1000;
    const durationMs = loopBarsRef.current * 4 * beatMs;

    // Snap to next bar boundary
    let delayMs = 0;
    try {
      const nextBar = t.nextSubdivision("1m");
      delayMs = Math.max(0, (nextBar - Tone.now()) * 1000);
    } catch { /* transport not started yet, record immediately */ }

    const chunks: Blob[] = [];
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    loopMRRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mr.onstop = () => {
      if (captureDest) masterGain.current?.disconnect(captureDest as unknown as Tone.ToneAudioNode);
      if (source === "mic") stream.getTracks().forEach(tr => tr.stop());

      const blob = new Blob(chunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      const bars = loopBarsRef.current;
      const duration = bars * 4 * (60 / bpmRef.current);
      const id = crypto.randomUUID();

      const player = new Tone.Player(url);
      player.connect(masterGain.current ?? Tone.getDestination());
      loopLayerPlayersRef.current.set(id, player);

      const schedId = Tone.getTransport().scheduleRepeat((time) => {
        if (mutedLayersRef.current.has(id)) return;
        const p = loopLayerPlayersRef.current.get(id);
        if (!p) return;
        if (p.state === "started") p.stop(time);
        p.start(time);
      }, `${bars}m`, 0);
      loopLayerSchedulesRef.current.set(id, schedId);

      setLoopLayers(prev => [...prev, { id, url, blob, duration, bars, muted: false, createdAt: Date.now() }]);
      setIsLoopRecording(false);
      isLoopRecordingRef.current = false;
    };

    setTimeout(() => {
      mr.start(100);
      setIsLoopRecording(true);
      isLoopRecordingRef.current = true;
      setTimeout(() => { if (isLoopRecordingRef.current) mr.stop(); }, durationMs);
    }, delayMs);
  }, [startAudio]);

  const deleteLoopLayer = useCallback((id: string) => {
    const schedId = loopLayerSchedulesRef.current.get(id);
    if (schedId !== undefined) Tone.getTransport().clear(schedId);
    loopLayerSchedulesRef.current.delete(id);
    const player = loopLayerPlayersRef.current.get(id);
    if (player) { if (player.state === "started") player.stop(); player.dispose(); }
    loopLayerPlayersRef.current.delete(id);
    mutedLayersRef.current.delete(id);
    setLoopLayers(prev => prev.filter(l => l.id !== id));
  }, []);

  const toggleMuteLayer = useCallback((id: string) => {
    setLoopLayers(prev => prev.map(l => {
      if (l.id !== id) return l;
      const muted = !l.muted;
      if (muted) {
        mutedLayersRef.current.add(id);
        loopLayerPlayersRef.current.get(id)?.stop();
      } else {
        mutedLayersRef.current.delete(id);
      }
      return { ...l, muted };
    }));
  }, []);

  const togglePlay = useCallback(async () => {
    if (!isStartedRef.current) await startAudio();
    if (Tone.getTransport().state === "started") {
      Tone.getTransport().stop();
      setIsPlaying(false);
      setCurrentStep(-1);
      setLoopPosition(0);
      cancelAnimationFrame(loopRAFRef.current);
    } else {
      Tone.getTransport().start();
      setIsPlaying(true);
      const tick = () => {
        setLoopPosition(Tone.getTransport().progress ?? 0);
        loopRAFRef.current = requestAnimationFrame(tick);
      };
      loopRAFRef.current = requestAnimationFrame(tick);
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
      loopBars, setLoopBars, metronomeActive, setMetronomeActive,
      isLoopRecording, loopRecord,
      loopLayers, deleteLoopLayer, toggleMuteLayer,
      loopPosition,
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
