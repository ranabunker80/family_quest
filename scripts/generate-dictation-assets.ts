/**
 * generate-dictation-assets.ts
 * Genera el audio (ElevenLabs) y la ilustración (Gemini) de cada palabra del Reto de Dictado.
 * Se salta lo que ya existe.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... GEMINI_API_KEY=... npx tsx scripts/generate-dictation-assets.ts
 */
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { GoogleGenAI } from "@google/genai";
import { DICTATION_WORDS } from "../src/lib/dictation-data";

const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const AUDIO_DIR = path.join(process.cwd(), "public/audio/dictation");
const IMAGE_DIR = path.join(process.cwd(), "public/images/dictation");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateAudio(word: string, apiKey: string) {
    const outpath = path.join(AUDIO_DIR, `${word}.mp3`);
    if (fs.existsSync(outpath) && fs.statSync(outpath).size > 1000) return console.log(`SKIP audio ${word}`);

    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
        method: "POST",
        headers: { "Accept": "audio/mpeg", "Content-Type": "application/json", "xi-api-key": apiKey },
        body: JSON.stringify({
            text: `${word[0].toUpperCase()}${word.slice(1)}.`,
            model_id: "eleven_turbo_v2_5",
            language_code: "en", // palabras sueltas como "virus" o "factors" se leen en español sin esto
            voice_settings: { stability: 0.6, similarity_boost: 0.85, style: 0, use_speaker_boost: true, speed: 0.85 },
        }),
    });
    if (!resp.ok) return console.log(`  ERROR audio ${word} ${resp.status}: ${await resp.text()}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(outpath, buf);
    console.log(`  OK audio ${word} (${buf.length} bytes)`);
}

async function generateImage(word: string, scene: string, ai: GoogleGenAI) {
    const outpath = path.join(IMAGE_DIR, `${word}.jpg`);
    if (fs.existsSync(outpath) && fs.statSync(outpath).size > 5000) return console.log(`SKIP image ${word}`);

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: `A cute, colorful cartoon illustration for an 8-year-old child: ${scene}. Kid-friendly, flat design, vibrant colors, educational flashcard style, clean white background. Absolutely no text, letters or words in the image.`,
        config: { responseModalities: ["image", "text"] },
    });
    const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
    if (!part?.inlineData?.data) return console.log(`  ERROR image ${word}: no image in response`);

    const tmp = path.join(IMAGE_DIR, `${word}.tmp.png`);
    fs.writeFileSync(tmp, Buffer.from(part.inlineData.data, "base64"));
    // 640px JPEG: carga rápido en la tablet (macOS sips)
    execFileSync("sips", ["-Z", "640", "-s", "format", "jpeg", "-s", "formatOptions", "82", tmp, "--out", outpath], { stdio: "ignore" });
    fs.unlinkSync(tmp);
    console.log(`  OK image ${word} (${(fs.statSync(outpath).size / 1024).toFixed(0)}KB)`);
}

async function main() {
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
    fs.mkdirSync(IMAGE_DIR, { recursive: true });

    if (elevenKey) for (const { w } of DICTATION_WORDS) await generateAudio(w, elevenKey);
    else console.log("Sin ELEVENLABS_API_KEY: no se generan audios");

    if (geminiKey) {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        for (const { w, imagePrompt } of DICTATION_WORDS) {
            try { await generateImage(w, imagePrompt, ai); } catch (e: any) { console.log(`  ERROR image ${w}: ${e.message}`); }
            await sleep(3000);
        }
    } else console.log("Sin GEMINI_API_KEY: no se generan imágenes");
    console.log("Done!");
}

main();
