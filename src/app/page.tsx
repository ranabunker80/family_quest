import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  return (
    <div className="min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-teal-400">
              FamilyQuest
            </h1>
            <p className="text-gray-400 text-sm">Panel Familiar</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-bold text-white">{user.email}</p>
              <p className="text-xs text-green-400">Conectado</p>
            </div>
            <form action="/auth/signout" method="post">
              <button className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                Salir
              </button>
            </form>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-teal-400/30 transition-colors cursor-pointer group">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">👨‍👩‍👧‍👦</div>
            <h2 className="text-xl font-bold text-white mb-2">Papás</h2>
            <p className="text-gray-400 text-sm">Administrar misiones, aprobar canjes y ver reportes.</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-yellow-400/30 transition-colors cursor-pointer group">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🐝</div>
            <h2 className="text-xl font-bold text-white mb-2">Niños</h2>
            <p className="text-gray-400 text-sm">Jugar Spelling Bee, ver mis puntos y canjear premios.</p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">Pronto: Roles y selección de perfil.</p>
        </div>
      </main>
    </div>
  );
}
