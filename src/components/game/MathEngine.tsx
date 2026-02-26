"use client";

import { useState, useEffect } from "react";
import {
    MATH_CATEGORIES, MATH_DIFFICULTY, generateMathGame, checkAnswer,
    type MathProblem, type MathDifficultyKey,
} from "@/lib/math-problems";
import { playSfx, unlockAudio } from "@/lib/audio";
import { submitMathResult } from "@/lib/actions";
import ProgressBar from "./ProgressBar";
import Confetti from "./Confetti";
import NumericKeyboard from "./NumericKeyboard";

// --- Feedback messages ---
const CORRECT_MESSAGES = [
    "¡Correcto!",
    "¡Eres un genio!",
    "¡Excelente cálculo!",
    "¡Matemático pro!",
    "¡Perfecto!",
];

const INCORRECT_MESSAGES = [
    "¡Casi! La respuesta era",
    "No te preocupes, era",
    "¡Sigue intentando! Era",
];

function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// --- Types ---
type MathGameState = {
    diff: MathDifficultyKey;
    problems: MathProblem[];
    index: number;
    answers: MathAnswer[];
    startTime: number;
    timeLeft: number | null;
    score: number;
    streak: number;
    status: "playing" | "results";
};

type MathAnswer = {
    problem: MathProblem;
    userAnswer: string;
    correct: boolean;
    points: number;
};

// --- Main Component ---
export default function MathEngine({ profile }: { profile: any }) {
    const [gameState, setGameState] = useState<MathGameState | null>(null);
    const [selectedDiff, setSelectedDiff] = useState<MathDifficultyKey | null>(null);

    const startGame = (diffKey: MathDifficultyKey) => {
        const diff = MATH_DIFFICULTY[diffKey];
        const problems = generateMathGame(diffKey);

        setGameState({
            diff: diffKey,
            problems,
            index: 0,
            answers: [],
            startTime: Date.now(),
            timeLeft: diff.timeLimit || null,
            score: 0,
            streak: 0,
            status: "playing",
        });
    };

    if (!selectedDiff) {
        return <MathSelector onSelect={(d) => { unlockAudio(); setSelectedDiff(d); startGame(d); }} />;
    }

    if (gameState?.status === "results") {
        return <MathResults gameState={gameState} onRestart={() => { setSelectedDiff(null); setGameState(null); }} profile={profile} />;
    }

    return <MathPlay gameState={gameState!} setGameState={setGameState} />;
}

