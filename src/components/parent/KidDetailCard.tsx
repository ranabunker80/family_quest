"use client";

import { useTransition } from "react";

// TODO: Import from parent-actions.ts when available
// import { getKidStats } from "@/lib/parent-actions";

interface KidProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  coins: number;
  created_at: string;
}

interface Props {
  kid: KidProfile;
  isExpanded: boolean;
  onToggle: () => void;
}

// TODO: Replace with real data from server actions
const MOCK_STATS = {
  missionsCompleted: 12,
  missionsThisWeek: 3,
  gamesPlayed: 8,
  weeklyImprovement: 15,
  streak: 4,
  lastActivity: "Hace 2 horas",
};

export default function KidDetailCard({ kid, isExpanded, onToggle }: Props) {
  const [isPending, startTransition] = useTransition();

  const avatar = kid.avatar_url || "👤";
  const name = kid.full_name || "Sin nombre";
  const stats = MOCK_STATS;

  return (
    <div
      className={`bg-white/5 backdrop-blur-xl border rounded-3xl transition-all duration-300 ${
        isExpanded
          ? "border-teal-400/30 shadow-lg shadow-teal-500/10"
          : "border-white/10 hover:border-blue-400/30"
      }`}
    >
      {/* Collapsed Header - Always Visible */}
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center gap-4 text-left"
      >
        {/* Avatar */}
        <div
          className={`text-5xl transition-transform duration-300 ${
            isExpanded ? "scale-110" : ""
          }`}
        >
          {avatar}
        </div>

        {/* Name & Quick Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-lg font-bold text-white truncate">{name}</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-yellow-400 font-bold text-sm">
              {kid.coins} 🪙
            </span>
            <span className="text-gray-500 text-xs">|</span>
            <span className="text-gray-400 text-xs">{stats.lastActivity}</span>
          </div>
        </div>

        {/* Expand/Collapse Arrow */}
        <span
          className={`text-gray-400 transition-transform duration-300 text-lg ${
            isExpanded ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
          {/* Weekly Improvement Banner */}
          {stats.weeklyImprovement > 0 && (
            <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">📈</span>
              <p className="text-teal-400 text-sm font-medium">
                {name} mejoro un {stats.weeklyImprovement}% esta semana
              </p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatBox
              emoji="✅"
              value={stats.missionsCompleted}
              label="Misiones totales"
            />
            <StatBox
              emoji="📅"
              value={stats.missionsThisWeek}
              label="Esta semana"
            />
            <StatBox emoji="🎮" value={stats.gamesPlayed} label="Juegos" />
            <StatBox
              emoji="🔥"
              value={`${stats.streak} dias`}
              label="Racha"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 font-bold text-sm hover:bg-blue-500/20 transition-colors active:scale-95">
              📋 Ver Historial
            </button>
            <button className="flex-1 px-4 py-2.5 rounded-xl bg-yellow-500/10 text-yellow-400 font-bold text-sm hover:bg-yellow-500/20 transition-colors active:scale-95">
              🎁 Dar Bonus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({
  emoji,
  value,
  label,
}: {
  emoji: string;
  value: string | number;
  label: string;
}) {
  return (
    <div className="bg-white/5 rounded-xl p-3 text-center">
      <span className="text-lg">{emoji}</span>
      <p className="text-white font-bold text-lg mt-1">{value}</p>
      <p className="text-gray-500 text-xs">{label}</p>
    </div>
  );
}
