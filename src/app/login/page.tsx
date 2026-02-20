"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push("/");
            router.refresh();
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-5 relative z-10 font-[family-name:var(--font-geist-sans)]">
            {/* Background Particles (Animated) */}
            <div className="fixed inset-0 pointer-events-none z-0">
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full bg-white opacity-20 animate-pulse"
                        style={{
                            width: Math.random() * 4 + 2 + "px",
                            height: Math.random() * 4 + 2 + "px",
                            left: Math.random() * 100 + "%",
                            top: Math.random() * 100 + "%",
                            animationDuration: Math.random() * 3 + 2 + "s",
                        }}
                    />
                ))}
            </div>

            {/* Login Card */}
            <div className="flex flex-col items-center relative z-10 w-full max-w-md">
                <div className="text-8xl mb-4 animate-bounce">🐝</div>
                <h1 className="font-bold text-5xl mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-teal-400">
                    FamilyQuest
                </h1>
                <p className="text-gray-400 text-sm mb-10 text-center">
                    Aprende, juega y gana recompensas en familia 🎮✨
                </p>

                <div className="w-full bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
                    <p className="text-xs text-gray-500 mb-6 text-center uppercase tracking-widest font-semibold">
                        Familia Garza–Elizondo
                    </p>

                    <form onSubmit={handleLogin} className="flex flex-col gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 ml-2 uppercase">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="papá@kidosverse.mx"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-teal-400 transition-colors"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 ml-2 uppercase">Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-teal-400 transition-colors"
                                required
                            />
                        </div>

                        {error && <div className="text-red-400 text-sm text-center bg-red-400/10 p-2 rounded-lg border border-red-400/20">{error}</div>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-4 w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transform transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Entrando..." : "🔑 Iniciar Sesión"}
                        </button>
                    </form>

                    <div className="mt-8 p-4 rounded-xl bg-yellow-400/10 border border-yellow-400/10 text-center">
                        <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">TIP</span>
                        <p className="text-xs text-gray-400 mt-2">
                            Si eres niño y no tienes password, pídele a papá que inicie sesión primero.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
