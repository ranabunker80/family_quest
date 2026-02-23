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

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        }
    };

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

                    {/* Google OAuth Button */}
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-6 rounded-2xl shadow-lg transform transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        {loading ? "Conectando..." : "Iniciar con Google"}
                    </button>

                    {error && <div className="mt-4 text-red-400 text-sm text-center bg-red-400/10 p-2 rounded-lg border border-red-400/20">{error}</div>}

                    {/* Separator */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-white/10"></div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">o usa email</span>
                        <div className="flex-1 h-px bg-white/10"></div>
                    </div>

                    {/* Email/Password (secondary, collapsible) */}
                    <details className="group">
                        <summary className="text-center text-sm text-gray-400 cursor-pointer hover:text-gray-300 transition-colors list-none">
                            Iniciar con email y contraseña
                        </summary>
                        <form onSubmit={handleLogin} className="flex flex-col gap-4 mt-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 ml-2 uppercase">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="papa@kidosverse.mx"
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
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transform transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? "Entrando..." : "Iniciar Sesion"}
                            </button>
                        </form>
                    </details>

                    <div className="mt-8 p-4 rounded-xl bg-teal-400/10 border border-teal-400/10 text-center">
                        <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">TIP</span>
                        <p className="text-xs text-gray-400 mt-2">
                            Todos los miembros de la familia pueden iniciar con su cuenta de Google.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
