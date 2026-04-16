"use client";

const BAR_COUNT = 16;
const BAR_IDS = Array.from({ length: BAR_COUNT }, (_, i) => `bar-${String(i)}`);

/**
 * Decorative animated waveform bars.
 *
 * NOT driven by real audio — that would require a second getUserMedia
 * stream which competes with SpeechRecognition's internal mic capture
 * and silently breaks transcription on most browsers.
 */
export const AudioWaveform = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-[2px] ${className}`}>
    {BAR_IDS.map((id, i) => (
      <div
        className="w-[3px] animate-waveform rounded-full bg-primary-400"
        key={id}
        style={{
          animationDelay: `${(i % 8) * 80}ms`,
        }}
      />
    ))}
  </div>
);
