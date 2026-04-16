"use client";

import { useCallback, useEffect, useRef } from "react";

const BAR_COUNT = 20;
const MIN_HEIGHT = 3;
const MAX_HEIGHT = 20;
const BAR_IDS = Array.from({ length: BAR_COUNT }, (_, i) => `bar-${String(i)}`);

/**
 * Animated waveform bars driven by an AnalyserNode.
 * Heights update via RAF for smooth 60fps animation.
 */
export const AudioWaveform = ({
  analyser,
  className = "",
}: {
  analyser: AnalyserNode | null;
  className?: string;
}) => {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);

  const setBarRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      barsRef.current[index] = el;
    },
    []
  );

  useEffect(() => {
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const step = Math.max(1, Math.floor(dataArray.length / BAR_COUNT));

    const animate = () => {
      analyser.getByteFrequencyData(dataArray);

      for (let i = 0; i < BAR_COUNT; i += 1) {
        const bar = barsRef.current[i];
        if (!bar) continue;
        const value = dataArray[i * step] / 255;
        const height = Math.max(MIN_HEIGHT, value * MAX_HEIGHT);
        bar.style.height = `${height}px`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [analyser]);

  return (
    <div
      className={`flex items-center gap-[2px] ${className}`}
      style={{ height: MAX_HEIGHT }}
    >
      {BAR_IDS.map((id, i) => (
        <div
          className="w-[3px] rounded-full bg-primary-400 transition-[height] duration-75"
          key={id}
          ref={setBarRef(i)}
          style={{ height: MIN_HEIGHT }}
        />
      ))}
    </div>
  );
};
