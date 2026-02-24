"use client";

import { useState, useRef, useEffect } from "react";

// TODO: Import from parent-actions.ts when available
// import { sendParentNote, getParentNotes } from "@/lib/parent-actions";

interface ParentProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Note {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string;
  message: string;
  created_at: string;
}

interface Props {
  parentProfile: ParentProfile;
}

// TODO: Replace with real data from Supabase realtime subscription
const MOCK_NOTES: Note[] = [
  {
    id: "1",
    author_id: "parent-1",
    author_name: "Mama",
    author_avatar: "👩",
    message: "Santiago hizo todas las misiones de hoy sin ayuda!",
    created_at: "2026-02-24T10:30:00Z",
  },
  {
    id: "2",
    author_id: "parent-2",
    author_name: "Papa",
    author_avatar: "👨",
    message: "Genial! Hoy le toca practicar spelling de animales.",
    created_at: "2026-02-24T11:15:00Z",
  },
  {
    id: "3",
    author_id: "parent-1",
    author_name: "Mama",
    author_avatar: "👩",
    message: "Le agregue 3 palabras nuevas de ciencia para esta semana.",
    created_at: "2026-02-24T14:00:00Z",
  },
];

export default function NotesPanel({ parentProfile }: Props) {
  const [notes, setNotes] = useState<Note[]>(MOCK_NOTES);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes]);

  const handleSend = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);

    // TODO: Replace with actual server action
    // await sendParentNote({ message: trimmed });
    const newNote: Note = {
      id: `temp-${Date.now()}`,
      author_id: parentProfile.id,
      author_name: parentProfile.full_name || "Padre",
      author_avatar: parentProfile.avatar_url || "👤",
      message: trimmed,
      created_at: new Date().toISOString(),
    };

    setNotes((prev) => [...prev, newNote]);
    setNewMessage("");
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Hoy";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Ayer";
    return date.toLocaleDateString("es", {
      day: "numeric",
      month: "short",
    });
  };

  // Group notes by date
  const groupedNotes = notes.reduce<Record<string, Note[]>>((groups, note) => {
    const dateKey = new Date(note.created_at).toDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(note);
    return groups;
  }, {});

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl flex flex-col h-[500px] sm:h-[600px]">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💬</span>
          <div>
            <h3 className="text-lg font-bold text-white">Notas entre Padres</h3>
            <p className="text-gray-500 text-xs">
              Coordina con tu pareja sobre el progreso de los hijos
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="text-5xl mb-3">📝</span>
            <p className="text-gray-400 text-sm">
              No hay notas aun. Escribe la primera!
            </p>
          </div>
        ) : (
          Object.entries(groupedNotes).map(([dateKey, dayNotes]) => (
            <div key={dateKey} className="space-y-3">
              {/* Date Separator */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-gray-500 text-xs font-medium">
                  {formatDate(dayNotes[0].created_at)}
                </span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {/* Messages for this day */}
              {dayNotes.map((note) => {
                const isMe = note.author_id === parentProfile.id;

                return (
                  <div
                    key={note.id}
                    className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}
                  >
                    {/* Avatar */}
                    <div className="text-2xl shrink-0 mt-1">
                      {note.author_avatar}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                        isMe
                          ? "bg-blue-600/20 border border-blue-500/20"
                          : "bg-white/5 border border-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-300">
                          {note.author_name}
                        </span>
                        <span className="text-gray-600 text-xs">
                          {formatTime(note.created_at)}
                        </span>
                      </div>
                      <p className="text-gray-200 text-sm leading-relaxed">
                        {note.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-5 border-t border-white/10">
        <div className="flex gap-3">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe una nota..."
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 outline-none focus:border-teal-400 transition-colors resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            className="px-5 py-3 rounded-xl bg-teal-500 text-white font-bold text-sm hover:bg-teal-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-teal-500/20"
          >
            {isSending ? "..." : "Enviar"}
          </button>
        </div>
        <p className="text-gray-600 text-xs mt-2">
          Enter para enviar, Shift+Enter para nueva linea
        </p>
      </div>
    </div>
  );
}
