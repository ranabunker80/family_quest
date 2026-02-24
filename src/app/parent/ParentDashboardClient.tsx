"use client";

import { useState, useTransition } from "react";
import FamilyOverview from "@/components/parent/FamilyOverview";
import NotesPanel from "@/components/parent/NotesPanel";
import ContentUploader from "@/components/parent/ContentUploader";
import FocusAreaSelector from "@/components/parent/FocusAreaSelector";
import { approveTransaction, rejectTransaction } from "@/lib/actions";

// Temporary local interfaces until Supabase types are updated
export interface KidProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  coins: number;
  created_at: string;
}

export interface ParentProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  role: "parent" | "kid";
  coins: number;
}

export interface PendingApproval {
  id: string;
  kid_id: string;
  amount: number;
  description: string;
  type: string;
  status: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

const TABS = [
  { id: "approvals", label: "✅ Aprobaciones" },
  { id: "overview", label: "👨‍👩‍👧‍👦 Familia" },
  { id: "notes", label: "💬 Notas" },
  { id: "content", label: "📚 Contenido" },
  { id: "focus", label: "🎯 Enfoque" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Props {
  parentProfile: ParentProfile;
  kids: KidProfile[];
  pendingApprovals: PendingApproval[];
}

export default function ParentDashboardClient({
  parentProfile,
  kids,
  pendingApprovals,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("approvals");

  const pendingCount = pendingApprovals.length;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-yellow-400 to-teal-400 bg-clip-text text-transparent">
              Hola, {parentProfile.full_name || "Padre"} 👋
            </h2>
            <p className="text-gray-400 mt-1">
              {kids.length} {kids.length === 1 ? "hijo" : "hijos"} en tu familia
            </p>
          </div>

          {pendingCount > 0 && (
            <button
              onClick={() => setActiveTab("approvals")}
              className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-3 hover:bg-yellow-500/15 transition-colors"
            >
              <span className="text-2xl">🔔</span>
              <div className="text-left">
                <p className="text-yellow-400 font-bold text-sm">
                  {pendingCount} {pendingCount === 1 ? "solicitud espera" : "solicitudes esperan"} tu aprobación
                </p>
                <p className="text-yellow-400/60 text-xs">Toca para revisar</p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40 scale-105"
                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {tab.label}
            {tab.id === "approvals" && pendingCount > 0 && activeTab !== "approvals" && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "approvals" && <ApprovalsPanel pendingApprovals={pendingApprovals} />}
        {activeTab === "overview" && <FamilyOverview kids={kids} />}
        {activeTab === "notes" && <NotesPanel parentProfile={parentProfile} />}
        {activeTab === "content" && <ContentUploader kids={kids} />}
        {activeTab === "focus" && <FocusAreaSelector kids={kids} />}
      </div>
    </div>
  );
}

/* ─── Approvals Panel ─── */

function ApprovalsPanel({ pendingApprovals }: { pendingApprovals: PendingApproval[] }) {
  if (pendingApprovals.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <p className="text-xl font-bold text-white mb-2">Todo al día</p>
        <p className="text-gray-400">No hay solicitudes pendientes. ¡Buen trabajo!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">🔔</span>
        <h3 className="text-lg font-bold text-white">Pendientes de Aprobación</h3>
        <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
          {pendingApprovals.length}
        </span>
      </div>
      {pendingApprovals.map((item) => (
        <ApprovalCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function ApprovalCard({ item }: { item: PendingApproval }) {
  const [isPending, startTransition] = useTransition();
  const [resolved, setResolved] = useState<"approved" | "rejected" | null>(null);

  const handleApprove = () => {
    startTransition(async () => {
      await approveTransaction(item.id, item.kid_id, item.amount);
      setResolved("approved");
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      await rejectTransaction(item.id);
      setResolved("rejected");
    });
  };

  if (resolved) {
    return (
      <div className={`border rounded-2xl p-5 text-center transition-all ${
        resolved === "approved"
          ? "bg-teal-500/10 border-teal-500/20"
          : "bg-red-500/10 border-red-500/20"
      }`}>
        <span className="text-2xl">{resolved === "approved" ? "✅" : "❌"}</span>
        <span className="ml-3 text-sm font-bold text-gray-300">
          {resolved === "approved" ? "Aprobado" : "Rechazado"}: {item.description}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="text-3xl">{item.profiles?.avatar_url || "👤"}</div>
        <div>
          <div className="font-bold text-white text-lg">
            {item.profiles?.full_name || "Hijo"}: <span className="text-gray-300 font-normal">{item.description}</span>
          </div>
          <div className="text-xs text-gray-500">
            {new Date(item.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {" • "}
            <span className={item.amount > 0 ? "text-teal-400" : "text-orange-400 font-bold"}>
              {item.amount > 0 ? `+${item.amount}` : item.amount} PTS
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleReject}
          disabled={isPending}
          className="px-5 py-3 rounded-xl bg-red-500/10 text-red-400 font-bold text-sm hover:bg-red-500/20 disabled:opacity-50 transition-all active:scale-95"
        >
          ✗ Rechazar
        </button>
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="px-6 py-3 rounded-xl bg-teal-500 text-white font-bold text-sm hover:bg-teal-600 disabled:opacity-50 shadow-lg shadow-teal-500/20 transition-all active:scale-95"
        >
          {isPending ? "..." : "✓ Aprobar"}
        </button>
      </div>
    </div>
  );
}
