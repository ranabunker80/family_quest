"use client";

import { useState, useTransition } from "react";
import { answerFamilyQuestion, type FamilyQuestion } from "@/lib/question-actions";

interface Props {
  questions: FamilyQuestion[];
}

const OTHER = "Otra respuesta";

function QuestionCard({ question }: { question: FamilyQuestion }) {
  const answerIsOption = question.answer !== null && question.options.includes(question.answer);
  const [choice, setChoice] = useState<string | null>(
    question.answer === null ? null : answerIsOption ? question.answer : OTHER
  );
  const [text, setText] = useState(answerIsOption ? "" : question.answer ?? "");
  const [editing, setEditing] = useState(question.answer === null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasOptions = question.options.length > 0;
  const showText = !hasOptions || choice === OTHER;
  const value = showText ? text : choice;

  const handleSave = () => {
    if (!value?.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await answerFamilyQuestion(question.id, value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <p className="text-gray-400 text-sm">{question.prompt}</p>
        <p className="text-white font-bold mt-2">✅ {question.answer}</p>
        <button
          onClick={() => setEditing(true)}
          className="mt-3 min-h-[44px] text-teal-400 text-sm font-bold hover:text-teal-300 transition-colors"
        >
          Cambiar respuesta
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-teal-500/30 rounded-2xl p-5 space-y-4">
      <p className="text-white font-bold text-lg">{question.prompt}</p>

      {hasOptions && (
        <div className="grid gap-2 sm:grid-cols-2">
          {[...question.options, OTHER].map((option) => (
            <button
              key={option}
              onClick={() => setChoice(option)}
              className={`min-h-[56px] px-4 py-3 rounded-xl text-left font-bold transition-all active:scale-95 ${
                choice === option
                  ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20"
                  : "bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {showText && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Escribe tu respuesta..."
          className="w-full bg-white/10 border border-white/10 rounded-xl p-3 text-white text-base placeholder-gray-500 focus:outline-none focus:border-teal-400"
        />
      )}

      {error && <p className="text-red-400 text-sm font-bold">{error}</p>}

      <button
        onClick={handleSave}
        disabled={isPending || !value?.trim()}
        className="w-full min-h-[56px] rounded-xl bg-teal-500 text-white font-bold hover:bg-teal-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-teal-500/20"
      >
        {isPending ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

export default function QuestionsPanel({ questions }: Props) {
  if (questions.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
        <p className="text-4xl mb-3">🎉</p>
        <p className="text-gray-400">No hay preguntas por ahora</p>
      </div>
    );
  }

  const pending = questions.filter((q) => q.answer === null);
  const answered = questions.filter((q) => q.answer !== null);

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-white">
            {pending.length === 1 ? "1 pregunta pendiente" : `${pending.length} preguntas pendientes`}
          </h3>
          <p className="text-teal-400 text-sm font-bold">{pending[0].topic}</p>
          {pending.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </section>
      )}

      {answered.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-gray-400">Ya contestadas</h3>
          {answered.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </section>
      )}
    </div>
  );
}
