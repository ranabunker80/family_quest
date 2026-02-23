"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const AVATAR_OPTIONS = [
    { emoji: "🦁", label: "Leon" },
    { emoji: "🐝", label: "Abeja" },
    { emoji: "🦊", label: "Zorro" },
    { emoji: "🐸", label: "Rana" },
    { emoji: "🦄", label: "Unicornio" },
    { emoji: "🐶", label: "Perro" },
    { emoji: "🦋", label: "Mariposa" },
    { emoji: "🐱", label: "Gato" },
];

export default function OnboardingPage() {
    const [fullName, setFullName] = useState("");
    const [role, setRole] = useState<"parent" | "kid" | null>(null);
    const [avatar, setAvatar] = useState("");
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
                return;
            }

            // If profile already exists, go to home
            const { data: profile } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", user.id)
                .single();

            if (profile) {
                router.push("/");
                return;
            }

            setUserEmail(user.email ?? null);
            const googleName = user.user_metadata?.full_name || user.user_metadata?.name || "";
            if (googleName) setFullName(googleName);
            setChecking(false);
        };
        init();
    }, [supabase, router]);

    const handleSubmit = async () => {
        if (!fullName.trim() || !role || !avatar) {
            setError("Completa todos los campos");
            return;
        }

        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setError("No hay sesion activa");
            setLoading(false);
            return;
        }

        const { error: insertError } = await supabase.from("profiles").insert({
            id: user.id,
            email: user.email,
            full_name: fullName.trim(),
            role,
            avatar_url: avatar,
            coins: 0,
        });

        if (insertError) {
            // Unique violation = profile already exists (race condition)
            if (insertError.code === "23505") {
                router.push("/");
                return;
            }
            setError(insertError.message);
            setLoading(false);
        } else {
            router.push("/");
            router.refresh();
        }
    };

    if (checking) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-4xl animate-spin">🐝</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-5 font-[family-name:var(--font-geist-sans)]">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="text-6xl mb-4">🎉</div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-teal-400">
                        Bienvenido a FamilyQuest
                    </h1>
                    <p className="text-gray-400 text-sm mt-2">
                        Configura tu perfil para empezar
                    </p>
                    {userEmail && (
                        <p className="text-gray-500 text-xs mt-1">{userEmail}</p>
                    )}
                </div>

                <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
                    {/* Name */}
                    <div className="mb-6">
                        <label className="text-xs font-bold text-gray-500 ml-2 uppercase">
                            Tu nombre
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Ej: Jorge, Andrea, Santiago..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-teal-400 transition-colors mt-1"
                        />
                    </div>

                    {/* Role */}
                    <div className="mb-6">
                        <label className="text-xs font-bold text-gray-500 ml-2 uppercase mb-2 block">
                            Eres...
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setRole("parent")}
                                className={`p-4 rounded-2xl border text-center transition-all ${
                                    role === "parent"
                                        ? "border-teal-400 bg-teal-400/10 scale-105"
                                        : "border-white/10 bg-white/5 hover:border-white/20"
                                }`}
                            >
                                <div className="text-3xl mb-1">👨‍👩‍👧‍👦</div>
                                <div className="text-sm font-semibold text-white">Papa / Mama</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRole("kid")}
                                className={`p-4 rounded-2xl border text-center transition-all ${
                                    role === "kid"
                                        ? "border-yellow-400 bg-yellow-400/10 scale-105"
                                        : "border-white/10 bg-white/5 hover:border-white/20"
                                }`}
                            >
                                <div className="text-3xl mb-1">🧒</div>
                                <div className="text-sm font-semibold text-white">Hijo / Hija</div>
                            </button>
                        </div>
                    </div>

                    {/* Avatar */}
                    <div className="mb-6">
                        <label className="text-xs font-bold text-gray-500 ml-2 uppercase mb-2 block">
                            Escoge tu avatar
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {AVATAR_OPTIONS.map((opt) => (
                                <button
                                    key={opt.emoji}
                                    type="button"
                                    onClick={() => setAvatar(opt.emoji)}
                                    className={`p-3 rounded-xl border text-2xl text-center transition-all ${
                                        avatar === opt.emoji
                                            ? "border-teal-400 bg-teal-400/10 scale-110"
                                            : "border-white/10 bg-white/5 hover:border-white/20"
                                    }`}
                                >
                                    {opt.emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-400 text-sm text-center bg-red-400/10 p-2 rounded-lg border border-red-400/20 mb-4">
                            {error}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || !fullName.trim() || !role || !avatar}
                        className="w-full bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 hover:to-blue-400 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transform transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Creando perfil..." : "Empezar la aventura"}
                    </button>
                </div>
            </div>
        </div>
    );
}
