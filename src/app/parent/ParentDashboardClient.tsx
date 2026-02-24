"use client";

import { useState } from "react";
import FamilyOverview from "@/components/parent/FamilyOverview";
import NotesPanel from "@/components/parent/NotesPanel";
import ContentUploader from "@/components/parent/ContentUploader";
import FocusAreaSelector from "@/components/parent/FocusAreaSelector";

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

const TABS = [
  { id: "overview", label: "👨‍👩‍👧‍👦 Familia", emoji: "👨‍👩‍👧‍👦" },
  { id: "notes", label: "💬 Notas", emoji: "💬" },
  { id: "content", label: "📚 Contenido", emoji: "📚" },
  { id: "focus", label: "🎯 Enfoque", emoji: "🎯" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Props {
  parentProfile: ParentProfile;
  kids: KidProfile[];
  pendingCount: number;
}

export default function ParentDashboardClient({
  parentProfile,
  kids,
  pendingCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

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
            <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-3">
              <span className="text-2xl">🔔</span>
              <div>
                <p className="text-yellow-400 font-bold text-sm">
                  {pendingCount} {pendingCount === 1 ? "solicitud espera" : "solicitudes esperan"} tu aprobacion
                </p>
                <p className="text-yellow-400/60 text-xs">Revisa las misiones pendientes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40 scale-105"
                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && <FamilyOverview kids={kids} />}
        {activeTab === "notes" && <NotesPanel parentProfile={parentProfile} />}
        {activeTab === "content" && <ContentUploader kids={kids} />}
        {activeTab === "focus" && <FocusAreaSelector kids={kids} />}
      </div>
    </div>
  );
}
