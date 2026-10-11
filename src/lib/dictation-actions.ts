"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DICTATION_LIST_ID, DICTATION_TITLE, DICTATION_WORDS } from "@/lib/dictation-data";

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Aviso a papá por Telegram. Sin las variables de entorno no hace nada.
async function notifyParent(kidName: string, extra: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const total = DICTATION_WORDS.length;
    const text = `🏆 <b>${escapeHtml(kidName)} logró el Reto de Dictado</b>\n\n${total} de ${total} palabras bien (${DICTATION_TITLE}). Ya tiene su mitad de la tarjeta de Robux.${extra ? `\n\n${extra}` : ""}`;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        });
    } catch { /* el aviso no debe tumbar el juego */ }
}

// Se llama solo cuando el dictado final sale perfecto. El premio es la mitad de la
// tarjeta (se cobra con los papás), por eso no suma monedas.
export async function submitDictationResult(details: { timeSeconds: number; finalAttempts: number }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const total = DICTATION_WORDS.length;
    const { error } = await supabase.from("game_results").insert({
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

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    const minutes = Math.max(1, Math.round(details.timeSeconds / 60));
    await notifyParent(
        profile?.full_name || user.email || "Uno de los niños",
        `Dictados finales: ${details.finalAttempts} · Tiempo: ${minutes} min${error ? "\n\n⚠️ No se pudo guardar el resultado en la base." : ""}`
    );

    revalidatePath("/dictation-challenge");
}

// Para quien ganó antes de que existiera el aviso: el juego lo llama una vez al abrirse.
// Se verifica contra la base, no se confía en el cliente.
export async function notifyExistingDictationWin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: wins } = await supabase
        .from("game_results")
        .select("created_at")
        .eq("kid_id", user.id)
        .eq("game_type", "dictation_challenge")
        .eq("difficulty", DICTATION_LIST_ID)
        .eq("accuracy", 100)
        .order("created_at", { ascending: true })
        .limit(1);
    if (!wins?.[0]) return;

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    const when = new Date(wins[0].created_at).toLocaleString("es-MX", { timeZone: "America/Monterrey", weekday: "long", hour: "2-digit", minute: "2-digit" });
    await notifyParent(profile?.full_name || user.email || "Uno de los niños", `Lo logró el ${when}.`);
}
