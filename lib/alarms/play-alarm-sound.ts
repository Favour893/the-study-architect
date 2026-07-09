let audioContext: AudioContext | null = null;
let activePlaybackId = 0;
const activeOscillators: OscillatorNode[] = [];

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function beep(ctx: AudioContext, startOffset: number, frequency: number, duration: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + startOffset);
  gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + startOffset + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startOffset + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(ctx.currentTime + startOffset);
  oscillator.stop(ctx.currentTime + startOffset + duration + 0.05);
  activeOscillators.push(oscillator);
  oscillator.onended = () => {
    const index = activeOscillators.indexOf(oscillator);
    if (index >= 0) {
      activeOscillators.splice(index, 1);
    }
  };
}

const CYCLE_DURATION_SEC = 1.5;
const ALARM_CYCLES = 12;

export function stopAlarmSound() {
  activePlaybackId += 1;
  for (const oscillator of activeOscillators.splice(0)) {
    try {
      oscillator.stop();
      oscillator.disconnect();
    } catch {
      // Oscillator may already be stopped.
    }
  }
  if (audioContext && audioContext.state !== "closed") {
    void audioContext.close();
    audioContext = null;
  }
}

export async function playAlarmSound() {
  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const playbackId = ++activePlaybackId;

  for (let cycle = 0; cycle < ALARM_CYCLES; cycle += 1) {
    if (playbackId !== activePlaybackId) {
      return;
    }
    const base = cycle * CYCLE_DURATION_SEC;
    beep(ctx, base, 880, 0.35);
    beep(ctx, base + 0.38, 988, 0.35);
    beep(ctx, base + 0.76, 880, 0.35);
    beep(ctx, base + 1.14, 988, 0.45);
  }
}
