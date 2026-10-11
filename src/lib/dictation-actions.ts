"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DICTATION_LIST_ID, DICTATION_WORDS } from "@/lib/dictation-data";

// Se llama solo cuando el dictado final sale perfecto. El premio es la mitad de la
// tarjeta (se cobra con los papás), por eso no suma monedas.
export async function submitDictationResult(details: { timeSeconds: number; finalAttempts: number }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const total = DICTATION_WORDS.length;
    await supabase.from("game_results").insert({
        kid_id: user.id,
        game_type: "dictation_challenge",
        difficulty: DICTATION_LIST_ID,
        score: 0,
        accuracy: 100,
        words_correct: total,
        words_total: total,
        time_seconds: details.timeSeconds,
        details: { finalAttempts: details.finalAttempts },
    });

    revalidatePath("/dictation-challenge");
}
