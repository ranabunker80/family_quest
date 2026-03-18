// Phrase Challenge data — configurable per kid

export type PhraseConfig = {
  kidName: string;
  phraseText: string;
  phraseWords: string[];
  distractors: string[];
  blankSets: number[][];
  scrambleIndices: number[];
  audioDir: string;      // e.g. "/audio/phrase"
  imageDir: string;      // e.g. "/images/phrase"
  sceneImage: string;    // filename
  revealImage: string;   // filename
  diplomaImage: string;  // filename
  congratsFile: string;  // filename
};

// --- Isaac: "A season full of color and joy" ---
export const ISAAC_CONFIG: PhraseConfig = {
  kidName: "Isaac",
  phraseText: "A season full of color and joy",
  phraseWords: ["A", "season", "full", "of", "color", "and", "joy"],
  distractors: ["winter", "empty", "bright", "spring", "sadness"],
  blankSets: [
    [1, 4, 6], // season, color, joy
    [2, 4, 6], // full, color, joy
    [1, 2, 6], // season, full, joy
  ],
  scrambleIndices: [1, 2, 4, 6], // season, full, color, joy
  audioDir: "/audio/phrase",
  imageDir: "/images/phrase",
  sceneImage: "season-scene.png",
  revealImage: "season-scene-reveal.png",
  diplomaImage: "phrase-master-diploma.png",
  congratsFile: "congratulations.mp3",
};

// --- Elias: "We are celebrating spring" ---
export const ELIAS_CONFIG: PhraseConfig = {
  kidName: "Elias",
  phraseText: "We are celebrating spring",
  phraseWords: ["We", "are", "celebrating", "spring"],
  distractors: ["winter", "running", "autumn", "they"],
  blankSets: [
    [2, 3], // celebrating, spring
    [1, 2], // are, celebrating
    [1, 3], // are, spring
  ],
  scrambleIndices: [2, 3], // celebrating, spring
  audioDir: "/audio/phrase-elias",
  imageDir: "/images/phrase-elias",
  sceneImage: "spring-scene.png",
  revealImage: "spring-reveal.png",
  diplomaImage: "phrase-master-diploma.png",
  congratsFile: "congratulations.mp3",
};

export const LEVEL_CONFIG = [
  { id: 1, title: "Escucha y Descubre", emoji: "👂", maxPts: 20, desc: "Ordena las palabras" },
  { id: 2, title: "Completa la Frase", emoji: "✏️", maxPts: 25, desc: "Llena los espacios" },
  { id: 3, title: "Palabras Revueltas", emoji: "🔀", maxPts: 32, desc: "Desenreda las letras" },
  { id: 4, title: "Escribe de Memoria", emoji: "🧠", maxPts: 40, desc: "Escribe toda la frase" },
  { id: 5, title: "El Gran Final", emoji: "🏆", maxPts: 175, desc: "¡Contra reloj!" },
] as const;

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function scrambleWord(word: string): string {
  const letters = word.split("");
  let scrambled: string[];
  do {
    scrambled = shuffleArray(letters);
  } while (scrambled.join("") === word && word.length > 1);
  return scrambled.join("");
}
