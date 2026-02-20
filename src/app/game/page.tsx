import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GameEngine from "@/components/game/GameEngine";

export default async function GamePage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return redirect("/login");
    }

    // Fetch Profile to pass to game logic if needed (e.g. for creating custom word lists later)
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (profile?.role === "parent") {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 text-center">
                <div>
                    <div className="text-6xl mb-4">🚫</div>
                    <h1 className="text-2xl font-bold mb-2">Solo para niños</h1>
                    <p className="text-gray-400 mb-6">Los papás no pueden ganar puntos jugando.</p>
                    <a href="/" className="bg-blue-500 px-6 py-2 rounded-xl text-white font-bold">Volver al inicio</a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 p-4 font-[family-name:var(--font-geist-sans)]">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-6">
                    <a href="/" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                        ← Salir
                    </a>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{profile?.avatar_url}</span>
                        <span className="font-bold text-yellow-400">{profile?.coins} 💰</span>
                    </div>
                </header>

                <GameEngine profile={profile} />
            </div>
        </div>
    );
}
