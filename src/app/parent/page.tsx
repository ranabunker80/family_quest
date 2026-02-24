import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ParentDashboardClient from "./ParentDashboardClient";

// TODO: Import from parent-actions.ts when available
// import { getKidsForParent, getParentNotes, getFocusAreas } from "@/lib/parent-actions";

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

  // TODO: Replace with actual query when parent_children table exists
  // For now, fetch all kids (in a family context, this would be filtered)
  const { data: kids } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "kid")
    .order("full_name");

  // TODO: Fetch pending approvals count
  const { data: pendingApprovals } = await supabase
    .from("ledger")
    .select("id")
    .eq("status", "pending");

  return (
    <ParentDashboardClient
      parentProfile={profile}
      kids={kids || []}
      pendingCount={pendingApprovals?.length || 0}
    />
  );
}
