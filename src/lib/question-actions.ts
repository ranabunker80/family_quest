"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface FamilyQuestion {
    id: string;
    topic: string;
    prompt: string;
    options: string[];
    position: number;
    answer: string | null;
    answered_at: string | null;
    created_at: string;
}

// Si pasó más de esto desde la última respuesta, es una sesión nueva y sí se avisa.
const NOTIFY_GAP_MS = 30 * 60 * 1000;

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Aviso a papá por Telegram. Sin las variables de entorno no hace nada.
async function notifyParent(text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        });
    } catch { /* el aviso no debe impedir que se guarde la respuesta */ }
}

export async function getFamilyQuestions(): Promise<FamilyQuestion[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("family_questions")
        .select("id, topic, prompt, options, position, answer, answered_at, created_at")
        .order("created_at", { ascending: false })
        .order("position", { ascending: true });
    return (data as FamilyQuestion[]) || [];
}

export async function answerFamilyQuestion(questionId: string, answer: string) {
    const clean = answer.trim();
    if (!clean) return { error: "Escribe una respuesta" };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Tu sesión terminó. Vuelve a entrar." };

    const { data: lastAnswer } = await supabase
        .from("family_questions")
        .select("answered_at")
        .not("answered_at", "is", null)
        .order("answered_at", { ascending: false })
        .limit(1);

    // RLS deja escribir solo a los papás: a cualquier otro le regresa cero filas.
    const { data: saved, error } = await supabase
        .from("family_questions")
        .update({ answer: clean, answered_by: user.id, answered_at: new Date().toISOString() })
        .eq("id", questionId)
        .select("topic");
    if (error || !saved?.length) return { error: "No se pudo guardar. Intenta de nuevo." };

    const { count: pending } = await supabase
        .from("family_questions")
        .select("id", { count: "exact", head: true })
        .is("answer", null);
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    const name = escapeHtml(profile?.full_name || "Un papá");
    const topic = escapeHtml(saved[0].topic);

    const previous = lastAnswer?.[0]?.answered_at;
    const isNewSession = !previous || Date.now() - new Date(previous).getTime() > NOTIFY_GAP_MS;
    if (pending === 0) {
        await notifyParent(`✅ <b>${name} terminó las preguntas</b>\n\n${topic}. Ya no queda ninguna pendiente.`);
    } else if (isNewSession) {
        await notifyParent(`❓ <b>${name} empezó a contestar</b>\n\n${topic}. Quedan ${pending} pendientes.`);
    }

    revalidatePath("/parent");
    return { error: null };
}
