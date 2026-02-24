import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ParentDashboardClient from "./ParentDashboardClient";
import { getPendingApprovals } from "@/lib/actions";

export default async function ParentPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "parent") return redirect("/");

  // Fetch all kids
  const { data: kids } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "kid")
    .order("full_name");

  // Fetch full pending approvals (with kid profile data)
  const pendingApprovals = await getPendingApprovals();

  return (
    <ParentDashboardClient
      parentProfile={profile}
      kids={kids || []}
      pendingApprovals={pendingApprovals}
    />
  );
}
