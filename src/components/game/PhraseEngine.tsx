"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  PHRASE_WORDS,
  PHRASE_TEXT,
  DISTRACTORS,
  BLANK_SETS,
  SCRAMBLE_INDICES,
  LEVEL_CONFIG,
  shuffleArray,
  scrambleWord,
} from "@/lib/phrase-data";
import { unlockAudio, playSfx, playCustomAudio, playLetterAudio } from "@/lib/audio";
import { submitPhraseResult } from "@/lib/phrase-actions";
import Confetti from "./Confetti";

// --- Types ---

type Phase = "intro" | "playing" | "transition" | "results";

type PhraseGameState = {
  level: 1 | 2 | 3 | 4 | 5;
  phase: Phase;
  score: number;
  streak: number;
  startTime: number;
  levelScores: number[];
  perfectLevels: number;
};

// --- Audio helpers ---

function playPhraseWord(word: string) {
  playCustomAudio(`/audio/phrase/${word.toLowerCase()}.mp3`, word);
}

function playFullPhrase() {
  playCustomAudio("/audio/phrase/full-phrase.mp3", PHRASE_TEXT);
}

function playCongrats() {
  playCustomAudio("/audio/phrase/congratulations.mp3", "Congratulations Isaac! You are a Phrase Master!");
}

// --- Feedback messages ---
const CORRECT_MSGS = ["¡Correcto!", "¡Genial!", "¡Increíble!", "¡Eres un crack!", "¡Excelente!"];
const INCORRECT_MSGS = ["¡Casi!", "¡Intenta otra vez!", "No te preocupes, ¡tú puedes!"];
function randomMsg(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)]; }

// ============================================================
// MAIN ENGINE
// ============================================================

export default function PhraseEngine({ profile, previewMode = false }: { profile: any; previewMode?: boolean }) {
  const [state, setState] = useState<PhraseGameState>({
    level: 1,
    phase: "intro",
    score: 0,
    streak: 0,
    startTime: Date.now(),
    levelScores: [],
    perfectLevels: 0,
  });

  const handleLevelComplete = useCallback((levelScore: number, perfect: boolean) => {
    setState(prev => {
      const newScores = [...prev.levelScores, levelScore];
      const newScore = prev.score + levelScore;
      const newStreak = perfect ? prev.streak + 1 : 0;
      const streakBonus = perfect && prev.streak >= 1 ? 5 : 0;
      const newPerfect = prev.perfectLevels + (perfect ? 1 : 0);

      if (prev.level === 5) {
        return {
          ...prev,
          phase: "results",
          score: newScore + streakBonus,
          streak: newStreak,
          levelScores: newScores,
          perfectLevels: newPerfect,
        };
      }

      return {
        ...prev,
        phase: "transition",
        score: newScore + streakBonus,
        streak: newStreak,
        levelScores: newScores,
        perfectLevels: newPerfect,
      };
    });
  }, []);

  const advanceLevel = useCallback(() => {
    setState(prev => ({
      ...prev,
      level: (prev.level + 1) as any,
      phase: "playing",
    }));
  }, []);

  const startGame = () => {
    unlockAudio();
    setState(prev => ({ ...prev, phase: "playing", startTime: Date.now() }));
  };

  const previewBanner = previewMode ? (
    <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
      <span className="text-xl">👀</span>
      <div>
        <p className="text-amber-300 font-bold text-sm">Modo Preview</p>
        <p className="text-amber-300/60 text-xs">Los resultados NO se guardan</p>
      </div>
    </div>
  ) : null;

  if (state.phase === "intro") {
    return (
      <>
        {previewBanner}
        <IntroScreen onStart={startGame} />
      </>
    );
  }

  if (state.phase === "transition") {
    return <LevelTransition level={state.level} score={state.score} onContinue={advanceLevel} />;
  }

  if (state.phase === "results") {
    return (
      <PhraseResults
        state={state}
        profile={profile}
        previewMode={previewMode}
      />
    );
  }

  // phase === "playing"
  return (
    <div className="flex flex-col h-full">
      {previewBanner}
      {/* Level header */}
      <div className="flex justify-between items-center py-2 px-2 shrink-0">
        <div className="bg-white/10 px-3 py-1 rounded-full text-sm font-bold text-gray-400">
          Nivel {state.level} / 5
        </div>
        <div className="text-sm font-bold text-gray-400">
          {LEVEL_CONFIG[state.level - 1].emoji} {LEVEL_CONFIG[state.level - 1].title}
        </div>
        <div className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-sm font-bold">
          {state.score} pts
        </div>
      </div>
      {/* Level progress dots */}
      <div className="flex gap-2 justify-center mb-4">
        {LEVEL_CONFIG.map((l, i) => (
          <div
            key={l.id}
            className={`w-3 h-3 rounded-full transition-all ${
              i < state.level - 1
                ? "bg-teal-400"
                : i === state.level - 1
                ? "bg-white scale-125"
                : "bg-white/20"
            }`}
          />
        ))}
      </div>
      {/* Level content */}
      <div className="flex-1 min-h-0">
        {state.level === 1 && <Level1BubbleOrder onComplete={handleLevelComplete} />}
        {state.level === 2 && <Level2FillGaps onComplete={handleLevelComplete} />}
        {state.level === 3 && <Level3Scramble onComplete={handleLevelComplete} />}
        {state.level === 4 && <Level4TypeIt onComplete={handleLevelComplete} />}
        {state.level === 5 && <Level5Boss onComplete={handleLevelComplete} />}
      </div>
    </div>
  );
}

