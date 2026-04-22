"use client";

import { useState, useEffect } from "react";
import { useAudio } from "@/context/AudioContext";
import { SavedProject } from "@/lib/types";
import { listProjects, saveProject, deleteProject } from "@/lib/projectStorage";

interface Props { onClose: () => void; }

function timeAgo(ms: number): string {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ProjectManager({ onClose }: Props) {
  const { bpm, setBpm, pads, setPads, pattern, loadPattern, setStepCount, loadSampleUrlToPad, clearPattern, loopLayers, deleteLoopLayer } = useAudio();
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [projectName, setProjectName] = useState("Untitled");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => { setProjects(listProjects()); }, []);

  const handleNew = () => {
    setBpm(90);
    setStepCount(16);
    clearPattern();
    setPads(prev => prev.map(p => ({ ...p, label: `PAD ${p.id + 1}`, sampleUrl: undefined, pitch: 0, volume: 0.8, reverse: false })));
    [...loopLayers].forEach(l => deleteLoopLayer(l.id));
    setProjectName("Untitled");
    setConfirmNew(false);
    onClose();
  };

  const handleSave = () => {
    setSaving(true);
    const project: SavedProject = {
      id: crypto.randomUUID(),
      name: projectName.trim() || "Untitled",
      savedAt: Date.now(),
      bpm,
      pattern,
      pads: pads.map(p => ({
        id: p.id, label: p.label, color: p.color,
        pitch: p.pitch, volume: p.volume, reverse: p.reverse,
        // Only save non-blob URLs (remote URLs survive reload)
        sampleUrl: p.sampleUrl?.startsWith("blob:") ? undefined : p.sampleUrl,
      })),
    };
    saveProject(project);
    setProjects(listProjects());
    setSaving(false);
  };

  const handleLoad = async (project: SavedProject) => {
    setLoading(project.id);
    setBpm(project.bpm);
    setStepCount(16);
    // Restore pad configs
    setPads(prev => prev.map(p => {
      const saved = project.pads.find(sp => sp.id === p.id);
      if (!saved) return p;
      return { ...p, label: saved.label, color: saved.color, pitch: saved.pitch, volume: saved.volume, reverse: saved.reverse, sampleUrl: saved.sampleUrl };
    }));
    // Re-load remote sample URLs into players
    for (const savedPad of project.pads) {
      if (savedPad.sampleUrl && !savedPad.sampleUrl.startsWith("blob:")) {
        try { await loadSampleUrlToPad(savedPad.id, savedPad.sampleUrl, savedPad.label); } catch { /* skip */ }
      }
    }
    loadPattern(project.pattern);
    setLoading(null);
    onClose();
  };

  const handleDelete = (id: string) => {
    deleteProject(id);
    setProjects(listProjects());
    setConfirmDelete(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end">
      <div className="w-full bg-[var(--surface)] rounded-t-2xl flex flex-col" style={{ maxHeight: "85vh" }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <span className="font-bold text-sm text-[var(--accent)]">PROJECTS</span>
          <button onClick={onClose} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        {/* New project */}
        <div className="flex gap-2 px-4 pb-3 shrink-0 border-b border-[var(--border)]">
          {confirmNew ? (
            <>
              <span className="flex-1 text-xs text-gray-400 flex items-center">Clear everything and start fresh?</span>
              <button onClick={handleNew} className="px-3 py-2 rounded-lg bg-[var(--red)] text-white text-xs font-bold">YES, CLEAR</button>
              <button onClick={() => setConfirmNew(false)} className="px-3 py-2 rounded-lg border border-[var(--border)] text-gray-400 text-xs">Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmNew(true)} className="flex-1 py-2 rounded-lg bg-[var(--surface2)] border border-[var(--border)] text-xs text-gray-300 font-bold">
              + NEW PROJECT
            </button>
          )}
        </div>

        {/* Save current */}
        <div className="flex gap-2 px-4 pb-3 shrink-0 border-b border-[var(--border)]">
          <input
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="Project name..."
            className="flex-1 bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-xs font-bold disabled:opacity-40"
          >
            SAVE
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {projects.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-8">No saved projects yet</p>
          )}
          {projects.map(p => (
            <div key={p.id} className="flex items-center gap-2 py-3 border-b border-[var(--border)]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{p.name}</p>
                <p className="text-[10px] text-gray-500">{p.bpm} BPM · {timeAgo(p.savedAt)}</p>
              </div>
              {confirmDelete === p.id ? (
                <div className="flex gap-2">
                  <button onClick={() => handleDelete(p.id)} className="text-xs px-2 py-1 rounded bg-[var(--red)] text-white">Delete</button>
                  <button onClick={() => setConfirmDelete(null)} className="text-xs px-2 py-1 rounded border border-[var(--border)] text-gray-400">Cancel</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLoad(p)}
                    disabled={loading === p.id}
                    className="text-xs px-3 py-1 rounded bg-[var(--accent2)] text-white font-bold disabled:opacity-40"
                  >
                    {loading === p.id ? "..." : "LOAD"}
                  </button>
                  <button onClick={() => setConfirmDelete(p.id)} className="text-xs text-gray-600">✕</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-[10px] text-gray-700 text-center pb-4 shrink-0 px-4">
          Remote samples restore on load · Local files must be re-loaded manually
        </p>
      </div>
    </div>
  );
}
