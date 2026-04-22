"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type BrowserMode = "oneshot" | "loop" | "song";

interface FreesoundSound {
  id: number;
  name: string;
  duration: number;
  username: string;
  previews: {
    "preview-hq-mp3": string;
    "preview-lq-mp3": string;
  };
  tags: string[];
}

interface Props {
  mode?: BrowserMode;
  onSelect: (previewUrl: string, name: string) => void;
  onClose: () => void;
  title?: string;
}

const TABS: { id: BrowserMode; label: string }[] = [
  { id: "oneshot", label: "ONE-SHOTS" },
  { id: "loop",    label: "LOOPS" },
  { id: "song",    label: "SONGS" },
];

function formatDur(s: number) {
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m${Math.floor(s % 60)}s`;
}

export default function SampleBrowser({ mode: initMode = "oneshot", onSelect, onClose, title }: Props) {
  const [mode, setMode] = useState<BrowserMode>(initMode);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FreesoundSound[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string, m: BrowserMode, p: number, append = false) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/freesound?query=${encodeURIComponent(q)}&mode=${m}&page=${p}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Search failed");
      }
      const data = await res.json();
      setResults((prev) => append ? [...prev, ...data.results] : data.results);
      setHasMore(!!data.next);
      setPage(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setResults([]);
    search(query, mode, 1);
  };

  const handleTabChange = (m: BrowserMode) => {
    setMode(m);
    setResults([]);
    setPage(1);
    if (query.trim()) search(query, m, 1);
  };

  const previewSound = (sound: FreesoundSound) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === sound.id) {
      setPlayingId(null);
      return;
    }
    const url = sound.previews["preview-hq-mp3"] || sound.previews["preview-lq-mp3"];
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingId(sound.id);
    audio.onended = () => setPlayingId(null);
  };

  const handleSelect = (sound: FreesoundSound) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
    const url = sound.previews["preview-hq-mp3"] || sound.previews["preview-lq-mp3"];
    onSelect(url, sound.name);
  };

  // Focus input on open
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end">
      <div className="w-full bg-[var(--surface)] rounded-t-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <span className="font-bold text-sm text-[var(--accent)]">
            {title || "SAMPLE BROWSER"}
          </span>
          <button onClick={onClose} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)] shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 py-2 text-[10px] font-bold tracking-wider transition-colors ${
                mode === tab.id
                  ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                  : "text-gray-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 px-3 py-2 shrink-0">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "oneshot" ? "Search: kick, snare, 808..." :
              mode === "loop"    ? "Search: drum loop, trap, boom bap..." :
                                   "Search: sample, funk, jazz..."
            }
            className="flex-1 bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-xs font-bold disabled:opacity-40"
          >
            {loading && results.length === 0 ? "..." : "GO"}
          </button>
        </form>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {error && (
            <p className="text-[var(--red)] text-xs text-center py-4">
              {error === "FREESOUND_API_KEY not set"
                ? "Add FREESOUND_API_KEY to your environment variables."
                : error}
            </p>
          )}

          {!error && results.length === 0 && !loading && (
            <p className="text-gray-600 text-xs text-center py-8">
              {query ? "No results" : "Search above to browse sounds"}
            </p>
          )}

          <div className="flex flex-col gap-1">
            {results.map((sound) => (
              <div
                key={sound.id}
                className="flex items-center gap-2 bg-[var(--surface2)] rounded-lg px-3 py-2 border border-[var(--border)]"
              >
                {/* Preview */}
                <button
                  onClick={() => previewSound(sound)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 transition-colors ${
                    playingId === sound.id
                      ? "bg-[var(--red)] text-white"
                      : "bg-[var(--surface)] border border-[var(--border)] text-gray-300"
                  }`}
                >
                  {playingId === sound.id ? "■" : "▶"}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{sound.name}</p>
                  <p className="text-[10px] text-gray-500">{sound.username} · {formatDur(sound.duration)}</p>
                </div>

                {/* Load */}
                <button
                  onClick={() => handleSelect(sound)}
                  className="shrink-0 px-3 py-1 rounded-lg bg-[var(--accent)] text-black text-[10px] font-bold"
                >
                  LOAD
                </button>
              </div>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => search(query, mode, page + 1, true)}
              disabled={loading}
              className="w-full mt-2 py-2 text-xs text-gray-500 border border-[var(--border)] rounded-lg disabled:opacity-40"
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
