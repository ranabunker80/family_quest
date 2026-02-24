"use client";

import { useState } from "react";

// TODO: Import from parent-actions.ts when available
// import { saveFocusAreas } from "@/lib/parent-actions";

interface KidProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Props {
  kids: KidProfile[];
}

const FOCUS_AREAS = [
  { id: "spelling", label: "Spelling", emoji: "🔤", color: "blue" },
  { id: "vocabulary", label: "Vocabulario", emoji: "📝", color: "teal" },
  { id: "reading", label: "Lectura", emoji: "📖", color: "purple" },
  { id: "math", label: "Matematicas", emoji: "🔢", color: "yellow" },
  { id: "science", label: "Ciencias", emoji: "🔬", color: "green" },
  { id: "social", label: "Estudios Sociales", emoji: "🌎", color: "orange" },
  { id: "creativity", label: "Creatividad", emoji: "🎨", color: "pink" },
  { id: "logic", label: "Logica", emoji: "🧩", color: "indigo" },
] as const;

type FocusAreaId = (typeof FOCUS_AREAS)[number]["id"];

// Color mapping for selected state
const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-500/20 border-blue-400/30 text-blue-400",
  teal: "bg-teal-500/20 border-teal-400/30 text-teal-400",
  purple: "bg-purple-500/20 border-purple-400/30 text-purple-400",
  yellow: "bg-yellow-500/20 border-yellow-400/30 text-yellow-400",
  green: "bg-green-500/20 border-green-400/30 text-green-400",
  orange: "bg-orange-500/20 border-orange-400/30 text-orange-400",
  pink: "bg-pink-500/20 border-pink-400/30 text-pink-400",
  indigo: "bg-indigo-500/20 border-indigo-400/30 text-indigo-400",
};

export default function FocusAreaSelector({ kids }: Props) {
  const [selectedKidId, setSelectedKidId] = useState<string>(
    kids[0]?.id || ""
  );
  const [selectedAreas, setSelectedAreas] = useState<
    Record<string, FocusAreaId[]>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const currentAreas = selectedAreas[selectedKidId] || [];

  const toggleArea = (areaId: FocusAreaId) => {
    setSelectedAreas((prev) => {
      const kidAreas = prev[selectedKidId] || [];
      const updated = kidAreas.includes(areaId)
        ? kidAreas.filter((a) => a !== areaId)
        : kidAreas.length < 3
          ? [...kidAreas, areaId]
          : kidAreas;
      return { ...prev, [selectedKidId]: updated };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    if (currentAreas.length === 0) return;

    setIsSaving(true);

    // TODO: Replace with actual server action
    // await saveFocusAreas({ kidId: selectedKidId, areas: currentAreas });
    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsSaving(false);
    setSaved(true);
  };

  const selectedKid = kids.find((k) => k.id === selectedKidId);

  return (
    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <h3 className="text-lg font-bold text-white">
              Areas de Enfoque Semanal
            </h3>
            <p className="text-gray-500 text-xs">
              Selecciona hasta 3 areas de enfoque por hijo para esta semana
            </p>
          </div>
        </div>

        {/* Kid Selector */}
        {kids.length > 1 && (
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">
              Selecciona un hijo
            </label>
            <div className="flex flex-wrap gap-2">
              {kids.map((kid) => (
                <button
                  key={kid.id}
                  onClick={() => {
                    setSelectedKidId(kid.id);
                    setSaved(false);
                  }}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    selectedKidId === kid.id
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40 scale-105"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {kid.avatar_url || "👤"} {kid.full_name || "Hijo"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current selection info */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-2xl">{selectedKid?.avatar_url || "👤"}</span>
          <span className="text-gray-400">
            Enfoque para{" "}
            <span className="text-white font-bold">
              {selectedKid?.full_name || "este hijo"}
            </span>
          </span>
          <span className="ml-auto text-gray-500 text-xs">
            {currentAreas.length}/3 seleccionadas
          </span>
        </div>

        {/* Focus Areas Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {FOCUS_AREAS.map((area) => {
            const isSelected = currentAreas.includes(area.id);
            const isDisabled = !isSelected && currentAreas.length >= 3;

            return (
              <button
                key={area.id}
                onClick={() => toggleArea(area.id)}
                disabled={isDisabled}
                className={`p-4 rounded-2xl border text-center transition-all active:scale-95 ${
                  isSelected
                    ? `${COLOR_MAP[area.color]} border`
                    : isDisabled
                      ? "bg-white/5 border-white/5 text-gray-600 cursor-not-allowed opacity-50"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div
                  className={`text-3xl mb-2 transition-transform ${isSelected ? "scale-110" : ""}`}
                >
                  {area.emoji}
                </div>
                <p className="text-xs font-bold">{area.label}</p>
                {isSelected && (
                  <div className="mt-2">
                    <span className="text-xs bg-white/10 rounded-full px-2 py-0.5">
                      ✓
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Summary */}
        {currentAreas.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-4">
            <p className="text-gray-400 text-xs font-bold uppercase mb-2">
              Enfoque de esta semana
            </p>
            <div className="flex flex-wrap gap-2">
              {currentAreas.map((areaId) => {
                const area = FOCUS_AREAS.find((a) => a.id === areaId);
                if (!area) return null;
                return (
                  <span
                    key={areaId}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${COLOR_MAP[area.color]}`}
                  >
                    {area.emoji} {area.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={currentAreas.length === 0 || isSaving || saved}
          className={`w-full py-3.5 rounded-2xl font-bold transition-all active:scale-95 hover:-translate-y-0.5 ${
            saved
              ? "bg-teal-500/20 text-teal-400 border border-teal-500/20"
              : "bg-teal-500 text-white shadow-lg shadow-teal-500/20 hover:bg-teal-600 disabled:opacity-30 disabled:cursor-not-allowed"
          }`}
        >
          {isSaving ? "Guardando..." : saved ? "✅ Guardado" : "💾 Guardar Enfoque Semanal"}
        </button>
      </div>
    </div>
  );
}
