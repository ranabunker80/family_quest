import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MathEngine from "@/components/game/MathEngine";

export default async function MathContestPage() {
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
        <div className="min-h-[100dvh] bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 font-[family-name:var(--font-geist-sans)] overflow-hidden flex flex-col">
            <div className="max-w-md mx-auto w-full p-4 flex-1 flex flex-col h-full">
                <header className="flex justify-between items-center mb-6 shrink-0">
                    <a href="/" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                        ← Salir
                    </a>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{profile?.avatar_url}</span>
                        <span className="font-bold text-yellow-400">{profile?.coins} 💰</span>
                    </div>
                </header>

                <div className="flex-1 min-h-0">
                    <MathEngine profile={profile} />
                </div>
            </div>
        </div>
    );
}
