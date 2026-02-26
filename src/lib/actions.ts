"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getMissions() {
    const supabase = await createClient();
    const { data } = await supabase.from("missions").select("*").eq("is_active", true).order("reward_amount", { ascending: true });
    return data || [];
}

export async function getRewards() {
    const supabase = await createClient();
    const { data } = await supabase.from("rewards").select("*").eq("is_active", true).order("cost", { ascending: true });
    return data || [];
}

export async function getKidHistory(kidId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("ledger")
        .select("*")
        .eq("kid_id", kidId)
        .order("created_at", { ascending: false })
        .limit(20);
    return data || [];
}

export async function getPendingApprovals() {
    const supabase = await createClient();
    // Get pending items and join with profiles to get kid name
    const { data } = await supabase
        .from("ledger")
        .select("*, profiles(full_name, avatar_url)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
    return data || [];
}

export async function submitMission(mission: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("ledger").insert({
        kid_id: user.id,
        amount: mission.reward_amount,
        description: `Misión: ${mission.title}`,
        type: "mission",
        status: "pending", // Always pending approval for now
    });

    if (!error) revalidatePath("/");
    return { error };
}

export async function redeemReward(reward: any, currentCoins: number) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (currentCoins < reward.cost) {
        return { error: { message: "No tienes suficientes monedas" } };
    }

    const { error } = await supabase.from("ledger").insert({
        kid_id: user.id,
        amount: -reward.cost, // Negative amount for spending
        description: `Canje: ${reward.title}`,
        type: "reward",
        status: "pending",
    });

    if (!error) revalidatePath("/");
    return { error };
}

export async function approveTransaction(id: string, kidId: string, amount: number) {
    const supabase = await createClient();

    // 1. Update ledger status
    const { error: ledgerError } = await supabase
        .from("ledger")
        .update({ status: "approved" })
        .eq("id", id);

    if (ledgerError) return { error: ledgerError };

    // 2. Update profile coins (RPC would be safer, but doing client-side for MVP speed)
    // First fetch current coins to be safe? Or just increment.
    // SQL increment is better: update profiles set coins = coins + amount where id = kidId
    // Supabase doesn't support easy increment via JS client without RPC usually, but let's try a fetch-update loop or simple increment if possible?
    // We'll stick to fetch-update for MVP simplicity.

    const { data: profile } = await supabase.from("profiles").select("coins").eq("id", kidId).single();
    if (profile) {
        await supabase.from("profiles").update({ coins: profile.coins + amount }).eq("id", kidId);
    }

    revalidatePath("/");
    return {};
}

export async function rejectTransaction(id: string) {
    const supabase = await createClient();
    await supabase.from("ledger").update({ status: "rejected" }).eq("id", id);
    revalidatePath("/");
}

export async function submitGameResult(score: number, difficulty: string, accuracy: number) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Log the game in ledger (Approved immediately)
    await supabase.from("ledger").insert({
        kid_id: user.id,
        amount: score,
        description: `Juego: Spelling Bee (${difficulty}) - ${accuracy}%`,
        type: "bonus",
        status: "approved",
    });

    // 2. Update profile coins
    const { data: profile } = await supabase.from("profiles").select("coins").eq("id", user.id).single();
    if (profile) {
        await supabase.from("profiles").update({ coins: profile.coins + score }).eq("id", user.id);
    }

    revalidatePath("/");
}

export async function submitMathResult(
    score: number,
    difficulty: string,
    accuracy: number,
    details?: {
        problemsCorrect: number;
        problemsTotal: number;
        timeSeconds: number;
        categoryBreakdown: Record<string, { correct: number; total: number }>;
    }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Log in ledger (coins, auto-approved)
    await supabase.from("ledger").insert({
        kid_id: user.id,
        amount: score,
        description: `Juego: Copa de Mates (${difficulty}) - ${accuracy}%`,
        type: "bonus",
        status: "approved",
    });

    // 2. Save to game_results for analytics
    await supabase.from("game_results").insert({
        kid_id: user.id,
        game_type: "math_contest",
        difficulty,
        score,
        accuracy,
        words_correct: details?.problemsCorrect ?? null,
        words_total: details?.problemsTotal ?? null,
        time_seconds: details?.timeSeconds ?? null,
        details: details?.categoryBreakdown ? JSON.stringify(details.categoryBreakdown) : null,
    });

    // 3. Update profile coins
    const { data: profile } = await supabase.from("profiles").select("coins").eq("id", user.id).single();
    if (profile) {
        await supabase.from("profiles").update({ coins: profile.coins + score }).eq("id", user.id);
    }

    revalidatePath("/");
}
