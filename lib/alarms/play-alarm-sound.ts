let audioContext: AudioContext | null = null;
let activePlaybackId = 0;
const activeNodes: Array<AudioScheduledSourceNode> = [];

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function trackNode(node: AudioScheduledSourceNode) {
  activeNodes.push(node);
  node.onended = () => {
    const index = activeNodes.indexOf(node);
    if (index >= 0) {
      activeNodes.splice(index, 1);
    }
  };
}

/** Soft metallic partial with quick attack and long musical decay. */
function partial(
  ctx: AudioContext,
  startOffset: number,
  frequency: number,
  duration: number,
  peak: number,
  type: OscillatorType = "sine",
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(peak * 0.4, t0 + duration * 0.22);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(t0);
  oscillator.stop(t0 + duration + 0.02);
  trackNode(oscillator);
}

/** One captivating strike: deep bell + bright sparkle harmonics. */
function captivatingStrike(ctx: AudioContext, startOffset: number, fundamental: number, peak = 0.34) {
  partial(ctx, startOffset, fundamental, 1.65, peak, "sine");
  partial(ctx, startOffset, fundamental * 2.0, 1.25, peak * 0.42, "sine");
  partial(ctx, startOffset, fundamental * 2.76, 1.05, peak * 0.24, "triangle");
  partial(ctx, startOffset, fundamental * 4.07, 0.8, peak * 0.14, "triangle");
  partial(ctx, startOffset, fundamental * 5.43, 0.55, peak * 0.08, "sine");
}

/**
 * Captivating alarm motif: urgent paired rings that climb,
 * then a resolving major chime — like a premium clock that demands attention.
 */
const PAIR_GAP = 0.2;
const PAIR_SPACING = 0.88;
const CYCLE_DURATION_SEC = 3.4;
const ALARM_CYCLES = 7;
const RING_PAIRS = [
  [659.25, 830.61], // E5 / G#5
  [783.99, 987.77], // G5 / B5
  [880.0, 1108.73], // A5 / C#6
];

export function stopAlarmSound() {
  activePlaybackId += 1;
  for (const node of activeNodes.splice(0)) {
    try {
      node.stop();
      node.disconnect();
    } catch {
      // Already stopped.
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
    const intensity = 1 + cycle * 0.035;
    const peak = Math.min(0.42, 0.3 + cycle * 0.018);

    RING_PAIRS.forEach((pair, pairIndex) => {
      const pairStart = base + pairIndex * PAIR_SPACING;
      captivatingStrike(ctx, pairStart, pair[0]! * intensity, peak);
      captivatingStrike(ctx, pairStart + PAIR_GAP, pair[1]! * intensity, peak * 0.95);
    });

    // Resolving major triad chime (C–E–G) so each cycle feels finished but urgent.
    captivatingStrike(ctx, base + 2.75, 523.25 * intensity, peak * 0.85);
    captivatingStrike(ctx, base + 2.95, 659.25 * intensity, peak * 0.75);
    captivatingStrike(ctx, base + 3.15, 783.99 * intensity, peak * 0.9);
  }
}
