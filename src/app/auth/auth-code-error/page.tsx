"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ErrorContent() {
    const searchParams = useSearchParams();
    const errorMessage = searchParams.get("error");

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-5 font-[family-name:var(--font-geist-sans)]">
            <div className="w-full max-w-md text-center">
                <div className="text-6xl mb-4">😵</div>
                <h1 className="text-2xl font-bold text-red-400 mb-2">
                    Error de autenticacion
                </h1>
                <p className="text-gray-400 text-sm mb-6">
                    Hubo un problema al iniciar sesion. Intenta de nuevo.
                </p>

                {errorMessage && (
                    <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-4 mb-6 text-left">
                        <p className="text-xs font-bold text-red-400 uppercase mb-1">Detalle del error</p>
                        <p className="text-sm text-red-300 break-words">{errorMessage}</p>
                    </div>
                )}

                <Link
                    href="/login"
                    className="inline-block bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 hover:to-blue-400 text-white font-bold py-3 px-8 rounded-2xl shadow-lg transform transition hover:-translate-y-0.5"
                >
                    Volver al login
                </Link>
            </div>
        </div>
    );
}

export default function AuthCodeErrorPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-4xl animate-spin">🐝</div>
                </div>
            }
        >
            <ErrorContent />
        </Suspense>
    );
}
