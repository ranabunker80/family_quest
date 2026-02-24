"use client";

import { useState } from "react";
import KidDetailCard from "./KidDetailCard";

interface KidProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  coins: number;
  created_at: string;
}

interface Props {
  kids: KidProfile[];
}

export default function FamilyOverview({ kids }: Props) {
  const [expandedKidId, setExpandedKidId] = useState<string | null>(null);

  if (kids.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
        <div className="text-6xl mb-4">👶</div>
        <h3 className="text-xl font-bold text-white mb-2">
          No hay hijos registrados
        </h3>
        <p className="text-gray-400 text-sm">
          Invita a tus hijos a unirse a Family Quest para comenzar.
        </p>
      </div>
    );
  }

  // Quick stats
  const totalCoins = kids.reduce((sum, kid) => sum + kid.coins, 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-white">{kids.length}</p>
          <p className="text-gray-400 text-xs font-medium mt-1">
            {kids.length === 1 ? "Hijo" : "Hijos"}
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">
            {totalCoins} 🪙
          </p>
          <p className="text-gray-400 text-xs font-medium mt-1">
            Monedas Totales
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-3xl font-bold text-teal-400">--</p>
          <p className="text-gray-400 text-xs font-medium mt-1">
            Misiones esta semana
          </p>
        </div>
      </div>

      {/* Kids Grid */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4">Tus Hijos</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {kids.map((kid) => (
            <KidDetailCard
              key={kid.id}
              kid={kid}
              isExpanded={expandedKidId === kid.id}
              onToggle={() =>
                setExpandedKidId(
                  expandedKidId === kid.id ? null : kid.id
                )
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
