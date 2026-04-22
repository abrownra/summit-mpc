"use client";

import { PadMode } from "@/lib/types";

const TABS: { id: PadMode; label: string; icon: string }[] = [
  { id: "pads", label: "PADS", icon: "⬛" },
  { id: "chopper", label: "CHOP", icon: "✂️" },
  { id: "keys", label: "KEYS", icon: "🎹" },
  { id: "recorder", label: "REC", icon: "🎙" },
];

interface Props {
  active: PadMode;
  onChange: (mode: PadMode) => void;
}

export default function BottomNav({ active, onChange }: Props) {
  return (
    <div className="flex border-t border-[var(--border)] bg-[var(--surface)] safe-area-pb">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
            active === tab.id
              ? "text-[var(--accent)]"
              : "text-gray-600"
          }`}
        >
          <span className="text-lg leading-none">{tab.icon}</span>
          <span className="text-[9px] tracking-wider font-bold">{tab.label}</span>
          {active === tab.id && (
            <div className="absolute bottom-0 h-0.5 w-8 bg-[var(--accent)] rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
