"use client";

import { useState, useEffect } from "react";
import { CATEGORIES, HINTS, DIFFICULTY, type Hint } from "@/lib/words";
import { unlockAudio, playWordAudio, playSfx, preloadWordAudio, playLetterAudio } from "@/lib/audio";
import { submitGameResult } from "@/lib/actions";
import ProgressBar from "./ProgressBar";
import Confetti from "./Confetti";

// --- Feedback messages ---
const CORRECT_MESSAGES = [
    "¡Correcto!",
    "¡Genial!",
    "¡Increíble!",
    "¡Eres un crack!",
    "¡Excelente!",
];

const INCORRECT_MESSAGES = [
    "¡Casi! Era",
    "No te preocupes, era",
];

function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

type GameState = {
    diff: keyof typeof DIFFICULTY;
    words: { w: string; c: keyof typeof CATEGORIES }[];
    index: number;
    answers: any[];
    startTime: number;
    timeLeft: number | null;
    score: number;
    streak: number;
    status: "playing" | "results";
};

export default function GameEngine({ profile }: { profile: any }) {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [selectedDiff, setSelectedDiff] = useState<keyof typeof DIFFICULTY | null>(null);

    const startGame = (diffKey: keyof typeof DIFFICULTY) => {
        const diff = DIFFICULTY[diffKey];

        // Select random words
        const cats = Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>;
        const shuffledCats = cats.sort(() => 0.5 - Math.random()).slice(0, 5);

        let pool: { w: string; c: keyof typeof CATEGORIES }[] = [];
        shuffledCats.forEach(c => {
            const words = CATEGORIES[c].words.sort(() => 0.5 - Math.random()).slice(0, 3);
            words.forEach(w => pool.push({ w, c }));
        });

        const gameWords = pool.sort(() => 0.5 - Math.random()).slice(0, diff.wordCount);

        setGameState({
            diff: diffKey,
            words: gameWords,
            index: 0,
            answers: [],
            startTime: Date.now(),
            timeLeft: diff.timeLimit || null,
            score: 0,
            streak: 0,
            status: "playing"
        });
    };

    if (!selectedDiff) {
        return <GameSelector onSelect={(d) => { unlockAudio(); setSelectedDiff(d); startGame(d); }} />;
    }

    if (gameState?.status === "results") {
        return <GameResults gameState={gameState} onRestart={() => setSelectedDiff(null)} profile={profile} />;
    }

    return <GamePlay gameState={gameState!} setGameState={setGameState} />;
}

// --- SUB COMPONENTS ---

