"use client";

import { useState, useRef, useCallback } from "react";
import { RecordingTake } from "@/lib/types";
import { useAudio } from "@/context/AudioContext";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

export default function VocalRecorder() {
  const { bpm, isPlaying, togglePlay } = useAudio();
  const [takes, setTakes] = useState<RecordingTake[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [countIn, setCountIn] = useState<1 | 2 | 4>(2);
  const [loopBars, setLoopBars] = useState<number | null>(null); // null = freeform

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const startTimeRef = useRef<number>(0);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    setIsRecording(false);
    setElapsed(0);
  }, []);

  const startRecording = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert("Microphone permission denied.");
      return;
    }

    // BPM-synced count-in (500ms per beat at ~120 BPM feels right for count-in visual)
    const beatMs = (60 / bpm) * 1000;
    let count = countIn;
    setCountdown(count);
    await new Promise<void>((resolve) => {
      const tick = setInterval(() => {
        count--;
        if (count <= 0) { clearInterval(tick); setCountdown(null); resolve(); }
        else setCountdown(count);
      }, beatMs);
    });

    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      const duration = (Date.now() - startTimeRef.current) / 1000;
      setTakes(prev => [{ id: crypto.randomUUID(), blob, url, duration, createdAt: Date.now() }, ...prev]);
      stream.getTracks().forEach(t => t.stop());
    };

    mr.start(100);
    startTimeRef.current = Date.now();
    setElapsed(0);
    setIsRecording(true);

    timerRef.current = setInterval(() => setElapsed((Date.now() - startTimeRef.current) / 1000), 100);

    // Auto-stop after N bars if loop mode set
    if (loopBars !== null) {
      const loopMs = loopBars * 4 * beatMs;
      autoStopRef.current = setTimeout(() => stopRecording(), loopMs);
    }
  }, [bpm, countIn, loopBars, stopRecording]);

  const playTake = (take: RecordingTake) => {
    audioRefs.current.forEach(a => { a.pause(); a.currentTime = 0; });
    setPlayingId(null);
    const audio = new Audio(take.url);
    audioRefs.current.set(take.id, audio);
    audio.play();
    setPlayingId(take.id);
    audio.onended = () => setPlayingId(null);
  };

  const stopPlay = (id: string) => {
    const a = audioRefs.current.get(id);
    if (a) { a.pause(); a.currentTime = 0; }
    setPlayingId(null);
  };

  const deleteTake = (id: string) => {
    audioRefs.current.get(id)?.pause();
    audioRefs.current.delete(id);
    setTakes(prev => prev.filter(t => t.id !== id));
    if (playingId === id) setPlayingId(null);
  };

  const exportTake = (take: RecordingTake) => {
    const a = document.createElement("a");
    a.href = take.url;
    a.download = `summit-vocal-${new Date(take.createdAt).toISOString().slice(0, 19)}.webm`;
    a.click();
  };

  // Loop length in seconds for progress bar
  const loopDuration = loopBars !== null ? loopBars * 4 * (60 / bpm) : null;
  const progress = loopDuration ? Math.min(1, elapsed / loopDuration) : null;

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="flex flex-col items-center gap-4 pt-2">
        {countdown !== null && (
          <div className="text-6xl font-bold text-[var(--accent)] animate-pulse">{countdown}</div>
        )}

        {isRecording && countdown === null && (
          <div className="w-full flex flex-col items-center gap-2">
            <div className="text-2xl font-bold text-[var(--red)] tabular-nums">● {formatTime(elapsed)}</div>
            {progress !== null && (
              <div className="w-full h-1.5 rounded-full bg-[var(--surface2)] overflow-hidden">
                <div className="h-full bg-[var(--red)] transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
          </div>
        )}

        <button
          onPointerDown={isRecording ? stopRecording : startRecording}
          className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl transition-all active:scale-95 ${
            isRecording ? "bg-[var(--red)] shadow-[0_0_30px_var(--red)]" : "bg-[var(--surface2)] border-4 border-[var(--red)] text-[var(--red)]"
          }`}
        >
          {isRecording ? "■" : "●"}
        </button>

        {/* Transport sync button */}
        <button
          onClick={togglePlay}
          className={`px-4 py-1 text-xs rounded-full border transition-colors ${
            isPlaying ? "bg-[var(--green)]/20 border-[var(--green)] text-[var(--green)]" : "border-[var(--border)] text-gray-500"
          }`}
        >
          {isPlaying ? "■ BEAT PLAYING" : "▶ START BEAT"}
        </button>

        {/* Count-in + loop length */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">COUNT-IN</span>
            {([1, 2, 4] as const).map(n => (
              <button key={n} onClick={() => setCountIn(n)}
                className={`w-7 h-7 rounded text-xs border transition-colors ${countIn === n ? "bg-[var(--accent)] border-[var(--accent)] text-black font-bold" : "bg-[var(--surface2)] border-[var(--border)] text-gray-400"}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">LOOP</span>
            {([null, 1, 2, 4, 8] as const).map(n => (
              <button key={String(n)} onClick={() => setLoopBars(n)}
                className={`w-7 h-7 rounded text-xs border transition-colors ${loopBars === n ? "bg-[var(--accent2)] border-[var(--accent2)] text-white font-bold" : "bg-[var(--surface2)] border-[var(--border)] text-gray-400"}`}>
                {n ?? "∞"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Takes list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {takes.length === 0 && (
          <p className="text-xs text-gray-600 text-center mt-6">No takes yet — hit record to start</p>
        )}
        {takes.map((take, i) => (
          <div key={take.id} className="flex items-center gap-2 bg-[var(--surface2)] rounded-lg px-3 py-2 border border-[var(--border)]">
            <button onClick={() => playingId === take.id ? stopPlay(take.id) : playTake(take)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${playingId === take.id ? "bg-[var(--red)] text-white" : "bg-[var(--accent2)] text-white"}`}>
              {playingId === take.id ? "■" : "▶"}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold">TAKE {takes.length - i}</div>
              <div className="text-[10px] text-gray-500">{formatTime(take.duration)}</div>
            </div>
            <button onClick={() => exportTake(take)} className="text-[10px] text-gray-500 px-2 py-1 rounded border border-[var(--border)]">EXPORT</button>
            <button onClick={() => deleteTake(take.id)} className="text-[var(--red)] text-xs">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