// --- Selector ---
function MathSelector({ onSelect }: { onSelect: (d: MathDifficultyKey) => void }) {
    return (
        <div className="max-w-md mx-auto p-4 flex flex-col h-full justify-center">
            <h2 className="text-4xl font-bold text-center mb-4 text-white">🏆 Copa de Mates</h2>
            <p className="text-center text-gray-400 mb-12 text-sm">Prepárate para la Copa Nacional de Matemáticas</p>
            <div className="space-y-6">
                {(Object.entries(MATH_DIFFICULTY) as [MathDifficultyKey, typeof MATH_DIFFICULTY[MathDifficultyKey]][]).map(([key, d]) => (
                    <button
                        key={key}
                        onClick={() => onSelect(key)}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-6 transition-all text-left flex items-center gap-6 group active:scale-95"
                        style={{ borderColor: d.color + "40" }}
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

// --- Timer Bar ---
function TimerBar({ timeLeft, timeLimit }: { timeLeft: number; timeLimit: number }) {
    const pct = (timeLeft / timeLimit) * 100;
    const isUrgent = timeLeft <= 5;

    let barColor: string;
    if (timeLeft <= 5) barColor = "#ef4444";
    else if (timeLeft <= timeLimit * 0.4) barColor = "#eab308";
    else barColor = "#22c55e";

    return (
        <div className={`flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full ${isUrgent ? "animate-pulse" : ""}`}>
            <span className={`text-sm font-bold ${isUrgent ? "text-red-400" : "text-gray-400"}`}>
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

// --- Game Play ---
function MathPlay({ gameState, setGameState }: { gameState: MathGameState; setGameState: any }) {
    const [input, setInput] = useState("");
    const [feedback, setFeedback] = useState<"ok" | "no" | null>(null);
    const [feedbackMsg, setFeedbackMsg] = useState("");
    const [selectedOption, setSelectedOption] = useState<number | null>(null);

    const currentProblem = gameState.problems[gameState.index];
    const diff = MATH_DIFFICULTY[gameState.diff];
    const cat = MATH_CATEGORIES[currentProblem.category];

    // Reset on new problem
    useEffect(() => {
        setInput("");
        setSelectedOption(null);
    }, [gameState.index]);

    // Timer
    useEffect(() => {
        if (!diff.timeLimit || gameState.timeLeft === null) return;
        if (gameState.timeLeft <= 0) {
            submitAnswer("");
            return;
        }
        const t = setInterval(() => {
            setGameState((prev: MathGameState) => ({ ...prev, timeLeft: (prev.timeLeft || 0) - 1 }));
        }, 1000);
        return () => clearInterval(t);
    }, [gameState.timeLeft]);

    const handleKey = (key: string) => {
        if (feedback) return;
        if (key === "BACK") {
            setInput(prev => prev.slice(0, -1));
        } else if (key === "ENTER") {
            if (input.length > 0) submitAnswer();
        } else {
            // Prevent multiple dots or slashes
            if (key === "." && input.includes(".")) return;
            if (key === "/" && input.includes("/")) return;
            if (input.length < 12) {
                setInput(prev => prev + key);
            }
        }
    };

    const handleOptionSelect = (index: number) => {
        if (feedback) return;
        setSelectedOption(index);
        const userAnswer = currentProblem.options![index];
        setInput(userAnswer);

        const isCorrect = checkAnswer(currentProblem, userAnswer);
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

    const submitAnswer = (overrideInput?: string) => {
        const val = overrideInput !== undefined ? overrideInput : input;
        const isCorrect = checkAnswer(currentProblem, val);

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

    const nextProblem = () => {
        setFeedback(null);
        const val = input;
        const isCorrect = checkAnswer(currentProblem, val);

        const streakBonus = isCorrect && gameState.streak >= 2 ? 5 : 0;
        const base = isCorrect ? currentProblem.points : 0;
        const points = (base + streakBonus) * diff.multiplier;

        const newStreak = isCorrect ? gameState.streak + 1 : 0;
        const newScore = gameState.score + points;
        const newAnswer: MathAnswer = { problem: currentProblem, userAnswer: val, correct: isCorrect, points };
        const nextIndex = gameState.index + 1;

        if (nextIndex >= gameState.problems.length) {
            setGameState({ ...gameState, index: nextIndex, answers: [...gameState.answers, newAnswer], score: newScore, streak: newStreak, status: "results" });
        } else {
            setGameState({ ...gameState, index: nextIndex, answers: [...gameState.answers, newAnswer], score: newScore, streak: newStreak, timeLeft: diff.timeLimit || null });
        }
    };

    const isHard = gameState.diff === "HARD";
    const showKeyboard = currentProblem.questionType !== "multiple_choice";

    return (
        <div className="flex flex-col h-full max-w-lg md:max-w-2xl mx-auto pb-4">
            {/* Header Stats */}
            <div className="flex justify-between items-center py-4 px-2 text-sm font-bold text-gray-400 shrink-0">
                <div className="bg-white/10 px-3 py-1 rounded-full">{gameState.index + 1} / {gameState.problems.length}</div>
                {gameState.timeLeft !== null && diff.timeLimit ? (
                    <TimerBar timeLeft={gameState.timeLeft} timeLimit={diff.timeLimit} />
                ) : (
                    <div className="bg-white/10 px-3 py-1 rounded-full">∞</div>
                )}
                <div className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full">Score: {gameState.score}</div>
            </div>

            <ProgressBar current={gameState.index + 1} total={gameState.problems.length} label="Problema" />

            {/* Game Area */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-0 relative px-4">

                {/* Category Badge */}
                <div className="text-lg font-bold uppercase tracking-widest mb-6" style={{ color: cat.color }}>
                    {cat.emoji} {cat.name}
                </div>

                {/* Hint */}
                {diff.showHint && currentProblem.hint && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-2 mb-4 text-sm text-yellow-300 text-center max-w-sm">
                        💡 {currentProblem.hint}
                    </div>
                )}

                {/* Question */}
                <div className={`transition-all duration-300 transform flex flex-col items-center ${feedback === "no" ? "animate-shake" : ""}`}>
                    {currentProblem.questionType === "fill_sequence" ? (
                        <SequenceDisplay sequence={currentProblem.displayData?.sequence || []} input={input} />
                    ) : (
                        <>
                            <h3 className="text-2xl md:text-3xl font-bold text-white text-center mb-8 leading-relaxed">
                                {currentProblem.questionText}
                            </h3>

                            {currentProblem.questionType === "multiple_choice" ? (
                                <MultipleChoiceOptions
                                    options={currentProblem.options!}
                                    selected={selectedOption}
                                    correctAnswer={currentProblem.correctAnswer}
                                    showResult={feedback !== null}
                                    onSelect={handleOptionSelect}
                                />
                            ) : (
                                <InputDisplay input={input} isFraction={currentProblem.questionType === "fraction"} />
                            )}
                        </>
                    )}
                </div>

                {/* Streak indicator */}
                {gameState.streak >= 2 && !feedback && (
                    <div className="mt-4 bg-orange-500/20 text-orange-300 px-4 py-1 rounded-full text-sm font-bold">
                        🔥 Racha: {gameState.streak}
                    </div>
                )}

                {/* Feedback Overlay */}
                {feedback && (
                    <div className="absolute inset-x-0 top-0 bottom-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-3xl animate-in fade-in zoom-in duration-200">
                        <div className="text-8xl mb-4 animate-bounce filter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                            {feedback === "ok" ? "✅" : "❌"}
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-2">
                            {feedbackMsg}
                        </h3>
                        {feedback === "no" && (
                            <p className="text-xl text-gray-300 mb-8">
                                <span className="font-bold text-yellow-400 text-2xl mx-2">{currentProblem.correctAnswer}</span>
                            </p>
                        )}
                        <button onClick={nextProblem} className="bg-white text-black font-bold text-xl px-12 py-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl min-h-[56px]">
                            Siguiente ➡
                        </button>
                    </div>
                )}
            </div>

            {/* Keyboard */}
            {showKeyboard && (
                <NumericKeyboard
                    onKey={handleKey}
                    showDecimal={isHard}
                    showFraction={isHard}
                    disabled={feedback !== null}
                />
            )}
        </div>
    );
}

// --- Sub-components for question rendering ---

function InputDisplay({ input, isFraction }: { input: string; isFraction: boolean }) {
    if (isFraction && input.includes("/")) {
        const [num, den] = input.split("/");
        return (
            <div className="flex flex-col items-center gap-1">
                <div className="text-4xl font-bold text-white min-w-[60px] text-center px-4 py-1">{num || "_"}</div>
                <div className="w-20 h-1 bg-white rounded-full" />
                <div className="text-4xl font-bold text-white min-w-[60px] text-center px-4 py-1">{den || "_"}</div>
            </div>
        );
    }

    return (
        <div className="bg-white/5 border-2 border-white/20 rounded-2xl px-8 py-4 min-w-[160px] min-h-[72px] flex items-center justify-center">
            <span className="text-4xl md:text-5xl font-bold text-white tracking-wider">
                {input || <span className="text-gray-600">?</span>}
            </span>
        </div>
    );
}

function SequenceDisplay({ sequence, input }: { sequence: (number | null)[]; input: string }) {
    return (
        <div className="flex flex-col items-center mb-4">
            <h3 className="text-lg md:text-xl font-bold text-white text-center mb-6">
                Encuentra el valor faltante en la sucesión
            </h3>
            <div className="flex gap-2 md:gap-3 items-center flex-wrap justify-center">
                {sequence.map((val, i) => (
                    <div key={i} className="flex items-center gap-2 md:gap-3">
                        {val === null ? (
                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl border-2 border-yellow-400 bg-yellow-400/10 flex items-center justify-center text-xl md:text-2xl font-bold text-yellow-300 shadow-lg shadow-yellow-900/20">
                                {input || "?"}
                            </div>
                        ) : (
                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl border-2 border-white/10 bg-white/5 flex items-center justify-center text-xl md:text-2xl font-bold text-white">
                                {val}
                            </div>
                        )}
                        {i < sequence.length - 1 && (
                            <span className="text-gray-500 text-lg font-bold">→</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function MultipleChoiceOptions({
    options, selected, correctAnswer, showResult, onSelect,
}: {
    options: string[];
    selected: number | null;
    correctAnswer: string;
    showResult: boolean;
    onSelect: (i: number) => void;
}) {
    const labels = ["A", "B", "C", "D"];

    return (
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {options.map((opt, i) => {
                let extraClass = "bg-white/5 border-white/10 hover:bg-white/10";
                if (showResult && selected === i) {
                    extraClass = opt === correctAnswer
                        ? "bg-green-500/20 border-green-400"
                        : "bg-red-500/20 border-red-400";
                } else if (showResult && opt === correctAnswer) {
                    extraClass = "bg-green-500/20 border-green-400";
                }

                return (
                    <button
                        key={i}
                        onClick={() => onSelect(i)}
                        disabled={showResult}
                        className={`border-2 rounded-2xl p-4 text-center transition-all active:scale-95 ${extraClass}`}
                    >
                        <div className="text-xs font-bold text-gray-500 mb-1">{labels[i]}</div>
                        <div className="text-2xl font-bold text-white">{opt}</div>
                    </button>
                );
            })}
        </div>
    );
}

// --- Results ---
function MathResults({ gameState, onRestart, profile }: { gameState: MathGameState; onRestart: () => void; profile: any }) {
    const diff = MATH_DIFFICULTY[gameState.diff];
    const correct = gameState.answers.filter(a => a.correct).length;
    const total = gameState.problems.length;
    const accuracy = Math.round((correct / total) * 100);
    const showConfetti = accuracy >= 80;

    let resultEmoji: string;
    let resultMessage: string;
    if (accuracy === 100) {
        resultEmoji = "🏆";
        resultMessage = "¡PERFECTO! ¡Eres una leyenda del cálculo!";
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

    // Category breakdown
    const byCategory: Record<string, { correct: number; total: number }> = {};
    for (const a of gameState.answers) {
        const cat = a.problem.category;
        if (!byCategory[cat]) byCategory[cat] = { correct: 0, total: 0 };
        byCategory[cat].total++;
        if (a.correct) byCategory[cat].correct++;
    }

    useEffect(() => {
        if (gameState.score > 0) {
            const timeSeconds = Math.round((Date.now() - gameState.startTime) / 1000);
            submitMathResult(gameState.score, gameState.diff, accuracy, {
                problemsCorrect: correct,
                problemsTotal: total,
                timeSeconds,
                categoryBreakdown: byCategory,
            });
        }
    }, []);

    return (
        <div className="max-w-md mx-auto p-4 text-center h-full flex flex-col justify-center relative overflow-y-auto">
            {showConfetti && <Confetti />}

            <div className="text-8xl mb-6 animate-bounce">{resultEmoji}</div>
            <h2 className="text-3xl font-bold mb-2 text-white">{resultMessage}</h2>
            <p className="text-gray-400 mb-8 text-lg">{diff.label} • <span className="text-yellow-400 font-bold">{gameState.score} Puntos</span></p>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                    <div className="text-4xl font-bold text-teal-400 mb-1">{accuracy}%</div>
                    <div className="text-sm text-gray-500 uppercase tracking-widest">Precisión</div>
                </div>
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                    <div className="text-4xl font-bold text-yellow-400 mb-1">+{gameState.score}</div>
                    <div className="text-sm text-gray-500 uppercase tracking-widest">Monedas</div>
                </div>
            </div>

            {/* Category Breakdown */}
            <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Desglose por tema</h3>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(byCategory).map(([catId, stats]) => {
                        const cat = MATH_CATEGORIES[catId];
                        if (!cat) return null;
                        const pct = Math.round((stats.correct / stats.total) * 100);
                        return (
                            <div key={catId} className="bg-white/5 border border-white/5 rounded-xl p-3 text-left">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-lg">{cat.emoji}</span>
                                    <span className="text-xs font-bold text-gray-300 truncate">{cat.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{
                                                width: `${pct}%`,
                                                backgroundColor: pct === 100 ? "#2dd4bf" : pct >= 50 ? "#eab308" : "#ef4444",
                                            }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-gray-400">{stats.correct}/{stats.total}</span>
                                </div>
                            </div>
                        );
                    })}
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
    );
}
