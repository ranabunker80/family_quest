"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================================
// Family Members
// ============================================================================

export async function getKidsForParent(parentId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("family_members")
        .select("kid_id, profiles!family_members_kid_id_fkey(id, full_name, avatar_url, coins)")
        .eq("parent_id", parentId);
    return data || [];
}

// ============================================================================
// Kid Stats (resumen para dashboard)
// ============================================================================

export async function getKidStats(kidId: string) {
    const supabase = await createClient();

    // Ejecutar queries en paralelo
    const [profileRes, recentGamesRes, weekMissionsRes] = await Promise.all([
        // 1. Perfil del kid (coins, nombre)
        supabase
            .from("profiles")
            .select("id, full_name, avatar_url, coins")
            .eq("id", kidId)
            .single(),

        // 2. Últimos 5 juegos
        supabase
            .from("game_results")
            .select("id, game_type, difficulty, score, accuracy, created_at")
            .eq("kid_id", kidId)
            .order("created_at", { ascending: false })
            .limit(5),

        // 3. Misiones completadas esta semana (ledger entries aprobadas tipo mission)
        supabase
            .from("ledger")
            .select("id, description, amount, created_at")
            .eq("kid_id", kidId)
            .eq("type", "mission")
            .eq("status", "approved")
            .gte("created_at", getWeekStart().toISOString())
            .order("created_at", { ascending: false }),
    ]);

    return {
        profile: profileRes.data,
        recentGames: recentGamesRes.data || [],
        weekMissions: weekMissionsRes.data || [],
    };
}

// ============================================================================
// Parent Notes
// ============================================================================

export async function createParentNote(data: {
    kidId: string | null;
    content: string;
    isPinned?: boolean;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: "No autenticado" } };

    const { error } = await supabase.from("parent_notes").insert({
        author_id: user.id,
        kid_id: data.kidId,
        content: data.content,
        is_pinned: data.isPinned ?? false,
    });

    if (!error) revalidatePath("/");
    return { error };
}

export async function getParentNotes(kidId?: string) {
    const supabase = await createClient();

    let query = supabase
        .from("parent_notes")
        .select("*, profiles!parent_notes_author_id_fkey(full_name, avatar_url)")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

    if (kidId) {
        query = query.eq("kid_id", kidId);
    }

    const { data } = await query.limit(50);
    return data || [];
}

export async function updateParentNote(noteId: string, updates: {
    content?: string;
    isPinned?: boolean;
}) {
    const supabase = await createClient();
    const updateData: Record<string, unknown> = {};
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.isPinned !== undefined) updateData.is_pinned = updates.isPinned;

    const { error } = await supabase
        .from("parent_notes")
        .update(updateData)
        .eq("id", noteId);

    if (!error) revalidatePath("/");
    return { error };
}

export async function deleteParentNote(noteId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("parent_notes")
        .delete()
        .eq("id", noteId);

    if (!error) revalidatePath("/");
    return { error };
}

// ============================================================================
// Educational Content
// ============================================================================

export async function uploadEducationalContent(data: {
    title: string;
    contentType: "word_list" | "pdf" | "image" | "manual";
    subject?: string;
    targetKidId?: string | null;
    data: Record<string, unknown>;
    fileUrl?: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: "No autenticado" } };

    const { error } = await supabase.from("educational_content").insert({
        uploaded_by: user.id,
        title: data.title,
        content_type: data.contentType,
        subject: data.subject ?? null,
        target_kid_id: data.targetKidId ?? null,
        data: data.data,
        file_url: data.fileUrl ?? null,
    });

    if (!error) revalidatePath("/");
    return { error };
}

export async function getEducationalContent(filters?: {
    kidId?: string;
    contentType?: string;
    activeOnly?: boolean;
}) {
    const supabase = await createClient();

    let query = supabase
        .from("educational_content")
        .select("*, profiles!educational_content_uploaded_by_fkey(full_name)")
        .order("created_at", { ascending: false });

    if (filters?.kidId) {
        // Contenido para este kid O para todos (target_kid_id IS NULL)
        query = query.or(`target_kid_id.eq.${filters.kidId},target_kid_id.is.null`);
    }
    if (filters?.contentType) {
        query = query.eq("content_type", filters.contentType);
    }
    if (filters?.activeOnly !== false) {
        query = query.eq("is_active", true);
    }

    const { data } = await query.limit(100);
    return data || [];
}

// ============================================================================
// Focus Areas
// ============================================================================

export async function setFocusArea(data: {
    kidId: string;
    category: string;
    priority?: number;
    weekStart: string; // ISO date string YYYY-MM-DD
    weekEnd: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: "No autenticado" } };

    const { error } = await supabase.from("focus_areas").insert({
        set_by: user.id,
        kid_id: data.kidId,
        category: data.category,
        priority: data.priority ?? 1,
        week_start: data.weekStart,
        week_end: data.weekEnd,
    });

    if (!error) revalidatePath("/");
    return { error };
}

export async function getFocusAreas(kidId: string, currentWeekOnly?: boolean) {
    const supabase = await createClient();

    let query = supabase
        .from("focus_areas")
        .select("*, profiles!focus_areas_set_by_fkey(full_name)")
        .eq("kid_id", kidId)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false });

    if (currentWeekOnly) {
        const today = new Date().toISOString().split("T")[0];
        query = query.lte("week_start", today).gte("week_end", today);
    }

    const { data } = await query;
    return data || [];
}

export async function deleteFocusArea(focusAreaId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("focus_areas")
        .delete()
        .eq("id", focusAreaId);

    if (!error) revalidatePath("/");
    return { error };
}

// ============================================================================
// Game Results (historial detallado)
// ============================================================================

