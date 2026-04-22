"use client";

import { useState } from "react";
import { AudioProvider, useAudio } from "@/context/AudioContext";
import Transport from "@/components/Transport";
import PadGrid from "@/components/PadGrid";
import SampleChopper from "@/components/SampleChopper";
import ChordKeys from "@/components/ChordKeys";
import VocalRecorder from "@/components/VocalRecorder";
import Sequencer from "@/components/Sequencer";
import ProjectManager from "@/components/ProjectManager";
import BottomNav from "@/components/BottomNav";
import { PadMode } from "@/lib/types";

function App() {
  const [mode, setMode] = useState<PadMode>("pads");
  const [showProjects, setShowProjects] = useState(false);
  const { isStarted, startAudio } = useAudio();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Transport onProjectsOpen={() => setShowProjects(true)} />
      <main className="flex-1 overflow-hidden relative">
        {mode === "pads" && <PadGrid />}
        {mode === "chopper" && <SampleChopper />}
        {mode === "keys" && <ChordKeys />}
        {mode === "seq" && <Sequencer />}
        {mode === "recorder" && <VocalRecorder />}
      </main>
      <BottomNav active={mode} onChange={setMode} />
      {showProjects && <ProjectManager onClose={() => setShowProjects(false)} />}

      {/* Tap-to-start overlay — required for Web Audio API on mobile */}
      {!isStarted && (
        <div
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0a0a]"
          onPointerDown={async (e) => {
            e.preventDefault();
            await startAudio();
          }}
        >
          <div className="flex flex-col items-center gap-6 select-none">
            <div className="text-5xl font-bold tracking-tight">
              <span className="text-[var(--accent)]">SUMMIT</span>
              <span className="text-white">.mpc</span>
            </div>
            <div className="w-20 h-20 rounded-full border-4 border-[var(--accent)] flex items-center justify-center animate-pulse">
              <span className="text-3xl">▶</span>
            </div>
            <p className="text-gray-500 text-sm tracking-widest">TAP TO START</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <AudioProvider>
      <App />
    </AudioProvider>
  );
}
