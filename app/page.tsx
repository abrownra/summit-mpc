"use client";

import { useState } from "react";
import { AudioProvider } from "@/context/AudioContext";
import Transport from "@/components/Transport";
import PadGrid from "@/components/PadGrid";
import SampleChopper from "@/components/SampleChopper";
import ChordKeys from "@/components/ChordKeys";
import VocalRecorder from "@/components/VocalRecorder";
import BottomNav from "@/components/BottomNav";
import { PadMode } from "@/lib/types";

export default function Home() {
  const [mode, setMode] = useState<PadMode>("pads");

  return (
    <AudioProvider>
      <div className="flex flex-col h-screen overflow-hidden">
        <Transport />
        <main className="flex-1 overflow-hidden relative">
          {mode === "pads" && <PadGrid />}
          {mode === "chopper" && <SampleChopper />}
          {mode === "keys" && <ChordKeys />}
          {mode === "recorder" && <VocalRecorder />}
        </main>
        <BottomNav active={mode} onChange={setMode} />
      </div>
    </AudioProvider>
  );
}
