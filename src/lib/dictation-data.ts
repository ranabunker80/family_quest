// Reto de Dictado — lista de palabras del examen de dictado de Isaac y Elias.
// Para un examen nuevo: cambiar DICTATION_LIST_ID y DICTATION_WORDS, y correr
// `npx tsx scripts/generate-dictation-assets.ts` para generar audios e imágenes.

export type DictationWord = {
    w: string;          // palabra en inglés (minúsculas)
    es: string;         // significado en español
    emoji: string;      // respaldo si la imagen no carga
    gaps: number[];     // índices de letras ocultas en la etapa 2
    imagePrompt: string; // escena para generar la ilustración
};

export const DICTATION_LIST_ID = "health-2026-10";
export const DICTATION_TITLE = "Health Words";

export const DICTATION_WORDS: DictationWord[] = [
    { w: "germs", es: "gérmenes", emoji: "🦠", gaps: [1, 3], imagePrompt: "a child looking through a big magnifying glass at tiny funny cartoon germs with little faces sitting on a dirty hand" },
    { w: "virus", es: "virus", emoji: "🤧", gaps: [1, 3], imagePrompt: "one big round spiky cartoon virus with a mischievous face floating in the air next to a child who is sneezing into a tissue" },
    { w: "healthy", es: "saludable", emoji: "💪", gaps: [1, 2, 5], imagePrompt: "a happy strong child smiling and flexing an arm, surrounded by fresh fruits, vegetables and a glass of water" },
    { w: "factors", es: "factores", emoji: "🧩", gaps: [2, 4, 5], imagePrompt: "a smiling child in the center with four arrows pointing at the child from four small pictures around: an apple, a bed with a moon, a soccer ball and a bar of soap" },
    { w: "unhealthy", es: "no saludable", emoji: "🍟", gaps: [3, 4, 7], imagePrompt: "a tired child slumped on a couch with a tummy ache, surrounded by soda, french fries, candy and donuts" },
    { w: "choice", es: "elección", emoji: "🤔", gaps: [2, 3, 4], imagePrompt: "a thinking child standing where a path splits in two, one path leads to a big red apple and the other path leads to a big pink donut" },
    { w: "hygiene", es: "higiene", emoji: "🧼", gaps: [1, 3, 4], imagePrompt: "a cheerful child washing hands with lots of soap bubbles at a sink, with a toothbrush and a towel nearby" },
    { w: "exercise", es: "ejercicio", emoji: "🏃", gaps: [1, 4, 6], imagePrompt: "three happy children exercising outdoors: one running, one jumping rope and one kicking a soccer ball" },
    { w: "vaccinations", es: "vacunas", emoji: "💉", gaps: [2, 3, 7, 8, 9], imagePrompt: "a friendly smiling doctor putting a small colorful bandage on the arm of a brave smiling child after a vaccine, a small syringe resting on a tray" },
    { w: "caused", es: "causó", emoji: "➡️", gaps: [1, 2, 4], imagePrompt: "two scenes side by side joined by one big arrow: on the left a child jumping in rain puddles without a coat, on the right the same child in bed with a cold and a thermometer" },
    { w: "lifestyle", es: "estilo de vida", emoji: "🌞", gaps: [3, 6, 8], imagePrompt: "a circle of four small scenes of the same child's day: sleeping well in bed, eating a healthy breakfast, riding a bicycle, and brushing teeth" },
];

export const dictationAudioPath = (w: string) => `/audio/dictation/${w}.mp3`;
export const dictationImagePath = (w: string) => `/images/dictation/${w}.jpg`;
