/**
 * Client-side audio utilities for Spelling Bee.
 * Plays pre-generated audio files (WAV/MP3) with Web Speech API fallback.
 */

let currentAudio: HTMLAudioElement | null = null;

/**
 * Try to play an audio file, trying WAV first then MP3.
 * Returns a promise that resolves on success or rejects on failure.
 */
function tryPlayAudio(basePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(`${basePath}.wav`);
    currentAudio = audio;

    audio.play().then(resolve).catch(() => {
      // Try MP3 fallback
      const mp3 = new Audio(`${basePath}.mp3`);
      currentAudio = mp3;
      mp3.play().then(resolve).catch(reject);
    });
  });
}

/**
 * Play the pronunciation of a word.
 * Tries pre-generated audio first, falls back to Web Speech API.
 */
export function playWordAudio(word: string): void {
  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  tryPlayAudio(`/audio/words/${word}`).catch(() => {
    fallbackSpeak(word);
  });
}

/**
 * Play a sound effect (success or error).
 */
export function playSfx(type: "success" | "error"): void {
  const audio = new Audio(`/audio/sfx/${type}.wav`);
  audio.volume = 0.5;
  audio.play().catch(() => {
    // Try MP3 fallback
    const mp3 = new Audio(`/audio/sfx/${type}.mp3`);
    mp3.volume = 0.5;
    mp3.play().catch(() => {
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

/**
 * Fallback: use Web Speech API to pronounce the word.
 */
function fallbackSpeak(word: string): void {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}
