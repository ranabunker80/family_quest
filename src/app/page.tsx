import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import KidDashboard from "@/components/dashboards/KidDashboard";
import ParentDashboard from "@/components/dashboards/ParentDashboard";
import { getMissions, getRewards, getKidHistory, getPendingApprovals } from "@/lib/actions";

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

  if (!profile) {
    return redirect("/onboarding");
  }

  const isParent = profile.role === "parent";

  // Fetch Data based on Role
  let missions: any[] = [];
  let rewards: any[] = [];
  let history: any[] = [];
  let pendingApprovals: any[] = [];

  if (isParent) {
    pendingApprovals = await getPendingApprovals();
  } else {
    missions = await getMissions();
    rewards = await getRewards();
    history = await getKidHistory(user.id);
  }

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

        {isParent ? (
          <ParentDashboard profile={profile} pendingApprovals={pendingApprovals} />
        ) : (
          <KidDashboard
            profile={profile}
            missions={missions}
            rewards={rewards}
            history={history}
          />
        )}

      </main>
    </div>
  );
}