export function GameSelector({ onSelect }: { onSelect: (d: keyof typeof DIFFICULTY) => void }) {
    return (
        <div className="max-w-md md:max-w-2xl mx-auto p-4 flex flex-col h-full justify-center">
            <h2 className="text-4xl font-bold text-center mb-12 text-white">🐝 Spelling Bee</h2>
            <div className="space-y-6">
                {(Object.entries(DIFFICULTY) as [keyof typeof DIFFICULTY, any][]).map(([key, d]) => (
                    <button
                        key={key}
                        onClick={() => onSelect(key)}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-6 transition-all text-left flex items-center gap-6 group active:scale-95"
                        style={{ borderColor: d.color + '40' }}
                    >
                        <div className="text-4xl min-w-[60px] text-center">{"⭐".repeat(d.stars)}</div>
                        <div className="flex-1">
                            <div className="text-2xl font-bold mb-1" style={{ color: d.color }}>{d.label}</div>
                            <div className="text-sm text-gray-400">{d.desc}</div>
                        </div>
                        <div className="text-3xl font-bold opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: d.color }}>
                            ▶
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function TimerBar({ timeLeft, timeLimit }: { timeLeft: number; timeLimit: number }) {
    const pct = (timeLeft / timeLimit) * 100;
    const isUrgent = timeLeft <= 5;

    let barColor: string;
    if (timeLeft <= 5) {
        barColor = "#ef4444"; // red-500
    } else if (timeLeft <= timeLimit * 0.4) {
        barColor = "#eab308"; // yellow-500
    } else {
        barColor = "#22c55e"; // green-500
    }

    return (
        <div className={`flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full ${isUrgent ? 'animate-pulse' : ''}`}>
            <span className={`text-sm font-bold ${isUrgent ? 'text-red-400' : 'text-gray-400'}`}>
                ⏱ {timeLeft}s
            </span>
            <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{
                        width: `${pct}%`,
                        backgroundColor: barColor,
                        boxShadow: isUrgent ? `0 0 8px ${barColor}` : "none",
                    }}
                />
            </div>
        </div>
    );
}

function GamePlay({ gameState, setGameState }: { gameState: GameState, setGameState: any }) {
    const [input, setInput] = useState("");
    const [feedback, setFeedback] = useState<"ok" | "no" | null>(null);
    const [feedbackMsg, setFeedbackMsg] = useState("");
    const [imgError, setImgError] = useState(false);

    const currentWord = gameState.words[gameState.index];
    const diff = DIFFICULTY[gameState.diff];
    const hint: Hint = HINTS[currentWord.w] || { emoji: "❓", image: "" };
    const cat = CATEGORIES[currentWord.c];

    // Reset input and image state, auto-play pronunciation on new word
    useEffect(() => {
        setInput("");
        setImgError(false);
        playWordAudio(currentWord.w);

        // Preload next word's audio
        const nextIndex = gameState.index + 1;
        if (nextIndex < gameState.words.length) {
            preloadWordAudio(gameState.words[nextIndex].w);
        }
    }, [gameState.index]);

    useEffect(() => {
        if (!diff.timeLimit || gameState.timeLeft === null) return;
        if (gameState.timeLeft <= 0) {
            submitAnswer("");
            return;
        }
        const t = setInterval(() => {
            setGameState((prev: GameState) => ({ ...prev, timeLeft: (prev.timeLeft || 0) - 1 }));
        }, 1000);
        return () => clearInterval(t);
    }, [gameState.timeLeft]);

    const handleKey = (key: string) => {
        if (feedback) return; // Block input during feedback
        if (key === "BACK") {
            setInput(prev => prev.slice(0, -1));
        } else if (key === "ENTER") {
            submitAnswer();
        } else {
            if (input.length < currentWord.w.length) {
                setInput(prev => prev + key);
                playLetterAudio(key);
            }
        }
    };

    const submitAnswer = (overrideInput?: string) => {
        const val = overrideInput !== undefined ? overrideInput : input;
        const isCorrect = val.trim().toLowerCase() === currentWord.w.toLowerCase();

        if (isCorrect) {
            setFeedback("ok");
            setFeedbackMsg(randomFrom(CORRECT_MESSAGES));
            playSfx("success");
        } else {
            setFeedback("no");
            setFeedbackMsg(randomFrom(INCORRECT_MESSAGES));
            playSfx("error");
        }
    };

    const nextWord = () => {
        setFeedback(null);
        const val = input;
        const isCorrect = val.trim().toLowerCase() === currentWord.w.toLowerCase();

        // Calculate Score
        const base = isCorrect ? (currentWord.w.length <= 3 ? 5 : currentWord.w.length <= 5 ? 10 : 15) : 0;
        const streakBonus = isCorrect && gameState.streak >= 2 ? 5 : 0;
        const points = (base + streakBonus) * diff.multiplier;

        const newStreak = isCorrect ? gameState.streak + 1 : 0;
        const newScore = gameState.score + points;

        const newAnswer = { w: currentWord.w, ok: isCorrect, input: val, pts: points };
        const nextIndex = gameState.index + 1;

        if (nextIndex >= gameState.words.length) {
            setGameState({ ...gameState, index: nextIndex, answers: [...gameState.answers, newAnswer], score: newScore, streak: newStreak, status: "results" });
        } else {
            setGameState({ ...gameState, index: nextIndex, answers: [...gameState.answers, newAnswer], score: newScore, streak: newStreak, timeLeft: diff.timeLimit || null });
        }
    };

    const letters = "QWERTYUIOPASDFGHJKLZXCVBNM".split("");

    return (
        <div className="flex flex-col h-full max-w-lg lg:max-w-full mx-auto pb-4 lg:pb-2">
            {/* Header Stats */}
            <div className="flex justify-between items-center py-4 lg:py-2 px-2 text-sm md:text-base font-bold text-gray-400 shrink-0">
                <div className="bg-white/10 px-3 py-1 rounded-full">{gameState.index + 1} / {gameState.words.length}</div>
                {gameState.timeLeft !== null && diff.timeLimit ? (
                    <TimerBar timeLeft={gameState.timeLeft} timeLimit={diff.timeLimit} />
                ) : (
                    <div className="bg-white/10 px-3 py-1 rounded-full">∞</div>
                )}
                <div className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full">Score: {gameState.score}</div>
            </div>

            {/* Progress Bar */}
            <ProgressBar current={gameState.index + 1} total={gameState.words.length} />

            {/* Content: vertical on mobile, side-by-side on landscape tablet */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 lg:gap-4 relative">

                {/* LEFT PANEL: Hint area (image, speaker, category) */}
                <div className="lg:w-[35%] flex flex-col items-center justify-center shrink-0 lg:shrink lg:min-h-0 mb-2 lg:mb-0">
                    {/* Hint: image with emoji fallback, or "?" in Hard mode */}
                    {diff.showHint ? (
                        !imgError && hint.image ? (
                            <img
                                src={hint.image}
                                alt=""
                                className="w-24 h-24 sm:w-32 sm:h-32 lg:w-48 lg:h-48 object-contain mb-2 drop-shadow-xl"
                                onError={() => setImgError(true)}
                                draggable={false}
                            />
                        ) : (
                            <div className="text-6xl lg:text-8xl mb-2 drop-shadow-xl">{hint.emoji}</div>
                        )
                    ) : (
                        <div className="text-6xl lg:text-8xl mb-2 drop-shadow-xl">❓</div>
                    )}

                    {/* Listen button */}
                    <button
                        onClick={() => playWordAudio(currentWord.w)}
                        className="text-3xl lg:text-4xl mb-2 opacity-70 hover:opacity-100 active:scale-90 transition-all"
                        aria-label="Escuchar pronunciación"
                    >
                        🔊
                    </button>

                    <div className="text-base lg:text-xl font-bold uppercase tracking-widest" style={{ color: cat.color }}>{cat.emoji} {currentWord.c}</div>
                </div>

                {/* RIGHT PANEL: Letter boxes + Keyboard */}
                <div className="flex-1 flex flex-col min-h-0">

                    {/* Letter boxes - centered in available space */}
                    <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                        <div className={`flex gap-2 lg:gap-4 justify-center mb-2 transition-all duration-300 ${feedback === 'no' ? 'animate-shake' : ''}`}>
                            {Array.from({ length: currentWord.w.length }).map((_, i) => (
                                <div key={i} className={`w-10 h-12 sm:w-12 sm:h-14 lg:w-16 lg:h-[72px] rounded-xl lg:rounded-2xl border-2 flex items-center justify-center text-2xl lg:text-4xl font-bold uppercase transition-all shadow-lg
                                    ${input[i]
                                        ? 'border-white bg-white/20 text-white translate-y-[-4px]'
                                        : 'border-white/10 bg-black/20 text-gray-600'}`}>
                                    {input[i] || ""}
                                </div>
                            ))}
                        </div>

                        {diff.showFirst && (
                            <div className="text-xs lg:text-sm text-yellow-500/50 font-mono mt-1 tracking-[1em] h-4">
                                {currentWord.w[0].toUpperCase()}{"_".repeat(currentWord.w.length - 1)}
                            </div>
                        )}
                    </div>

                    {/* On-Screen Keyboard - pinned to bottom of right panel */}
                    <div data-game-keyboard autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="none" className="shrink-0 pt-2 pb-4 lg:pb-1 px-1 lg:px-0">
                        <div className="grid grid-cols-10 gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 mb-1.5 lg:mb-2">
                            {letters.slice(0, 10).map(l => <Key key={l} char={l} onClick={() => handleKey(l)} />)}
                        </div>
                        <div className="grid grid-cols-10 gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 mb-1.5 lg:mb-2 px-4 md:px-[5%]">
                            {letters.slice(10, 19).map(l => <Key key={l} char={l} onClick={() => handleKey(l)} />)}
                        </div>
                        <div className="grid grid-cols-10 gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 px-8 md:px-[10%] lg:px-[5%]">
                            <button type="button" onClick={() => handleKey("BACK")} className="col-span-2 bg-red-500/20 active:bg-red-500/40 text-red-200 rounded-lg lg:rounded-2xl font-bold flex items-center justify-center text-lg md:text-2xl lg:text-3xl shadow-md border-b-2 border-red-900/50 transform active:translate-y-[2px] transition-all min-h-[48px] md:min-h-[56px] lg:min-h-[64px]">⌫</button>
                            {letters.slice(19, 26).map(l => <Key key={l} char={l} onClick={() => handleKey(l)} />)}
                            <button type="button" onClick={() => handleKey("ENTER")} className="col-span-2 bg-green-500 active:bg-green-600 text-white rounded-lg lg:rounded-2xl font-bold flex items-center justify-center text-lg md:text-2xl lg:text-3xl shadow-md border-b-2 border-green-800 transform active:translate-y-[2px] transition-all min-h-[48px] md:min-h-[56px] lg:min-h-[64px]">✓</button>
                        </div>
                    </div>
                </div>

                {/* Feedback Overlay - covers both panels */}
                {feedback && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-3xl animate-in fade-in zoom-in duration-200">
                        <div className="text-8xl mb-4 animate-bounce filter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                            {feedback === "ok" ? "✅" : "❌"}
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-2">
                            {feedback === "ok" ? feedbackMsg : `${feedbackMsg}`}
                        </h3>
                        {feedback === "no" && (
                            <div className="flex items-center gap-3 mb-8">
                                <p className="text-xl text-gray-300">
                                    <span className="font-bold text-yellow-400 text-2xl mx-2">{currentWord.w.toUpperCase()}</span>
                                </p>
                                <button
                                    onClick={() => playWordAudio(currentWord.w)}
                                    className="text-2xl opacity-70 hover:opacity-100 active:scale-90 transition-all"
                                    aria-label="Escuchar pronunciación correcta"
                                >
                                    🔊
                                </button>
                            </div>
                        )}
                        <button onClick={nextWord} className="bg-white text-black font-bold text-xl px-12 py-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl min-h-[56px]">
                            Siguiente ➡
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function Key({ char, onClick }: { char: string, onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="aspect-[4/5] md:aspect-auto bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg lg:rounded-2xl text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white shadow-md border-b-2 border-white/5 transform active:translate-y-[2px] active:border-b-0 transition-all select-none min-h-[48px] md:min-h-[56px] lg:min-h-[64px]"
        >
            {char}
        </button>
    )
}

function GameResults({ gameState, onRestart, profile }: { gameState: GameState, onRestart: any, profile: any }) {
    const diff = DIFFICULTY[gameState.diff];
    const correct = gameState.answers.filter((a: any) => a.ok).length;
    const total = gameState.words.length;
    const accuracy = Math.round((correct / total) * 100);
    const showConfetti = accuracy >= 80;

    // Granular result messages
    let resultEmoji: string;
    let resultMessage: string;
    if (accuracy === 100) {
        resultEmoji = "🏆";
        resultMessage = "¡PERFECTO! ¡Eres una leyenda del deletreo!";
    } else if (accuracy >= 80) {
        resultEmoji = "⭐";
        resultMessage = "¡Increíble! ¡Casi perfecto!";
    } else if (accuracy >= 60) {
        resultEmoji = "💪";
        resultMessage = "¡Buen trabajo! Vas mejorando";
    } else if (accuracy >= 40) {
        resultEmoji = "🌟";
        resultMessage = "¡Buen intento! La práctica hace al maestro";
    } else {
        resultEmoji = "🎯";
        resultMessage = "¡No te rindas! Cada intento te hace mejor";
    }

    useEffect(() => {
        if (gameState.score > 0) {
            submitGameResult(gameState.score, gameState.diff, accuracy);
        }
    }, []);

    return (
        <div className="max-w-md md:max-w-2xl mx-auto p-4 text-center h-full flex flex-col justify-center relative">
            {showConfetti && <Confetti />}

            <div className="text-8xl mb-6 animate-bounce">
                {resultEmoji}
            </div>
            <h2 className="text-4xl font-bold mb-2 text-white">
                {resultMessage}
            </h2>
            <p className="text-gray-400 mb-12 text-lg">{diff.label} • <span className="text-yellow-400 font-bold">{gameState.score} Puntos</span></p>

            <div className="grid grid-cols-2 gap-4 mb-12">
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                    <div className="text-4xl font-bold text-teal-400 mb-1">{accuracy}%</div>
                    <div className="text-sm text-gray-500 uppercase tracking-widest">Precisión</div>
                </div>
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                    <div className="text-4xl font-bold text-yellow-400 mb-1">+{gameState.score}</div>
                    <div className="text-sm text-gray-500 uppercase tracking-widest">Monedas</div>
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={onRestart} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-900/20 active:scale-95 transition-transform min-h-[56px]">
                    🔄 Jugar otra vez
                </button>
                <a href="/" className="flex-1 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform min-h-[56px]">
                    🏠 Salir
                </a>
            </div>
        </div>
    )
}