// ============================================================
// INTRO SCREEN
// ============================================================

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <img
        src="/images/phrase/season-scene.png"
        alt="Four Seasons"
        className="w-48 h-48 lg:w-64 lg:h-64 object-contain mb-6 rounded-3xl shadow-2xl"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <h1 className="text-3xl lg:text-5xl font-bold text-white mb-4">
        🌈 Phrase Challenge
      </h1>
      <p className="text-lg text-gray-300 mb-2">Aprende esta frase en inglés:</p>
      <p className="text-2xl lg:text-3xl font-bold text-teal-400 mb-8 italic">
        &ldquo;A season full of color and joy&rdquo;
      </p>
      <p className="text-sm text-gray-500 mb-8">5 niveles de aventura — de fácil a difícil</p>
      <button
        onClick={onStart}
        className="bg-gradient-to-r from-teal-500 to-blue-500 text-white font-bold text-xl px-12 py-5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl min-h-[56px]"
      >
        ¡Comenzar! 🚀
      </button>
    </div>
  );
}

// ============================================================
// LEVEL TRANSITION
// ============================================================

function LevelTransition({ level, score, onContinue }: { level: number; score: number; onContinue: () => void }) {
  const nextLevel = level + 1;
  const config = LEVEL_CONFIG[nextLevel - 1];

  useEffect(() => {
    playSfx("success");
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-fade-in">
      <div className="text-6xl mb-4 animate-bounce">✅</div>
      <h2 className="text-3xl font-bold text-white mb-2">¡Nivel {level} completado!</h2>
      <p className="text-yellow-400 font-bold text-lg mb-8">{score} puntos acumulados</p>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8 max-w-sm w-full">
        <div className="text-5xl mb-3">{config.emoji}</div>
        <h3 className="text-2xl font-bold text-white mb-1">Nivel {nextLevel}: {config.title}</h3>
        <p className="text-gray-400">{config.desc}</p>
      </div>

      <button
        onClick={onContinue}
        className="bg-gradient-to-r from-teal-500 to-blue-500 text-white font-bold text-xl px-12 py-5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl min-h-[56px]"
      >
        Siguiente nivel ➡
      </button>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
      `}</style>
    </div>
  );
}

// ============================================================
// LEVEL 1 — Bubble Order (Tap words in correct order)
// ============================================================

function Level1BubbleOrder({ onComplete }: { onComplete: (score: number, perfect: boolean) => void }) {
  const [shuffled] = useState(() => shuffleArray(PHRASE_WORDS.map((w, i) => ({ word: w, idx: i }))));
  const [selected, setSelected] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<"ok" | "no" | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => { playFullPhrase(); }, []);

  const handleTapBubble = (wordIdx: number) => {
    if (feedback) return;
    if (selected.includes(wordIdx)) {
      // Deselect
      setSelected(prev => prev.filter(i => i !== wordIdx));
      return;
    }

    const nextExpected = selected.length;
    if (wordIdx === nextExpected) {
      // Correct order
      const newSelected = [...selected, wordIdx];
      setSelected(newSelected);
      playPhraseWord(PHRASE_WORDS[wordIdx]);

      if (newSelected.length === PHRASE_WORDS.length) {
        // All selected correctly
        setFeedback("ok");
        playSfx("success");
      }
    } else {
      // Wrong order — shake and reset
      setAttempts(prev => prev + 1);
      playSfx("error");
      setFeedback("no");
      setTimeout(() => {
        setFeedback(null);
        setSelected([]);
      }, 800);
    }
  };

  const handleComplete = () => {
    const score = attempts === 0 ? 20 : attempts === 1 ? 15 : 10;
    onComplete(score, attempts === 0);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4">
      {/* Left: image + audio */}
      <div className="lg:w-[35%] flex flex-col items-center justify-center shrink-0">
        <img
          src="/images/phrase/season-scene.png"
          alt=""
          className="w-32 h-32 lg:w-48 lg:h-48 object-contain mb-4 rounded-2xl"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <button
          onClick={playFullPhrase}
          className="text-4xl mb-2 opacity-70 hover:opacity-100 active:scale-90 transition-all min-h-[56px]"
          aria-label="Escuchar frase"
        >
          🔊
        </button>
        <p className="text-xs text-gray-500">Toca para escuchar</p>
      </div>

      {/* Right: sentence bar + bubbles */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        {/* Sentence bar */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {PHRASE_WORDS.map((w, i) => (
            <div
              key={i}
              className={`px-4 py-2 rounded-xl border-2 min-w-[60px] min-h-[44px] flex items-center justify-center font-bold text-lg transition-all ${
                selected.includes(i)
                  ? "border-teal-400 bg-teal-400/20 text-teal-300"
                  : "border-white/10 bg-black/20 text-gray-600"
              }`}
            >
              {selected.includes(i) ? w : "?"}
            </div>
          ))}
        </div>

        {/* Word bubbles */}
        <div className="flex flex-wrap gap-3 justify-center max-w-lg">
          {shuffled.map((item) => {
            const isPlaced = selected.includes(item.idx);
            return (
              <button
                key={item.idx}
                onClick={() => handleTapBubble(item.idx)}
                disabled={isPlaced || feedback === "ok"}
                className={`px-6 py-3 rounded-full font-bold text-lg transition-all min-h-[48px] ${
                  isPlaced
                    ? "bg-teal-400/10 text-teal-400/30 border border-teal-400/20 cursor-default"
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/20 active:scale-95"
                } ${feedback === "no" && !isPlaced ? "animate-shake" : ""}`}
              >
                {item.word}
              </button>
            );
          })}
        </div>

        {/* Feedback overlay */}
        {feedback === "ok" && (
          <div className="mt-8 text-center animate-fade-in">
            <div className="text-6xl mb-3 animate-bounce">✅</div>
            <p className="text-2xl font-bold text-white mb-4">{randomMsg(CORRECT_MSGS)}</p>
            <button
              onClick={handleComplete}
              className="bg-white text-black font-bold text-xl px-12 py-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl min-h-[56px]"
            >
              Siguiente ➡
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}

// ============================================================
// LEVEL 2 — Fill the Gaps
// ============================================================

function Level2FillGaps({ onComplete }: { onComplete: (score: number, perfect: boolean) => void }) {
  const [blankIndices] = useState(() => {
    const set = BLANK_SETS[Math.floor(Math.random() * BLANK_SETS.length)];
    return set;
  });
  const [wordBank] = useState(() => {
    const correct = blankIndices.map(i => PHRASE_WORDS[i]);
    const distractors = shuffleArray([...DISTRACTORS]).slice(0, 2);
    return shuffleArray([...correct, ...distractors]);
  });
  const [filled, setFilled] = useState<Record<number, string>>({});
  const [selectedBlank, setSelectedBlank] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"ok" | "no" | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => { playFullPhrase(); }, []);

  const handleBlankTap = (idx: number) => {
    if (feedback) return;
    if (filled[idx]) {
      // Remove word from blank
      setFilled(prev => { const n = { ...prev }; delete n[idx]; return n; });
      return;
    }
    setSelectedBlank(idx);
  };

  const handleWordTap = (word: string) => {
    if (feedback) return;
    if (selectedBlank === null) return;
    // Check if word already used
    if (Object.values(filled).includes(word)) return;

    const newFilled = { ...filled, [selectedBlank]: word };
    setFilled(newFilled);
    setSelectedBlank(null);
    playPhraseWord(word);

    // Check if all blanks filled
    if (Object.keys(newFilled).length === blankIndices.length) {
      // Validate
      const allCorrect = blankIndices.every(i => newFilled[i]?.toLowerCase() === PHRASE_WORDS[i].toLowerCase());
      if (allCorrect) {
        setFeedback("ok");
        playSfx("success");
      } else {
        setFeedback("no");
        setAttempts(prev => prev + 1);
        playSfx("error");
        setTimeout(() => {
          setFeedback(null);
          setFilled({});
          setSelectedBlank(null);
        }, 1200);
      }
    }
  };

  const handleComplete = () => {
    const correctCount = blankIndices.filter(i => filled[i]?.toLowerCase() === PHRASE_WORDS[i].toLowerCase()).length;
    const base = correctCount * 5 + (correctCount === blankIndices.length ? 10 : 0);
    const score = attempts === 0 ? base : Math.max(base - attempts * 3, 5);
    onComplete(score, attempts === 0);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      {/* Audio button */}
      <button onClick={playFullPhrase} className="text-3xl mb-6 opacity-70 hover:opacity-100 active:scale-90 transition-all min-h-[48px]">
        🔊 Escuchar
      </button>

      {/* Phrase with blanks */}
      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {PHRASE_WORDS.map((w, i) => {
          const isBlank = blankIndices.includes(i);
          if (!isBlank) {
            return (
              <span key={i} className="px-4 py-2 text-xl font-bold text-white">
                {w}
              </span>
            );
          }
          const filledWord = filled[i];
          const isSelected = selectedBlank === i;
          return (
            <button
              key={i}
              onClick={() => handleBlankTap(i)}
              className={`px-4 py-2 rounded-xl border-2 min-w-[80px] min-h-[48px] text-xl font-bold transition-all ${
                filledWord
                  ? feedback === "no"
                    ? "border-red-400 bg-red-400/20 text-red-300 animate-shake"
                    : feedback === "ok"
                    ? "border-teal-400 bg-teal-400/20 text-teal-300"
                    : "border-blue-400 bg-blue-400/20 text-blue-300"
                  : isSelected
                  ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                  : "border-dashed border-white/30 bg-white/5 text-gray-500"
              }`}
            >
              {filledWord || "___"}
            </button>
          );
        })}
      </div>

      {/* Word bank */}
      {feedback !== "ok" && (
        <div className="flex flex-wrap gap-3 justify-center">
          {wordBank.map((word, i) => {
            const isUsed = Object.values(filled).includes(word);
            return (
              <button
                key={i}
                onClick={() => handleWordTap(word)}
                disabled={isUsed}
                className={`px-6 py-3 rounded-full font-bold text-lg transition-all min-h-[48px] ${
                  isUsed
                    ? "bg-white/5 text-white/20 border border-white/5"
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/20 active:scale-95"
                }`}
              >
                {word}
              </button>
            );
          })}
        </div>
      )}

      {/* Success */}
      {feedback === "ok" && (
        <div className="mt-6 text-center animate-fade-in">
          <div className="text-6xl mb-3 animate-bounce">✅</div>
          <p className="text-2xl font-bold text-white mb-4">{randomMsg(CORRECT_MSGS)}</p>
          <button
            onClick={handleComplete}
            className="bg-white text-black font-bold text-xl px-12 py-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl min-h-[56px]"
          >
            Siguiente ➡
          </button>
        </div>
      )}

      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}

// ============================================================
// LEVEL 3 — Scrambled Words
// ============================================================

function Level3Scramble({ onComplete }: { onComplete: (score: number, perfect: boolean) => void }) {
  const [wordIdx, setWordIdx] = useState(0); // index into SCRAMBLE_INDICES
  const [scrambled, setScrambled] = useState(() => scrambleWord(PHRASE_WORDS[SCRAMBLE_INDICES[0]]));
  const [input, setInput] = useState<string[]>([]);
  const [available, setAvailable] = useState<{ letter: string; used: boolean }[]>(() =>
    scrambled.split("").map(l => ({ letter: l, used: false }))
  );
  const [feedback, setFeedback] = useState<"ok" | "no" | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [errors, setErrors] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);

  const currentPhraseIdx = SCRAMBLE_INDICES[wordIdx];
  const currentWord = PHRASE_WORDS[currentPhraseIdx];

  const resetWord = (newWordIdx: number) => {
    const phraseIdx = SCRAMBLE_INDICES[newWordIdx];
    const word = PHRASE_WORDS[phraseIdx];
    const scr = scrambleWord(word);
    setScrambled(scr);
    setInput([]);
    setAvailable(scr.split("").map(l => ({ letter: l, used: false })));
    setFeedback(null);
  };

  const handleLetterTap = (idx: number) => {
    if (feedback) return;
    if (available[idx].used) return;

    const newInput = [...input, available[idx].letter];
    setInput(newInput);
    setAvailable(prev => prev.map((l, i) => i === idx ? { ...l, used: true } : l));
    playLetterAudio(available[idx].letter);

    // Check if complete
    if (newInput.length === currentWord.length) {
      const typed = newInput.join("");
      if (typed.toLowerCase() === currentWord.toLowerCase()) {
        setFeedback("ok");
        playSfx("success");
        setSolvedCount(prev => prev + 1);
      } else {
        setFeedback("no");
        playSfx("error");
        setErrors(prev => prev + 1);
        setTimeout(() => {
          setInput([]);
          setAvailable(scrambled.split("").map(l => ({ letter: l, used: false })));
          setFeedback(null);
        }, 800);
      }
    }
  };

  const handleUndo = () => {
    if (feedback || input.length === 0) return;
    const lastLetter = input[input.length - 1];
    setInput(prev => prev.slice(0, -1));
    // Find last used instance of that letter and un-use it
    setAvailable(prev => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].used && copy[i].letter === lastLetter) {
          copy[i] = { ...copy[i], used: false };
          break;
        }
      }
      return copy;
    });
  };

  const handleHint = () => {
    if (hintsUsed >= 3) return;
    setHintsUsed(prev => prev + 1);
    playPhraseWord(currentWord);
  };

  const handleNextWord = () => {
    const next = wordIdx + 1;
    if (next >= SCRAMBLE_INDICES.length) {
      // All words unscrambled
      const base = solvedCount * 8;
      const hintPenalty = hintsUsed * 2;
      const score = Math.max(base - hintPenalty, 5);
      onComplete(score, errors === 0 && hintsUsed === 0);
      return;
    }
    setWordIdx(next);
    resetWord(next);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      {/* Phrase display showing which word is being unscrambled */}
      <div className="flex flex-wrap gap-1 justify-center mb-6">
        {PHRASE_WORDS.map((w, i) => {
          const isScrambleTarget = SCRAMBLE_INDICES.includes(i);
          const scramblePos = SCRAMBLE_INDICES.indexOf(i);
          const isSolved = scramblePos !== -1 && scramblePos < wordIdx;
          const isCurrent = i === currentPhraseIdx;

          return (
            <span
              key={i}
              className={`px-2 py-1 rounded text-lg font-bold transition-all ${
                isCurrent
                  ? "text-yellow-400 bg-yellow-400/10 border border-yellow-400/30"
                  : isSolved
                  ? "text-teal-400"
                  : isScrambleTarget
                  ? "text-gray-500"
                  : "text-white"
              }`}
            >
              {isCurrent ? "???" : w}
            </span>
          );
        })}
      </div>

      {/* Progress: word X of Y */}
      <p className="text-sm text-gray-500 mb-4">Palabra {wordIdx + 1} de {SCRAMBLE_INDICES.length}</p>

      {/* Letter slots */}
      <div className={`flex gap-2 justify-center mb-6 ${feedback === "no" ? "animate-shake" : ""}`}>
        {Array.from({ length: currentWord.length }).map((_, i) => (
          <div
            key={i}
            className={`w-12 h-14 lg:w-16 lg:h-[72px] rounded-xl border-2 flex items-center justify-center text-2xl lg:text-3xl font-bold uppercase transition-all ${
              input[i]
                ? feedback === "ok"
                  ? "border-teal-400 bg-teal-400/20 text-teal-300"
                  : "border-white bg-white/20 text-white"
                : "border-white/10 bg-black/20 text-gray-600"
            }`}
          >
            {input[i] || ""}
          </div>
        ))}
      </div>

      {/* Available letter tiles */}
      {feedback !== "ok" && (
        <div className="flex gap-2 justify-center mb-4 flex-wrap">
          {available.map((l, i) => (
            <button
              key={i}
              onClick={() => handleLetterTap(i)}
              disabled={l.used}
              className={`w-12 h-12 lg:w-14 lg:h-14 rounded-xl font-bold text-xl uppercase transition-all ${
                l.used
                  ? "bg-white/5 text-white/10 border border-white/5"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/20 active:scale-95"
              }`}
            >
              {l.letter}
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      {feedback !== "ok" && (
        <div className="flex gap-4 mt-2">
          <button
            onClick={handleUndo}
            className="bg-red-500/20 text-red-300 px-4 py-2 rounded-xl font-bold active:scale-95 transition-all min-h-[48px]"
          >
            ⌫ Borrar
          </button>
          <button
            onClick={handleHint}
            disabled={hintsUsed >= 3}
            className={`px-4 py-2 rounded-xl font-bold active:scale-95 transition-all min-h-[48px] ${
              hintsUsed >= 3
                ? "bg-white/5 text-white/20"
                : "bg-blue-500/20 text-blue-300"
            }`}
          >
            🔊 Pista ({3 - hintsUsed})
          </button>
        </div>
      )}

      {/* Word complete feedback */}
      {feedback === "ok" && (
        <div className="mt-6 text-center animate-fade-in">
          <div className="text-5xl mb-2">✅</div>
          <p className="text-xl font-bold text-teal-400 mb-4">&ldquo;{currentWord}&rdquo;</p>
          <button
            onClick={handleNextWord}
            className="bg-white text-black font-bold text-lg px-10 py-3 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl min-h-[48px]"
          >
            {wordIdx + 1 >= SCRAMBLE_INDICES.length ? "¡Listo!" : "Siguiente palabra ➡"}
          </button>
        </div>
      )}

      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}

// ============================================================
// LEVEL 4 — Type It Out
// ============================================================

function Level4TypeIt({ onComplete }: { onComplete: (score: number, perfect: boolean) => void }) {
  const [input, setInput] = useState("");
  const [wordStatuses, setWordStatuses] = useState<("pending" | "correct" | "wrong")[]>(
    PHRASE_WORDS.map(() => "pending")
  );
  const [replaysUsed, setReplaysUsed] = useState(0);
  const [retypes, setRetypes] = useState(0);
  const [allCorrect, setAllCorrect] = useState(false);

  useEffect(() => { playFullPhrase(); }, []);

  const typedWords = input.split(" ").filter(Boolean);

  const handleKey = (key: string) => {
    if (allCorrect) return;
    if (key === "BACK") {
      setInput(prev => prev.slice(0, -1));
    } else if (key === "SPACE") {
      // Validate current word
      const currentWordIdx = typedWords.length - 1;
      if (currentWordIdx < 0) return;
      const typed = typedWords[currentWordIdx];
      const expected = PHRASE_WORDS[currentWordIdx];

      if (typed?.toLowerCase() === expected.toLowerCase()) {
        setWordStatuses(prev => prev.map((s, i) => i === currentWordIdx ? "correct" : s));
        setInput(prev => prev + " ");
        playSfx("success");

        // Check if all words done
        if (currentWordIdx === PHRASE_WORDS.length - 2) {
          // One more word to go — don't add space, wait for ENTER
        }
      } else {
        setWordStatuses(prev => prev.map((s, i) => i === currentWordIdx ? "wrong" : s));
        setRetypes(prev => prev + 1);
        playSfx("error");
        // Remove the wrong word from input
        const prevWords = typedWords.slice(0, -1);
        setTimeout(() => {
          setInput(prevWords.join(" ") + (prevWords.length > 0 ? " " : ""));
          setWordStatuses(prev => prev.map((s, i) => i === currentWordIdx ? "pending" : s));
        }, 600);
      }
    } else if (key === "ENTER") {
      // Validate last word
      const currentWordIdx = typedWords.length - 1;
      if (currentWordIdx !== PHRASE_WORDS.length - 1) return; // Not at last word yet
      const typed = typedWords[currentWordIdx];
      const expected = PHRASE_WORDS[currentWordIdx];

      if (typed?.toLowerCase() === expected.toLowerCase()) {
        setWordStatuses(prev => prev.map((s, i) => i === currentWordIdx ? "correct" : s));
        setAllCorrect(true);
        playSfx("success");
      } else {
        setWordStatuses(prev => prev.map((s, i) => i === currentWordIdx ? "wrong" : s));
        setRetypes(prev => prev + 1);
        playSfx("error");
        const prevWords = typedWords.slice(0, -1);
        setTimeout(() => {
          setInput(prevWords.join(" ") + (prevWords.length > 0 ? " " : ""));
          setWordStatuses(prev => prev.map((s, i) => i === currentWordIdx ? "pending" : s));
        }, 600);
      }
    } else {
      setInput(prev => prev + key.toLowerCase());
      playLetterAudio(key);
    }
  };

  const handleReplay = () => {
    if (replaysUsed >= 2) return;
    setReplaysUsed(prev => prev + 1);
    playFullPhrase();
  };

  const handleComplete = () => {
    const base = 40;
    const replayPenalty = replaysUsed * 5;
    const retypePenalty = retypes * 2;
    const score = Math.max(base - replayPenalty - retypePenalty, 10);
    onComplete(score, replaysUsed === 0 && retypes === 0);
  };

  const letters = "QWERTYUIOPASDFGHJKLZXCVBNM".split("");

  return (
    <div className="flex flex-col h-full">
      {/* Replay button */}
      <div className="flex justify-center mb-4 shrink-0">
        <button
          onClick={handleReplay}
          disabled={replaysUsed >= 2}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-all min-h-[44px] ${
            replaysUsed >= 2
              ? "bg-white/5 text-white/20"
              : "bg-blue-500/20 text-blue-300 active:scale-95"
          }`}
        >
          🔊 Escuchar ({2 - replaysUsed} restantes)
        </button>
      </div>

      {/* Word status display */}
      <div className="flex flex-wrap gap-2 justify-center mb-6 shrink-0">
        {PHRASE_WORDS.map((w, i) => (
          <div
            key={i}
            className={`px-3 py-2 rounded-xl font-bold text-lg min-w-[50px] text-center transition-all ${
              wordStatuses[i] === "correct"
                ? "bg-teal-400/20 text-teal-400 border border-teal-400/30"
                : wordStatuses[i] === "wrong"
                ? "bg-red-400/20 text-red-400 border border-red-400/30 animate-shake"
                : i === typedWords.length - (input.endsWith(" ") ? 0 : 1) && i < PHRASE_WORDS.length
                ? "bg-yellow-400/10 text-yellow-300 border border-yellow-400/20"
                : "bg-white/5 text-gray-500 border border-white/10"
            }`}
          >
            {wordStatuses[i] === "correct" ? w : "_ ".repeat(w.length).trim()}
          </div>
        ))}
      </div>

      {/* Text input display */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        {allCorrect ? (
          <div className="text-center animate-fade-in">
            <div className="text-6xl mb-3 animate-bounce">✅</div>
            <p className="text-2xl font-bold text-teal-400 mb-2 italic">&ldquo;{PHRASE_TEXT}&rdquo;</p>
            <p className="text-xl font-bold text-white mb-6">{randomMsg(CORRECT_MSGS)}</p>
            <button
              onClick={handleComplete}
              className="bg-white text-black font-bold text-xl px-12 py-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl min-h-[56px]"
            >
              Siguiente ➡
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-lg text-gray-300 font-mono tracking-wider min-h-[40px]">
              {input}<span className="animate-pulse text-yellow-400">|</span>
            </p>
          </div>
        )}
      </div>

      {/* Keyboard */}
      {!allCorrect && (
        <div className="shrink-0 pt-2 pb-4 lg:pb-1 px-1 lg:px-0">
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 mb-1.5 lg:mb-2">
            {letters.slice(0, 10).map(l => <KeyBtn key={l} char={l} onClick={() => handleKey(l)} />)}
          </div>
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 mb-1.5 lg:mb-2 px-4 md:px-[5%]">
            {letters.slice(10, 19).map(l => <KeyBtn key={l} char={l} onClick={() => handleKey(l)} />)}
          </div>
          <div className="grid grid-cols-12 gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 px-2 md:px-[3%]">
            <button type="button" onClick={() => handleKey("BACK")} className="col-span-2 bg-red-500/20 active:bg-red-500/40 text-red-200 rounded-lg lg:rounded-2xl font-bold flex items-center justify-center text-lg md:text-2xl shadow-md border-b-2 border-red-900/50 active:translate-y-[2px] transition-all min-h-[48px] md:min-h-[56px] lg:min-h-[64px]">⌫</button>
            {letters.slice(19, 26).map(l => <KeyBtn key={l} char={l} onClick={() => handleKey(l)} />)}
            <button type="button" onClick={() => handleKey("SPACE")} className="col-span-1 bg-blue-500/20 active:bg-blue-500/40 text-blue-200 rounded-lg lg:rounded-2xl font-bold flex items-center justify-center text-xs md:text-sm shadow-md border-b-2 border-blue-900/50 active:translate-y-[2px] transition-all min-h-[48px] md:min-h-[56px] lg:min-h-[64px]">␣</button>
            <button type="button" onClick={() => handleKey("ENTER")} className="col-span-2 bg-green-500 active:bg-green-600 text-white rounded-lg lg:rounded-2xl font-bold flex items-center justify-center text-lg md:text-2xl shadow-md border-b-2 border-green-800 active:translate-y-[2px] transition-all min-h-[48px] md:min-h-[56px] lg:min-h-[64px]">✓</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}

function KeyBtn({ char, onClick }: { char: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="aspect-[4/5] md:aspect-auto bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg lg:rounded-2xl text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white shadow-md border-b-2 border-white/5 active:translate-y-[2px] active:border-b-0 transition-all select-none min-h-[48px] md:min-h-[56px] lg:min-h-[64px]"
    >
      {char}
    </button>
  );
}

// ============================================================
// LEVEL 5 — Boss (Timed typing + surprise)
// ============================================================

function Level5Boss({ onComplete }: { onComplete: (score: number, perfect: boolean) => void }) {
  const [countdown, setCountdown] = useState<number | null>(null); // null = not started
  const [timeLeft, setTimeLeft] = useState(20);
  const [input, setInput] = useState("");
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [rewardStep, setRewardStep] = useState(0);
  const [coinAnim, setCoinAnim] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionTimeRef = useRef(0);

  // Start sequence: 3, 2, 1, GO!
  useEffect(() => {
    setCountdown(3);
    playFullPhrase();

    const t1 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    const t3 = setTimeout(() => {
      setCountdown(0);
      // Start timer
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setFailed(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 3000);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleKey = (key: string) => {
    if (completed || failed || countdown !== 0) return;

    if (key === "BACK") {
      setInput(prev => prev.slice(0, -1));
    } else if (key === "ENTER") {
      // Check full phrase
      if (input.trim().toLowerCase() === PHRASE_TEXT.toLowerCase()) {
        if (timerRef.current) clearInterval(timerRef.current);
        setCompleted(true);
        completionTimeRef.current = 20 - timeLeft;
        // Start reward sequence
        setTimeout(() => setShowReward(true), 500);
      } else {
        playSfx("error");
        setInput("");
      }
    } else if (key === "SPACE") {
      setInput(prev => prev + " ");
    } else {
      setInput(prev => prev + key.toLowerCase());
    }
  };

  // Reward animation sequence
  useEffect(() => {
    if (!showReward) return;
    const t1 = setTimeout(() => setRewardStep(1), 500);   // Image
    const t2 = setTimeout(() => setRewardStep(2), 1500);  // Confetti
    const t3 = setTimeout(() => {
      setRewardStep(3); // Coins
      playCongrats();
    }, 2500);
    const t4 = setTimeout(() => setRewardStep(4), 4500);  // Button

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [showReward]);

  // Coin counter animation
  useEffect(() => {
    if (rewardStep < 3) return;
    const targetScore = 50 + Math.max(0, (20 - completionTimeRef.current)) * 5 + 50;
    let current = 0;
    const step = Math.ceil(targetScore / 40);
    const t = setInterval(() => {
      current += step;
      if (current >= targetScore) {
        current = targetScore;
        clearInterval(t);
      }
      setCoinAnim(current);
    }, 50);
    return () => clearInterval(t);
  }, [rewardStep]);

  const handleRetry = () => {
    setFailed(false);
    setInput("");
    setTimeLeft(20);
    setCountdown(3);
    playFullPhrase();

    const t1 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    const t3 = setTimeout(() => {
      setCountdown(0);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setFailed(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 3000);
  };

  const handleFinalComplete = () => {
    const baseScore = 50;
    const timeBonus = Math.max(0, (20 - completionTimeRef.current)) * 5;
    const completionBonus = 50;
    const total = baseScore + timeBonus + completionBonus;
    onComplete(total, true);
  };

  // Timer circle
  const timerPct = (timeLeft / 20) * 100;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (timerPct / 100) * circumference;

  const letters = "QWERTYUIOPASDFGHJKLZXCVBNM".split("");

  // Reward screen
  if (showReward) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden">
        {rewardStep >= 2 && <Confetti />}
        {rewardStep >= 2 && <Confetti />}

        {rewardStep >= 1 && (
          <img
            src="/images/phrase/season-scene-reveal.png"
            alt="Celebration"
            className="w-64 h-64 lg:w-80 lg:h-80 object-contain mb-6 animate-reward-reveal"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}

        {rewardStep >= 3 && (
          <div className="text-center animate-fade-in">
            <h2 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent mb-4">
              PHRASE MASTER!
            </h2>
            <img
              src="/images/phrase/phrase-master-diploma.png"
              alt="Diploma"
              className="w-48 h-36 lg:w-64 lg:h-48 object-contain mx-auto mb-4 rounded-xl shadow-2xl"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="text-5xl font-bold text-yellow-400 mb-2">
              +{coinAnim} 💰
            </div>
          </div>
        )}

        {rewardStep >= 4 && (
          <button
            onClick={handleFinalComplete}
            className="mt-6 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-xl px-12 py-5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl min-h-[56px] animate-fade-in"
          >
            Ver Resultados 🎉
          </button>
        )}

        <style>{`
          @keyframes reward-reveal {
            from { transform: scale(0) rotate(-10deg); opacity: 0; }
            to { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          .animate-reward-reveal { animation: reward-reveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }
          @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in { animation: fade-in 0.5s ease-out; }
        `}</style>
      </div>
    );
  }

  // Countdown screen
  if (countdown !== null && countdown > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-8xl font-bold text-white animate-pulse">{countdown}</div>
        <p className="text-gray-400 mt-4">Prepárate...</p>
      </div>
    );
  }

  // Failed screen
  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="text-6xl mb-4">⏰</div>
        <h2 className="text-3xl font-bold text-white mb-2">¡Se acabó el tiempo!</h2>
        <p className="text-gray-400 mb-8">¡Casi! Intenta una vez más</p>
        <button
          onClick={handleRetry}
          className="bg-gradient-to-r from-teal-500 to-blue-500 text-white font-bold text-xl px-12 py-5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl min-h-[56px]"
        >
          Intentar otra vez 🔄
        </button>
      </div>
    );
  }

  // Playing screen
  return (
    <div className="flex flex-col h-full">
      {/* Timer circle */}
      <div className="flex justify-center mb-4 shrink-0">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
            <circle
              cx="50" cy="50" r="45"
              stroke={timeLeft <= 5 ? "#ef4444" : timeLeft <= 10 ? "#eab308" : "#22c55e"}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-white"}`}>
            {timeLeft}
          </div>
        </div>
      </div>

      {/* Input display */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <p className="text-xl lg:text-2xl text-gray-300 font-mono tracking-wider min-h-[40px] text-center px-4">
          {input}<span className="animate-pulse text-yellow-400">|</span>
        </p>
      </div>

      {/* Keyboard */}
      <div className="shrink-0 pt-2 pb-4 lg:pb-1 px-1 lg:px-0">
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 mb-1.5 lg:mb-2">
          {letters.slice(0, 10).map(l => <KeyBtn key={l} char={l} onClick={() => handleKey(l)} />)}
        </div>
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 mb-1.5 lg:mb-2 px-4 md:px-[5%]">
          {letters.slice(10, 19).map(l => <KeyBtn key={l} char={l} onClick={() => handleKey(l)} />)}
        </div>
        <div className="grid grid-cols-12 gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 px-2 md:px-[3%]">
          <button type="button" onClick={() => handleKey("BACK")} className="col-span-2 bg-red-500/20 active:bg-red-500/40 text-red-200 rounded-lg lg:rounded-2xl font-bold flex items-center justify-center text-lg md:text-2xl shadow-md border-b-2 border-red-900/50 active:translate-y-[2px] transition-all min-h-[48px] md:min-h-[56px] lg:min-h-[64px]">⌫</button>
          {letters.slice(19, 26).map(l => <KeyBtn key={l} char={l} onClick={() => handleKey(l)} />)}
          <button type="button" onClick={() => handleKey("SPACE")} className="col-span-1 bg-blue-500/20 active:bg-blue-500/40 text-blue-200 rounded-lg lg:rounded-2xl font-bold flex items-center justify-center text-xs md:text-sm shadow-md border-b-2 border-blue-900/50 active:translate-y-[2px] transition-all min-h-[48px] md:min-h-[56px] lg:min-h-[64px]">␣</button>
          <button type="button" onClick={() => handleKey("ENTER")} className="col-span-2 bg-green-500 active:bg-green-600 text-white rounded-lg lg:rounded-2xl font-bold flex items-center justify-center text-lg md:text-2xl shadow-md border-b-2 border-green-800 active:translate-y-[2px] transition-all min-h-[48px] md:min-h-[56px] lg:min-h-[64px]">✓</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RESULTS SCREEN
// ============================================================

function PhraseResults({
  state,
  profile,
  previewMode,
}: {
  state: PhraseGameState;
  profile: any;
  previewMode: boolean;
}) {
  const accuracy = Math.round((state.perfectLevels / 5) * 100);
  const showConfetti = state.perfectLevels >= 3;
  const timeSeconds = Math.round((Date.now() - state.startTime) / 1000);

  useEffect(() => {
    if (!previewMode && state.score > 0) {
      submitPhraseResult(state.score, accuracy, {
        levelsCompleted: state.levelScores.length,
        perfectLevels: state.perfectLevels,
        timeSeconds,
        levelScores: state.levelScores,
      });
    }
  }, []);

  let resultEmoji: string;
  let resultMessage: string;
  if (state.perfectLevels === 5) {
    resultEmoji = "🏆";
    resultMessage = "¡PERFECTO! ¡Eres un maestro de las frases!";
  } else if (state.perfectLevels >= 3) {
    resultEmoji = "⭐";
    resultMessage = "¡Increíble! ¡Casi perfecto!";
  } else {
    resultEmoji = "💪";
    resultMessage = "¡Buen trabajo! La práctica hace al maestro";
  }

  return (
    <div className="max-w-md md:max-w-2xl mx-auto p-4 text-center h-full flex flex-col justify-center relative">
      {showConfetti && <Confetti />}

      <div className="text-8xl mb-6 animate-bounce">{resultEmoji}</div>
      <h2 className="text-4xl font-bold mb-2 text-white">{resultMessage}</h2>
      <p className="text-gray-400 mb-8 text-lg italic">&ldquo;{PHRASE_TEXT}&rdquo;</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white/5 rounded-3xl p-4 border border-white/5">
          <div className="text-3xl font-bold text-teal-400 mb-1">{state.perfectLevels}/5</div>
          <div className="text-xs text-gray-500 uppercase tracking-widest">Perfectos</div>
        </div>
        <div className="bg-white/5 rounded-3xl p-4 border border-white/5">
          <div className="text-3xl font-bold text-yellow-400 mb-1">+{state.score}</div>
          <div className="text-xs text-gray-500 uppercase tracking-widest">Monedas</div>
        </div>
        <div className="bg-white/5 rounded-3xl p-4 border border-white/5">
          <div className="text-3xl font-bold text-blue-400 mb-1">{timeSeconds}s</div>
          <div className="text-xs text-gray-500 uppercase tracking-widest">Tiempo</div>
        </div>
      </div>

      {/* Level breakdown */}
      <div className="bg-white/5 rounded-2xl p-4 mb-8 border border-white/5">
        {LEVEL_CONFIG.map((l, i) => (
          <div key={l.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0">
            <span className="text-sm text-gray-400">{l.emoji} {l.title}</span>
            <span className="font-bold text-sm text-yellow-300">
              {state.levelScores[i] !== undefined ? `+${state.levelScores[i]}` : "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <a
          href="/phrase-challenge"
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-transform min-h-[56px] flex items-center justify-center"
        >
          🔄 Jugar otra vez
        </a>
        <a
          href="/"
          className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform min-h-[56px] flex items-center justify-center"
        >
          🏠 Salir
        </a>
      </div>
    </div>
  );
}
