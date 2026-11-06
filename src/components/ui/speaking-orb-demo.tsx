"use client";

import * as React from "react";
import SpeakingOrb, { SpeakingOrbHandle } from "@/components/ui/speaking-orb";

export default function SpeakingOrbDemo() {
  const ref = React.useRef<SpeakingOrbHandle>(null);

  const talk = (text: string) => {
    ref.current?.say(text);
  };

  return (
    <div className="flex w-full flex-col items-center gap-5 bg-[#07070c] p-10 text-[#f4f1fa]">
      <div className="w-full max-w-[380px]">
        <SpeakingOrb ref={ref} state="listening" level={0.3} />
      </div>
      <button
        type="button"
        onClick={() =>
          talk(
            "Good morning. You have three meetings today. The first one moved to ten.",
          )
        }
        className="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-[#f4f1fa] transition-colors hover:bg-white/10"
      >
        Speak
      </button>
    </div>
  );
}
