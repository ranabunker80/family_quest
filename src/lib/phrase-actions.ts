"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitPhraseResult(
    score: number,
    accuracy: number,
    details?: {
        levelsCompleted: number;
        perfectLevels: number;
        timeSeconds: number;
        levelScores: number[];
    }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Log in ledger (coins, auto-approved)
    await supabase.from("ledger").insert({
        kid_id: user.id,
        amount: score,
        description: `Juego: Phrase Challenge - ${accuracy}% (${details?.levelsCompleted ?? 0}/5 niveles)`,
        type: "bonus",
        status: "approved",
    });

    // 2. Save to game_results for analytics
    await supabase.from("game_results").insert({
        kid_id: user.id,
        game_type: "phrase_challenge",
        difficulty: "progressive",
        score,
        accuracy,
        words_correct: details?.perfectLevels ?? null,
        words_total: 5,
        time_seconds: details?.timeSeconds ?? null,
    });

    // 3. Update profile coins
    const { data: profile } = await supabase.from("profiles").select("coins").eq("id", user.id).single();
    if (profile) {
        await supabase.from("profiles").update({ coins: profile.coins + score }).eq("id", user.id);
    }

    revalidatePath("/");
}
