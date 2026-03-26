/**
 * Haptic/audio feedback system.
 * Android: navigator.vibrate()
 * iOS: Web Audio API chimes
 * All: visual feedback is handled by components
 */

type FeedbackType = "logged" | "timer" | "reminder";

const vibrationPatterns: Record<FeedbackType, number[]> = {
  logged: [50],
  reminder: [100],
  timer: [30, 50, 30],
};

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

const playChime = (frequency: number, duration: number, count = 1) => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    for (let i = 0; i < count; i += 1) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = frequency;

      gain.gain.setValueAtTime(0.15, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + duration);
    }
  } catch {
    /* Audio not available */
  }
};

const chimeConfigs: Record<
  FeedbackType,
  { count: number; dur: number; freq: number }
> = {
  logged: { count: 1, dur: 0.12, freq: 880 },
  reminder: { count: 1, dur: 0.2, freq: 520 },
  timer: { count: 2, dur: 0.1, freq: 660 },
};

const supportsVibration = (): boolean =>
  typeof navigator !== "undefined" && "vibrate" in navigator;

export const triggerFeedback = (type: FeedbackType) => {
  if (typeof window === "undefined") return;

  if (supportsVibration()) {
    navigator.vibrate(vibrationPatterns[type]);
  } else {
    const config = chimeConfigs[type];
    playChime(config.freq, config.dur, config.count);
  }
};
