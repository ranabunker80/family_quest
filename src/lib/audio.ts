/**
 * Client-side audio utilities for Spelling Bee.
 * Plays pre-generated audio files (WAV/MP3) with Web Speech API fallback.
 *
 * Mobile browsers (iOS Safari, Chrome Android) block audio.play()
 * unless it originates from a direct user interaction (tap/click).
 * We "unlock" audio by playing a silent buffer on the first tap,
 * then all subsequent programmatic plays work fine.
 */

let audioUnlocked = false;
let sharedAudio: HTMLAudioElement | null = null;
let audioReady: Promise<void> = Promise.resolve();

/**
 * Must be called from a direct user interaction (click/tap handler).
 * Creates a shared HTMLAudioElement and plays a silent source to
 * satisfy the browser's autoplay policy.
 */
export function unlockAudio(): void {
  if (audioUnlocked) return;

  try {
    sharedAudio = new Audio();
    sharedAudio.volume = 1;

    // Play a tiny silent data-URI WAV to "unlock" the element.
    // We track completion via audioReady so playWordAudio waits
    // for the unlock to finish before changing src.
    sharedAudio.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCxAgAEABAAZGF0YQAAAAA=";

    audioReady = new Promise<void>((resolve) => {
      const done = () => { audioUnlocked = true; resolve(); };
      const p = sharedAudio!.play();
      if (p) p.then(done).catch(done);
      else done();
    });

    // Also unlock an AudioContext (needed on some iOS versions)
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
      if (ctx.state === "suspended") ctx.resume();
    }
  } catch {
    audioUnlocked = true;
    audioReady = Promise.resolve();
  }
}

/**
 * Play the pronunciation of a word.
 * Waits for unlock to complete, then tries WAV → MP3 → Web Speech API.
 */
export function playWordAudio(word: string): void {
  const lower = word.toLowerCase();
  audioReady.then(() => {
    tryPlayFile(`/audio/words/${lower}.wav`, () => {
      tryPlayFile(`/audio/words/${lower}.mp3`, () => {
        fallbackSpeak(lower);
      });
    });
  });
}

/**
 * Play a sound effect (success or error).
 */
export function playSfx(type: "success" | "error"): void {
  audioReady.then(() => {
    tryPlayFile(`/audio/sfx/${type}.wav`, () => {
      tryPlayFile(`/audio/sfx/${type}.mp3`, () => {
        // SFX are non-critical, silently fail
      });
    });
  });
}

/**
 * Preload the audio file for a word (call ahead for zero latency).
 */
export function preloadWordAudio(word: string): void {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "audio";
  link.href = `/audio/words/${word}.wav`;
  document.head.appendChild(link);
}

// ---- internal helpers ----

function tryPlayFile(src: string, onError: () => void): void {
  if (!sharedAudio) {
    onError();
    return;
  }

  // Guard against double-invocation: both the "error" event and
  // play().catch() can fire when a file doesn't exist.
  let handled = false;
  const handleOnce = () => {
    if (handled) return;
    handled = true;
    sharedAudio?.removeEventListener("error", handleOnce);
    onError();
  };

  sharedAudio.pause();
  sharedAudio.currentTime = 0;
  sharedAudio.src = src;

  sharedAudio.addEventListener("error", handleOnce, { once: true });

  const p = sharedAudio.play();
  if (p) p.catch(handleOnce);
}

/**
 * Fallback: use Web Speech API to pronounce the word.
 */
function fallbackSpeak(word: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

/**
 * Play a custom audio file from any path with Web Speech API fallback.
 */
export function playCustomAudio(path: string, fallbackText?: string): void {
  audioReady.then(() => {
    tryPlayFile(path, () => {
      if (fallbackText) fallbackSpeak(fallbackText);
    });
  });
}

/**
 * Pronounce a single letter name in English (e.g. "A" → "ay", "B" → "bee").
 * Uses Web Speech API — no audio files needed.
 * Cancels any pending speech to avoid queue buildup on fast typing.
 */
export function playLetterAudio(letter: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(letter.toUpperCase());
  utterance.lang = "en-US";
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}
