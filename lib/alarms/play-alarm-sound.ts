let activeAudio: HTMLAudioElement | null = null;
let activePlaybackId = 0;
let loopTimer: number | null = null;

const CHIME_SRC = "/sounds/clock-chime.wav";
/** Replay the chime a couple times so it keeps attention like a clock. */
const CHIME_LOOPS = 2;
const LOOP_GAP_MS = 900;

function clearLoopTimer() {
  if (loopTimer !== null) {
    window.clearTimeout(loopTimer);
    loopTimer = null;
  }
}

export function stopAlarmSound() {
  activePlaybackId += 1;
  clearLoopTimer();
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // Ignore.
    }
    activeAudio = null;
  }
}

function playOnce(): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(CHIME_SRC);
    audio.preload = "auto";
    audio.volume = 0.9;
    activeAudio = audio;
    const done = () => {
      audio.removeEventListener("ended", done);
      audio.removeEventListener("error", done);
      if (activeAudio === audio) {
        activeAudio = null;
      }
      resolve();
    };
    audio.addEventListener("ended", done);
    audio.addEventListener("error", done);
    void audio.play().catch(() => {
      done();
    });
  });
}

/**
 * Soft chiming-clock alarm (Westminster-style motif from /sounds/clock-chime.wav).
 * Only plays while the app/PWA has an open client — closed-app uses the OS notification sound.
 */
export async function playAlarmSound() {
  if (typeof window === "undefined") {
    return;
  }
  const playbackId = ++activePlaybackId;
  clearLoopTimer();

  for (let i = 0; i < CHIME_LOOPS; i += 1) {
    if (playbackId !== activePlaybackId) {
      return;
    }
    await playOnce();
    if (playbackId !== activePlaybackId || i >= CHIME_LOOPS - 1) {
      return;
    }
    await new Promise<void>((resolve) => {
      loopTimer = window.setTimeout(() => {
        loopTimer = null;
        resolve();
      }, LOOP_GAP_MS);
    });
  }
}
