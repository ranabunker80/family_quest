/**
 * generate-images.ts
 * One-time script to generate cartoon illustrations for all Spelling Bee words.
 * Uses Google Gemini API image generation (free tier: ~50-100 requests/day).
 *
 * Prerequisites:
 *   - Set GEMINI_API_KEY env var
 *   - npm install @google/generative-ai
 *
 * Usage:
 *   npx tsx scripts/generate-images.ts
 *
 * Note: Due to free tier limits (~50-100/day), this may need to run over 1-2 days.
 *       It skips already-generated images, so just re-run until all are done.
 */

import * as fs from "fs";
import * as path from "path";
import { GoogleGenAI } from "@google/genai";

import { CATEGORIES } from "../src/lib/words";

const OUTPUT_DIR = path.join(__dirname, "..", "public", "images", "words");

const PROMPT_TEMPLATE = (word: string) =>
  `A cute, colorful cartoon illustration of a ${word} on a clean white background. Kid-friendly, flat design, vibrant colors, educational flashcard style. No text.`;

// Delay between requests to respect rate limits (ms)
const DELAY_MS = 5000;

async function generateImage(
  ai: GoogleGenAI,
  word: string
): Promise<boolean> {
  const outputPath = path.join(OUTPUT_DIR, `${word}.png`);

  // Skip if already generated
  if (fs.existsSync(outputPath)) {
    console.log(`  ⏭  Skipping "${word}" (already exists)`);
    return true;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: PROMPT_TEMPLATE(word),
      config: {
        responseModalities: ["image", "text"],
      },
    });

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      console.error(`  ❌ No response parts for "${word}"`);
      return false;
    }

    for (const part of parts) {
      if (part.inlineData && part.inlineData.mimeType?.startsWith("image/")) {
        const imageBuffer = Buffer.from(part.inlineData.data!, "base64");
        fs.writeFileSync(outputPath, imageBuffer);
        console.log(`  ✅ Generated "${word}" (${(imageBuffer.length / 1024).toFixed(1)}KB)`);
        return true;
      }
    }

    console.error(`  ❌ No image in response for "${word}"`);
    return false;
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : JSON.stringify(error);

    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
      console.log(`  ⏳ Rate limited on "${word}" - waiting 65s...`);
      await new Promise((r) => setTimeout(r, 65000));
    }
    console.error(`  ❌ Error for "${word}":`, msg.slice(0, 150));
    return false;
  }
}

async function main() {
  console.log("🎨 Spelling Bee Image Generator\n");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ Set GEMINI_API_KEY environment variable");
    process.exit(1);
  }

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Collect all unique words
  const allWords = new Set<string>();
  for (const cat of Object.values(CATEGORIES)) {
    for (const word of cat.words) {
      allWords.add(word);
    }
  }

  const wordList = Array.from(allWords);
  const alreadyDone = wordList.filter((w) =>
    fs.existsSync(path.join(OUTPUT_DIR, `${w}.png`))
  ).length;

  console.log(
    `📝 ${wordList.length} total words, ${alreadyDone} already generated, ${wordList.length - alreadyDone} remaining\n`
  );

  if (alreadyDone === wordList.length) {
    console.log("🎉 All images already generated!");
    return;
  }

  // Initialize Gemini client
  const ai = new GoogleGenAI({ apiKey });

  let generated = 0;
  let failed = 0;

  for (const word of wordList) {
    const success = await generateImage(ai, word);

    if (!success && !fs.existsSync(path.join(OUTPUT_DIR, `${word}.png`))) {
      failed++;
      // If rate limited, stop early
      if (failed > 3) {
        console.log(
          "\n⚠️  Multiple failures - stopping. Re-run script later to continue."
        );
        break;
      }
    } else {
      generated++;
      failed = 0; // Reset consecutive failures
    }

    // Delay between requests
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const totalDone = wordList.filter((w) =>
    fs.existsSync(path.join(OUTPUT_DIR, `${w}.png`))
  ).length;

  console.log(`\n🎉 Session done! ${totalDone}/${wordList.length} images generated total`);
  if (totalDone < wordList.length) {
    console.log("💡 Re-run the script to generate remaining images.");
  }
}

main().catch(console.error);
