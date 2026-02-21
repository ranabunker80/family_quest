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

    // Play a tiny silent data-URI WAV to "unlock" the element
    sharedAudio.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCxAgAEABAAZGF0YQAAAAA=";
    const p = sharedAudio.play();
    if (p) p.catch(() => {});

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

    audioUnlocked = true;
  } catch {
    // Swallow — worst case audio stays locked and we fall back to Speech API
  }
}

/**
 * Play the pronunciation of a word.
 * Tries pre-generated audio first, falls back to Web Speech API.
 */
export function playWordAudio(word: string): void {
  const lower = word.toLowerCase();
  tryPlayFile(`/audio/words/${lower}.wav`, () => {
    tryPlayFile(`/audio/words/${lower}.mp3`, () => {
      fallbackSpeak(lower);
    });
  });
}

/**
 * Play a sound effect (success or error).
 */
export function playSfx(type: "success" | "error"): void {
  tryPlayFile(`/audio/sfx/${type}.wav`, () => {
    tryPlayFile(`/audio/sfx/${type}.mp3`, () => {
      // SFX are non-critical, silently fail
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
    // Audio never unlocked — go straight to fallback
    onError();
    return;
  }

  sharedAudio.pause();
  sharedAudio.currentTime = 0;
  sharedAudio.src = src;

  const handleError = () => {
    sharedAudio?.removeEventListener("error", handleError);
    onError();
  };

  sharedAudio.addEventListener("error", handleError, { once: true });

  const p = sharedAudio.play();
  if (p) p.catch(() => onError());
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
