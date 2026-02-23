import Link from "next/link";

export default function AuthCodeErrorPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-5 font-[family-name:var(--font-geist-sans)]">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-bold text-red-400 mb-2">
                Error de autenticacion
            </h1>
            <p className="text-gray-400 text-sm mb-6 text-center max-w-sm">
                Hubo un problema al iniciar sesion. Intenta de nuevo.
            </p>
            <Link
                href="/login"
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg hover:-translate-y-0.5 transition transform"
            >
                Volver al login
            </Link>
        </div>
    );
}
