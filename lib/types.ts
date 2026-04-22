export type PadMode = "pads" | "chopper" | "keys" | "recorder";

export interface Pad {
  id: number;
  label: string;
  color: string;
  sampleUrl?: string;
  pitch: number; // semitone offset
  volume: number; // 0-1
  reverse: boolean;
}

export interface SampleSlice {
  id: string;
  start: number; // seconds
  end: number;   // seconds
  label: string;
  padAssigned?: number;
}

export interface RecordingTake {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  key: string;
  scale: string;
  pads: Pad[];
  slices: SampleSlice[];
  recordings: RecordingTake[];
}

export const CHORD_TYPES = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
} as const;

export type ChordType = keyof typeof CHORD_TYPES;

export const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const SCALE_INTERVALS: Record<string, number[]> = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues:      [0, 3, 5, 6, 7, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
};

export const PAD_COLORS = [
  "#ff6b35", "#f59e0b", "#22c55e", "#06b6d4",
  "#3b82f6", "#a855f7", "#ec4899", "#ef4444",
  "#84cc16", "#14b8a6", "#6366f1", "#f97316",
  "#10b981", "#0ea5e9", "#d946ef", "#e11d48",
];
