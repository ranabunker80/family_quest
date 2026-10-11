import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DictationEngine, { type DictationKid } from "@/components/game/DictationEngine";
import { DICTATION_LIST_ID } from "@/lib/dictation-data";

export default async function DictationPage({
    searchParams,
}: {
    searchParams: Promise<{ preview?: string; kid?: string }>;
}) {
    const params = await searchParams;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return redirect("/login");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    const isPreview = params.preview === "true" && profile?.role === "parent";
    const name = (profile?.full_name || "").toLowerCase();
    const email = (profile?.email || "").toLowerCase();
    const matchesKid = (kid: string) => name.includes(kid) || email.includes(kid);

    // Parents blocked unless preview mode
    if (profile?.role === "parent" && !isPreview) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 text-center">
                <div>
                    <div className="text-6xl mb-4">🚫</div>
                    <h1 className="text-2xl font-bold mb-2">Solo para niños</h1>
                    <p className="text-gray-400 mb-6">Los papás pueden verlo en modo preview desde su panel.</p>
                    <a href="/" className="bg-blue-500 px-6 py-2 rounded-xl text-white font-bold">Volver al inicio</a>
                </div>
            </div>
        );
    }

    // Each kid owns one half of the card; parents can preview either with ?kid=
    let kid: DictationKid | null = isPreview ? (params.kid === "elias" ? "elias" : "isaac") : null;
    if (matchesKid("isaac")) kid = "isaac";
    else if (matchesKid("elias") || matchesKid("elías")) kid = "elias";

    // Restrict to Isaac and Elias only
    if (!kid) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 text-center bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900">
                <div>
                    <div className="text-6xl mb-4">✏️</div>
                    <h1 className="text-2xl font-bold mb-2 text-white">Reto especial</h1>
                    <p className="text-gray-400 mb-6">Este reto es para el examen de dictado de Isaac y Elías.</p>
                    <a href="/" className="bg-blue-500 px-6 py-2 rounded-xl text-white font-bold">Volver al inicio</a>
                </div>
            </div>
        );
    }

    // Has this kid already earned the half card for this word list?
    let wonAt: string | null = null;
    if (!isPreview) {
        const { data: wins } = await supabase
            .from("game_results")
            .select("created_at")
            .eq("kid_id", user.id)
            .eq("game_type", "dictation_challenge")
            .eq("difficulty", DICTATION_LIST_ID)
            .eq("accuracy", 100)
            .order("created_at", { ascending: true })
            .limit(1);
        wonAt = wins?.[0]?.created_at ?? null;
    }

    return (
        <div className="h-[100dvh] bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900 font-[family-name:var(--font-geist-sans)] overflow-hidden flex flex-col">
            <div className="max-w-md md:max-w-6xl mx-auto w-full p-4 lg:px-8 flex-1 flex flex-col h-full">
                <header className="flex justify-between items-center mb-3 shrink-0">
                    <a href={isPreview ? "/parent" : "/"} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                        ← {isPreview ? "Volver al Panel" : "Salir"}
                    </a>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{profile?.avatar_url}</span>
                        {isPreview ? (
                            <span className="font-bold text-amber-400">👀 Preview</span>
                        ) : (
                            <span className="font-bold text-white">{profile?.full_name}</span>
                        )}
                    </div>
                </header>

                <div className="flex-1 min-h-0">
                    <DictationEngine profile={profile} previewMode={isPreview} kid={kid} wonAt={wonAt} />
                </div>
            </div>
        </div>
    );
}
