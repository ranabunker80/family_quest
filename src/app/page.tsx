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

  // Fetch Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const isParent = profile?.role === "parent";

  return (
    <div className="min-h-screen p-6 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <div className="text-4xl">{profile?.avatar_url || "👤"}</div>
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-teal-400">
                {profile?.full_name || "Usuario"}
              </h1>
              <p className="text-gray-400 text-sm">
                {isParent ? "Panel de Padres 👨‍👩‍👧‍👦" : `Nivel Explorador 🌟 • ${profile?.coins || 0} Monedas`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <form action="/auth/signout" method="post">
              <button className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2">
                <span>🚪</span> Salir
              </button>
            </form>
          </div>
        </header>

        {!profile ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-8 text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-2">Perfil no encontrado</h2>
            <p className="text-gray-400 mb-6">Tu usuario existe, pero no se ha vinculado a un perfil de familia.</p>
            <p className="text-sm text-gray-500">Por favor contacta al administrador o ejecuta el script de configuración.</p>
          </div>
        ) : isParent ? (
          <ParentDashboard profile={profile} />
        ) : (
          <KidDashboard profile={profile} />
        )}

      </main>
    </div>
  );
}

function ParentDashboard({ profile }: { profile: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <DashboardCard icon="👧" title="Hijos" desc="Ver progreso y puntos" color="teal" />
      <DashboardCard icon="✅" title="Aprobar" desc="Misiones y canjes pendientes" color="orange" />
      <DashboardCard icon="🎁" title="Recompensas" desc="Configurar premios" color="purple" />
      <DashboardCard icon="📊" title="Bitácora" desc="Historial de actividad" color="blue" />
    </div>
  );
}

function KidDashboard({ profile }: { profile: any }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <DashboardCard icon="🐝" title="Jugar" desc="Spelling Bee" color="yellow" onClick="/game" />
      <DashboardCard icon="🎁" title="Tienda" desc="Canjear puntos" color="teal" onClick="/shop" />
      <DashboardCard icon="📋" title="Misiones" desc="Ver mis tareas" color="blue" onClick="/missions" />
      <DashboardCard icon="📜" title="Historial" desc="Mis movimientos" color="purple" onClick="/history" />
    </div>
  );
}

function DashboardCard({ icon, title, desc, color, onClick }: any) {
  const colors: any = {
    teal: "hover:border-teal-400/30",
    orange: "hover:border-orange-400/30",
    purple: "hover:border-purple-400/30",
    blue: "hover:border-blue-400/30",
    yellow: "hover:border-yellow-400/30",
  };

  return (
    <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 ${colors[color]} transition-colors cursor-pointer group`}>
      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{icon}</div>
      <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
      <p className="text-gray-400 text-xs">{desc}</p>
    </div>
  )
}
