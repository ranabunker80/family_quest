"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitHairStudioResult(
  score: number,
  details?: {
    photosCount: number;
    colorsUsed: number;
    timeSeconds: number;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // 1. Log in ledger (auto-approved)
  await supabase.from("ledger").insert({
    kid_id: user.id,
    amount: score,
    description: `Juego: Hair Studio - ${details?.photosCount ?? 0} fotos`,
    type: "bonus",
    status: "approved",
  });

  // 2. Save to game_results for analytics
  await supabase.from("game_results").insert({
    kid_id: user.id,
    game_type: "hair_studio",
    difficulty: "free_play",
    score,
    accuracy: 100,
    words_correct: details?.photosCount ?? null,
    words_total: details?.colorsUsed ?? null,
    time_seconds: details?.timeSeconds ?? null,
  });

  // 3. Update profile coins
  const { data: profile } = await supabase
    .from("profiles")
    .select("coins")
    .eq("id", user.id)
    .single();
  if (profile) {
    await supabase
      .from("profiles")
      .update({ coins: profile.coins + score })
      .eq("id", user.id);
  }

  revalidatePath("/");
}
