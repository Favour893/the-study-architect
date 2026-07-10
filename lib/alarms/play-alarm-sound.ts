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

/** Soft bell / chime partial (sine + gentle decay). */
function chimePartial(
  ctx: AudioContext,
  startOffset: number,
  frequency: number,
  duration: number,
  peakGain: number,
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(peakGain * 0.35, t0 + duration * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(t0);
  oscillator.stop(t0 + duration + 0.05);
  activeOscillators.push(oscillator);
  oscillator.onended = () => {
    const index = activeOscillators.indexOf(oscillator);
    if (index >= 0) {
      activeOscillators.splice(index, 1);
    }
  };
}

/** One bell strike: fundamental + harmonics for a clock-chime character. */
function bellStrike(ctx: AudioContext, startOffset: number, fundamental: number) {
  chimePartial(ctx, startOffset, fundamental, 1.35, 0.28);
  chimePartial(ctx, startOffset, fundamental * 2.0, 1.1, 0.12);
  chimePartial(ctx, startOffset, fundamental * 2.76, 0.9, 0.07);
  chimePartial(ctx, startOffset, fundamental * 4.07, 0.7, 0.04);
}

const CYCLE_DURATION_SEC = 2.4;
const ALARM_CYCLES = 8;
/** Westminster-ish / alarm-clock chime notes (Hz). */
const CHIME_NOTES = [523.25, 659.25, 783.99, 1046.5];

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
    CHIME_NOTES.forEach((note, index) => {
      bellStrike(ctx, base + index * 0.42, note);
    });
  }
}
