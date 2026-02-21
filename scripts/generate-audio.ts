/**
 * generate-audio.ts
 * One-time script to generate WAV pronunciation files for all Spelling Bee words.
 * Uses Gemini 2.5 Flash TTS (free tier: 3 requests/min).
 *
 * Prerequisites:
 *   - Set GEMINI_API_KEY env var
 *   - npm install @google/genai
 *
 * Usage:
 *   npx tsx scripts/generate-audio.ts
 */

import * as fs from "fs";
import * as path from "path";
import { GoogleGenAI } from "@google/genai";

import { CATEGORIES } from "../src/lib/words";

const OUTPUT_DIR = path.join(__dirname, "..", "public", "audio", "words");
const SFX_DIR = path.join(__dirname, "..", "public", "audio", "sfx");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Track last API call time globally to enforce rate limiting
let lastCallTime = 0;
const MIN_INTERVAL = 7000; // TTS model: ~10 RPM even with billing

async function waitForRateLimit() {
  const elapsed = Date.now() - lastCallTime;
  if (elapsed < MIN_INTERVAL) {
    const wait = MIN_INTERVAL - elapsed;
    await sleep(wait);
  }
  lastCallTime = Date.now();
}

async function callTTS(ai: GoogleGenAI, text: string): Promise<Buffer | null> {
  await waitForRateLimit();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: text,
    config: {
      responseModalities: ["audio"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Kore",
          },
        },
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) return null;

  for (const part of parts) {
    if (part.inlineData && part.inlineData.mimeType?.startsWith("audio/")) {
      return Buffer.from(part.inlineData.data!, "base64");
    }
  }
  return null;
}

async function generateOne(
  ai: GoogleGenAI,
  text: string,
  outputPath: string,
  label: string
): Promise<boolean> {
  try {
    const audioBuffer = await callTTS(ai, text);
    if (audioBuffer) {
      fs.writeFileSync(outputPath, audioBuffer);
      console.log(
        `  ✅ ${label} (${(audioBuffer.length / 1024).toFixed(1)}KB)`
      );
      return true;
    }
    console.error(`  ❌ No audio for ${label}`);
    return false;
  } catch (error: any) {
    const msg =
      typeof error?.message === "string"
        ? error.message
        : JSON.stringify(error);

    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
      console.log(`  ⏳ Rate limited on ${label} - waiting 65s...`);
      await sleep(65000); // Wait full minute + buffer
      lastCallTime = 0; // Reset rate limiter

      // Single retry
      try {
        lastCallTime = Date.now();
        const audioBuffer = await callTTS(ai, text);
        if (audioBuffer) {
          fs.writeFileSync(outputPath, audioBuffer);
          console.log(`  ✅ ${label} (retry OK, ${(audioBuffer.length / 1024).toFixed(1)}KB)`);
          return true;
        }
      } catch {
        // Give up on this word
      }
    }

    console.error(`  ❌ Failed ${label}: ${msg.slice(0, 120)}`);
    return false;
  }
}

async function main() {
  console.log("🔊 Spelling Bee Audio Generator (Gemini TTS)\n");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ Set GEMINI_API_KEY environment variable");
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(SFX_DIR, { recursive: true });

  // Collect all unique words
  const allWords = new Set<string>();
  for (const cat of Object.values(CATEGORIES)) {
    for (const word of cat.words) {
      allWords.add(word);
    }
  }

  // Build full task list: words + SFX
  type Task = { text: string; outputPath: string; label: string };
  const tasks: Task[] = [];

  for (const word of allWords) {
    tasks.push({
      text: word,
      outputPath: path.join(OUTPUT_DIR, `${word}.wav`),
      label: `"${word}"`,
    });
  }

  tasks.push({
    text: "Correct!",
    outputPath: path.join(SFX_DIR, "success.wav"),
    label: 'SFX "success"',
  });
  tasks.push({
    text: "Try again!",
    outputPath: path.join(SFX_DIR, "error.wav"),
    label: 'SFX "error"',
  });

  const pending = tasks.filter((t) => !fs.existsSync(t.outputPath));
  const done = tasks.length - pending.length;

  console.log(`📝 ${tasks.length} total, ${done} done, ${pending.length} pending`);
  if (pending.length === 0) {
    console.log("🎉 All audio already generated!");
    return;
  }

  const estimatedMin = Math.ceil((pending.length * 21) / 60);
  console.log(`⏱  Estimated time: ~${estimatedMin} minutes\n`);

  const ai = new GoogleGenAI({ apiKey });

  let generated = 0;
  let consecutiveFails = 0;

  for (let i = 0; i < pending.length; i++) {
    const task = pending[i];
    const progress = `[${i + 1}/${pending.length}]`;

    process.stdout.write(`${progress} `);
    const success = await generateOne(ai, task.text, task.outputPath, task.label);

    if (success) {
      generated++;
      consecutiveFails = 0;
    } else {
      consecutiveFails++;
      if (consecutiveFails >= 5) {
        console.log("\n⚠️  5 consecutive failures. Re-run later.");
        break;
      }
    }
  }

  const totalDone = tasks.filter((t) => fs.existsSync(t.outputPath)).length;
  console.log(
    `\n🎉 Session: +${generated} new. Total: ${totalDone}/${tasks.length}`
  );
  if (totalDone < tasks.length) {
    console.log("💡 Re-run to generate the rest.");
  }
}

main().catch(console.error);