export async function getKidGameHistory(kidId: string, gameType?: string) {
    const supabase = await createClient();

    let query = supabase
        .from("game_results")
        .select("*")
        .eq("kid_id", kidId)
        .order("created_at", { ascending: false });

    if (gameType) {
        query = query.eq("game_type", gameType);
    }

    const { data } = await query.limit(50);
    return data || [];
}

export async function getKidGameStats(kidId: string) {
    const supabase = await createClient();

    // Últimos 7 días de juegos para calcular tendencias
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data } = await supabase
        .from("game_results")
        .select("game_type, difficulty, score, accuracy, created_at")
        .eq("kid_id", kidId)
        .gte("created_at", weekAgo.toISOString())
        .order("created_at", { ascending: true });

    if (!data || data.length === 0) {
        return { totalGames: 0, avgAccuracy: 0, totalScore: 0, games: [] };
    }

    const totalGames = data.length;
    const avgAccuracy = Math.round(
        data.reduce((sum, g) => sum + g.accuracy, 0) / totalGames
    );
    const totalScore = data.reduce((sum, g) => sum + g.score, 0);

    return { totalGames, avgAccuracy, totalScore, games: data };
}

// ============================================================================
// Kid Progress Analytics
// ============================================================================

export interface KidProgressData {
    kidId: string;
    spellingBee: {
        totalGames: number;
        avgAccuracy: number;
        recentGames: Array<{
            difficulty: string;
            accuracy: number;
            score: number;
            wordsCorrect: number | null;
            wordsTotal: number | null;
            createdAt: string;
        }>;
        byDifficulty: Record<string, { games: number; avgAccuracy: number }>;
    };
    mathContest: {
        totalGames: number;
        avgAccuracy: number;
        recentGames: Array<{
            difficulty: string;
            accuracy: number;
            score: number;
            createdAt: string;
        }>;
        byCategory: Record<string, { correct: number; total: number; accuracy: number }>;
        weakCategories: string[];
        strongCategories: string[];
    };
}

export async function getKidProgress(kidId: string): Promise<KidProgressData> {
    const supabase = await createClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: results } = await supabase
        .from("game_results")
        .select("*")
        .eq("kid_id", kidId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

    const allResults = results || [];
    const spellingResults = allResults.filter(r => r.game_type === "spelling_bee");
    const mathResults = allResults.filter(r => r.game_type === "math_contest");

    // --- Spelling Bee Analytics ---
    const spellingByDiff: Record<string, { games: number; totalAccuracy: number }> = {};
    for (const r of spellingResults) {
        if (!spellingByDiff[r.difficulty]) spellingByDiff[r.difficulty] = { games: 0, totalAccuracy: 0 };
        spellingByDiff[r.difficulty].games++;
        spellingByDiff[r.difficulty].totalAccuracy += r.accuracy;
    }

    const spellingByDiffFinal: Record<string, { games: number; avgAccuracy: number }> = {};
    for (const [diff, data] of Object.entries(spellingByDiff)) {
        spellingByDiffFinal[diff] = {
            games: data.games,
            avgAccuracy: Math.round(data.totalAccuracy / data.games),
        };
    }

    // --- Math Contest Analytics ---
    const mathByCategory: Record<string, { correct: number; total: number }> = {};
    for (const r of mathResults) {
        if (r.details) {
            const breakdown = typeof r.details === "string" ? JSON.parse(r.details) : r.details;
            for (const [cat, stats] of Object.entries(breakdown as Record<string, { correct: number; total: number }>)) {
                if (!mathByCategory[cat]) mathByCategory[cat] = { correct: 0, total: 0 };
                mathByCategory[cat].correct += (stats as { correct: number; total: number }).correct;
                mathByCategory[cat].total += (stats as { correct: number; total: number }).total;
            }
        }
    }

    const mathByCategoryFinal: Record<string, { correct: number; total: number; accuracy: number }> = {};
    const weakCategories: string[] = [];
    const strongCategories: string[] = [];

    for (const [cat, stats] of Object.entries(mathByCategory)) {
        const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
        mathByCategoryFinal[cat] = { ...stats, accuracy };
        if (accuracy < 50 && stats.total >= 2) weakCategories.push(cat);
        if (accuracy >= 80 && stats.total >= 2) strongCategories.push(cat);
    }

    return {
        kidId,
        spellingBee: {
            totalGames: spellingResults.length,
            avgAccuracy: spellingResults.length > 0
                ? Math.round(spellingResults.reduce((s, r) => s + r.accuracy, 0) / spellingResults.length)
                : 0,
            recentGames: spellingResults.slice(0, 10).map(r => ({
                difficulty: r.difficulty,
                accuracy: r.accuracy,
                score: r.score,
                wordsCorrect: r.words_correct,
                wordsTotal: r.words_total,
                createdAt: r.created_at,
            })),
            byDifficulty: spellingByDiffFinal,
        },
        mathContest: {
            totalGames: mathResults.length,
            avgAccuracy: mathResults.length > 0
                ? Math.round(mathResults.reduce((s, r) => s + r.accuracy, 0) / mathResults.length)
                : 0,
            recentGames: mathResults.slice(0, 10).map(r => ({
                difficulty: r.difficulty,
                accuracy: r.accuracy,
                score: r.score,
                createdAt: r.created_at,
            })),
            byCategory: mathByCategoryFinal,
            weakCategories,
            strongCategories,
        },
    };
}

// ============================================================================
// Helpers
// ============================================================================

function getWeekStart(): Date {
    const now = new Date();
    const day = now.getDay(); // 0=domingo
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // lunes
    const monday = new Date(now);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
}
