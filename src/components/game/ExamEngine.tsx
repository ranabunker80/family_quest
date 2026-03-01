"use client";

import { useState, useEffect, useRef } from "react";
import type { SubjectWorld, ExamLevel, ExamQuestion, ExamAnswer, ExamGameState } from "@/lib/exam-data/types";
import { playSfx, unlockAudio } from "@/lib/audio";
import { submitExamResult } from "@/lib/exam-actions";
import ProgressTracker from "./ProgressTracker";
import Confetti from "./Confetti";
import NumericKeyboard from "./NumericKeyboard";

// --- Feedback messages ---
const CORRECT_MESSAGES = [
    "¡Correcto!",
    "¡Excelente!",
    "¡Muy bien!",
    "¡Eres un crack!",
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

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// --- Main Component ---
export default function ExamEngine({ profile, subject, previewMode = false }: { profile: any; subject: SubjectWorld; previewMode?: boolean }) {
    const [gameState, setGameState] = useState<ExamGameState | null>(null);
    const [selectedLevel, setSelectedLevel] = useState<ExamLevel | null>(null);

    const startGame = (level: ExamLevel) => {
        setGameState({
            subject: subject.id,
            level,
            questions: [...level.questions],
            index: 0,
            answers: [],
            startTime: Date.now(),
            timeLeft: null,
            score: 0,
            streak: 0,
            status: "playing",
        });
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

    if (!selectedLevel) {
        return (
            <>
                {previewBanner}
                <LevelSelector subject={subject} onSelect={(l) => { unlockAudio(); setSelectedLevel(l); startGame(l); }} />
            </>
        );
    }

    if (gameState?.status === "results") {
        return <ExamResults gameState={gameState} subject={subject} onRestart={() => { setSelectedLevel(null); setGameState(null); }} profile={profile} previewMode={previewMode} />;
    }

    return <ExamPlay gameState={gameState!} setGameState={setGameState} subject={subject} />;
}

// --- Level Selector ---
function LevelSelector({ subject, onSelect }: { subject: SubjectWorld; onSelect: (l: ExamLevel) => void }) {
    return (
        <div className="max-w-md mx-auto p-4 flex flex-col h-full justify-center">
            <h2 className="text-4xl font-bold text-center mb-2 text-white">{subject.emoji} {subject.title}</h2>
            <p className="text-center text-gray-400 mb-10 text-sm">{subject.description}</p>
            <div className="space-y-4">
                {subject.levels.map((level) => (
                    <button
                        key={level.id}
                        onClick={() => onSelect(level)}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-5 transition-all text-left flex items-center gap-5 group active:scale-95"
                        style={{ borderColor: level.color + "40" }}
                    >
                        <div className="text-4xl min-w-[50px] text-center group-hover:scale-110 transition-transform">{level.emoji}</div>
                        <div className="flex-1">
                            <div className="text-xl font-bold mb-1" style={{ color: level.color }}>{level.title}</div>
                            <div className="text-sm text-gray-400">{level.description}</div>
                            <div className="text-xs text-gray-500 mt-1">{level.questions.length} preguntas</div>
                        </div>
                        <div className="text-2xl font-bold opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: level.color }}>▶</div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// --- Game Play ---
function ExamPlay({ gameState, setGameState, subject }: { gameState: ExamGameState; setGameState: (s: ExamGameState) => void; subject: SubjectWorld }) {
    const [feedback, setFeedback] = useState<"ok" | "no" | null>(null);
    const [feedbackMsg, setFeedbackMsg] = useState("");
    const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
    const pendingCorrectRef = useRef<boolean>(false);
    const pendingCorrectAnswerRef = useRef<string>("");

    const currentQ = gameState.questions[gameState.index];

    const handleAnswer = (isCorrect: boolean, correctAnswerDisplay?: string) => {
        pendingCorrectRef.current = isCorrect;
        pendingCorrectAnswerRef.current = correctAnswerDisplay || "";

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

    const nextQuestion = () => {
        const isCorrect = pendingCorrectRef.current;
        setFeedback(null);
        setLastCorrect(isCorrect);

        const streakBonus = isCorrect && gameState.streak >= 2 ? 5 : 0;
        const base = isCorrect ? currentQ.points : 0;
        const points = base + streakBonus;

        const newStreak = isCorrect ? gameState.streak + 1 : 0;
        const newScore = gameState.score + points;
        const newAnswer: ExamAnswer = { questionId: currentQ.id, questionType: currentQ.questionType, correct: isCorrect, points };
        const nextIndex = gameState.index + 1;

        if (nextIndex >= gameState.questions.length) {
            setGameState({ ...gameState, index: nextIndex, answers: [...gameState.answers, newAnswer], score: newScore, streak: newStreak, status: "results" });
        } else {
            setGameState({ ...gameState, index: nextIndex, answers: [...gameState.answers, newAnswer], score: newScore, streak: newStreak });
        }
    };

    return (
        <div className="flex flex-col h-full max-w-lg md:max-w-2xl mx-auto pb-4">
            {/* Header Stats */}
            <div className="flex justify-between items-center py-3 px-2 text-sm font-bold text-gray-400 shrink-0">
                <div className="bg-white/10 px-3 py-1 rounded-full">{gameState.index + 1} / {gameState.questions.length}</div>
                <div className="bg-white/10 px-3 py-1 rounded-full text-xs" style={{ color: gameState.level.color }}>{gameState.level.emoji} {gameState.level.title}</div>
                <div className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full">Score: {gameState.score}</div>
            </div>

            <ProgressTracker
                current={gameState.index + 1}
                total={gameState.questions.length}
                streak={gameState.streak}
                lastAnswerCorrect={lastCorrect}
                label="Pregunta"
            />

            {/* Game Area */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-0 relative px-4 overflow-y-auto">
                {/* Question text */}
                <h3 className="text-xl md:text-2xl font-bold text-white text-center mb-6 leading-relaxed">
                    {currentQ.questionText}
                </h3>

                {/* Hint */}
                {currentQ.hint && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-2 mb-4 text-sm text-yellow-300 text-center max-w-sm">
                        💡 {currentQ.hint}
                    </div>
                )}

                {/* Question Type Renderer */}
                <QuestionRenderer question={currentQ} onAnswer={handleAnswer} disabled={feedback !== null} />

                {/* Streak indicator */}
                {gameState.streak >= 2 && !feedback && (
                    <div className="mt-4 bg-orange-500/20 text-orange-300 px-4 py-1 rounded-full text-sm font-bold">
                        🔥 Racha: {gameState.streak}
                    </div>
                )}

                {/* Feedback Overlay */}
                {feedback && (
                    <div className="absolute inset-x-0 top-0 bottom-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-3xl">
                        <div className="text-8xl mb-4 animate-bounce filter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                            {feedback === "ok" ? "✅" : "❌"}
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-2">{feedbackMsg}</h3>
                        {feedback === "no" && pendingCorrectAnswerRef.current && (
                            <p className="text-xl text-gray-300 mb-6">
                                <span className="font-bold text-yellow-400 text-2xl mx-2">{pendingCorrectAnswerRef.current}</span>
                            </p>
                        )}
                        <button onClick={nextQuestion} className="bg-white text-black font-bold text-xl px-12 py-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl min-h-[56px]">
                            Siguiente ➡
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Question Type Dispatcher ---
function QuestionRenderer({ question, onAnswer, disabled }: { question: ExamQuestion; onAnswer: (correct: boolean, display?: string) => void; disabled: boolean }) {
    switch (question.questionType) {
        case "multiple_choice":
            return <MultipleChoiceQ question={question} onAnswer={onAnswer} disabled={disabled} />;
        case "true_false":
            return <TrueFalseQ question={question} onAnswer={onAnswer} disabled={disabled} />;
        case "classify":
            return <ClassifyQ question={question} onAnswer={onAnswer} disabled={disabled} />;
        case "order_steps":
            return <OrderStepsQ question={question} onAnswer={onAnswer} disabled={disabled} />;
        case "match":
            return <MatchQ question={question} onAnswer={onAnswer} disabled={disabled} />;
        case "numeric_input":
            return <NumericInputQ question={question} onAnswer={onAnswer} disabled={disabled} />;
        case "compare":
            return <CompareQ question={question} onAnswer={onAnswer} disabled={disabled} />;
        case "word_problem":
            return <WordProblemQ question={question} onAnswer={onAnswer} disabled={disabled} />;
        default:
            return null;
    }
}

// --- Multiple Choice ---
function MultipleChoiceQ({ question, onAnswer, disabled }: { question: ExamQuestion; onAnswer: (c: boolean, d?: string) => void; disabled: boolean }) {
    const [selected, setSelected] = useState<number | null>(null);
    const labels = ["A", "B", "C", "D"];

    useEffect(() => { setSelected(null); }, [question.id]);

    const handleSelect = (i: number) => {
        if (disabled || selected !== null) return;
        setSelected(i);
        const opt = question.options![i];
        const isCorrect = opt === question.correctAnswer;
        onAnswer(isCorrect, question.correctAnswer);
    };

    return (
        <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
            {question.options!.map((opt, i) => {
                let extraClass = "bg-white/5 border-white/10 hover:bg-white/10";
                if (selected === i) {
                    extraClass = opt === question.correctAnswer
                        ? "bg-green-500/20 border-green-400"
                        : "bg-red-500/20 border-red-400";
                } else if (selected !== null && opt === question.correctAnswer) {
                    extraClass = "bg-green-500/20 border-green-400";
                }
                return (
                    <button key={i} onClick={() => handleSelect(i)} disabled={disabled}
                        className={`border-2 rounded-2xl p-4 text-left transition-all active:scale-95 flex items-center gap-3 min-h-[56px] ${extraClass}`}>
                        <div className="text-xs font-bold text-gray-500 bg-white/10 w-8 h-8 rounded-full flex items-center justify-center shrink-0">{labels[i]}</div>
                        <div className="text-lg font-medium text-white">{opt}</div>
                    </button>
                );
            })}
        </div>
    );
}

// --- True/False ---
function TrueFalseQ({ question, onAnswer, disabled }: { question: ExamQuestion; onAnswer: (c: boolean, d?: string) => void; disabled: boolean }) {
    const [answered, setAnswered] = useState(false);
    useEffect(() => { setAnswered(false); }, [question.id]);

    const handle = (choice: string) => {
        if (disabled || answered) return;
        setAnswered(true);
        onAnswer(choice === question.correctAnswer, question.correctAnswer);
    };

    return (
        <div className="flex gap-4 w-full max-w-sm">
            <button onClick={() => handle("Verdadero")} disabled={disabled}
                className="flex-1 bg-green-500/10 border-2 border-green-500/30 rounded-2xl p-6 text-center active:scale-95 min-h-[80px] transition-all hover:bg-green-500/20">
                <div className="text-3xl mb-2">✅</div>
                <div className="text-xl font-bold text-white">Verdadero</div>
            </button>
            <button onClick={() => handle("Falso")} disabled={disabled}
                className="flex-1 bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-6 text-center active:scale-95 min-h-[80px] transition-all hover:bg-red-500/20">
                <div className="text-3xl mb-2">❌</div>
                <div className="text-xl font-bold text-white">Falso</div>
            </button>
        </div>
    );
}

// --- Classify ---
function ClassifyQ({ question, onAnswer, disabled }: { question: ExamQuestion; onAnswer: (c: boolean, d?: string) => void; disabled: boolean }) {
    const [itemIndex, setItemIndex] = useState(0);
    const [results, setResults] = useState<boolean[]>([]);
    const [itemFeedback, setItemFeedback] = useState<"ok" | "no" | null>(null);
    const items = question.classifyItems!;
    const categories = question.categories!;

    useEffect(() => { setItemIndex(0); setResults([]); setItemFeedback(null); }, [question.id]);

    const currentItem = items[itemIndex];
    if (!currentItem) return null;

    const handleClassify = (categoryId: string) => {
        if (disabled || itemFeedback) return;
        const isCorrect = categoryId === currentItem.correctCategoryId;

        if (isCorrect) {
            playSfx("success");
            setItemFeedback("ok");
        } else {
            playSfx("error");
            setItemFeedback("no");
        }

        const newResults = [...results, isCorrect];

        setTimeout(() => {
            setItemFeedback(null);
            if (itemIndex + 1 >= items.length) {
                const allCorrect = newResults.every(Boolean);
                const correctCount = newResults.filter(Boolean).length;
                onAnswer(allCorrect, `${correctCount}/${newResults.length} correctas`);
            } else {
                setResults(newResults);
                setItemIndex(prev => prev + 1);
            }
        }, 600);
    };

    return (
        <div className="w-full max-w-sm">
            {/* Item to classify */}
            <div className={`border-2 rounded-2xl p-5 text-center mb-5 transition-all ${
                itemFeedback === "ok" ? "bg-green-500/20 border-green-400" :
                itemFeedback === "no" ? "bg-red-500/20 border-red-400" :
                "bg-white/10 border-white/20"
            }`}>
                {currentItem.emoji && <div className="text-4xl mb-2">{currentItem.emoji}</div>}
                <div className="text-xl font-bold text-white">{currentItem.text}</div>
                <div className="text-xs text-gray-400 mt-2">{itemIndex + 1} de {items.length}</div>
            </div>
            {/* Category buckets */}
            <div className={`grid gap-3 ${categories.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {categories.map(cat => (
                    <button key={cat.id} onClick={() => handleClassify(cat.id)} disabled={disabled || itemFeedback !== null}
                        className="border-2 rounded-2xl p-4 text-center active:scale-95 min-h-[72px] transition-all"
                        style={{ borderColor: cat.color + "60", backgroundColor: cat.color + "10" }}>
                        {cat.emoji && <div className="text-2xl mb-1">{cat.emoji}</div>}
                        <div className="text-sm font-bold text-white">{cat.label}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// --- Order Steps ---
function OrderStepsQ({ question, onAnswer, disabled }: { question: ExamQuestion; onAnswer: (c: boolean, d?: string) => void; disabled: boolean }) {
    const [shuffled] = useState(() => shuffle(question.steps!.map((text, correctIdx) => ({ text, correctIdx }))));
    const [selectedOrder, setSelectedOrder] = useState<number[]>([]);

    useEffect(() => { setSelectedOrder([]); }, [question.id]);

    const handleTap = (shuffledIdx: number) => {
        if (disabled) return;
        const existing = selectedOrder.indexOf(shuffledIdx);
        if (existing !== -1) {
            // Deselect this and all after
            setSelectedOrder(prev => prev.slice(0, existing));
            return;
        }
        const newOrder = [...selectedOrder, shuffledIdx];
        setSelectedOrder(newOrder);

        if (newOrder.length === shuffled.length) {
            const isCorrect = newOrder.every((si, i) => shuffled[si].correctIdx === i);
            onAnswer(isCorrect, "Orden: " + question.steps!.map((_, i) => i + 1).join(", "));
        }
    };

    return (
        <div className="w-full max-w-sm space-y-3">
            {shuffled.map((step, si) => {
                const orderNum = selectedOrder.indexOf(si);
                const isSelected = orderNum !== -1;
                return (
                    <button key={si} onClick={() => handleTap(si)} disabled={disabled}
                        className={`w-full text-left p-4 rounded-2xl border-2 active:scale-95 min-h-[56px] transition-all ${
                            isSelected ? "bg-teal-500/20 border-teal-400" : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${
                                isSelected ? "bg-teal-500 text-white" : "bg-white/10 text-gray-500"
                            }`}>
                                {isSelected ? orderNum + 1 : "?"}
                            </div>
                            <div className="text-white font-medium text-sm leading-tight">{step.text}</div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

// --- Match ---
function MatchQ({ question, onAnswer, disabled }: { question: ExamQuestion; onAnswer: (c: boolean, d?: string) => void; disabled: boolean }) {
    const pairs = question.matchPairs!;
    const [shuffledRight] = useState(() => shuffle(pairs.map(p => p.right)));
    const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
    const [matches, setMatches] = useState<Map<number, number>>(new Map());
    const [wrongFlash, setWrongFlash] = useState(false);

    useEffect(() => { setSelectedLeft(null); setMatches(new Map()); setWrongFlash(false); }, [question.id]);

    const handleLeftTap = (i: number) => {
        if (disabled || matches.has(i)) return;
        setSelectedLeft(i);
        setWrongFlash(false);
    };

    const handleRightTap = (ri: number) => {
        if (disabled || selectedLeft === null) return;
        if ([...matches.values()].includes(ri)) return;

        const correctRight = pairs[selectedLeft].right;
        const tappedRight = shuffledRight[ri];

        if (correctRight === tappedRight) {
            playSfx("success");
            const newMatches = new Map(matches);
            newMatches.set(selectedLeft, ri);
            setMatches(newMatches);
            setSelectedLeft(null);

            if (newMatches.size === pairs.length) {
                onAnswer(true);
            }
        } else {
            playSfx("error");
            setWrongFlash(true);
            setTimeout(() => { setSelectedLeft(null); setWrongFlash(false); }, 600);
        }
    };

    return (
        <div className="w-full max-w-md">
            <p className="text-sm text-gray-400 text-center mb-4">Toca un elemento de la izquierda y luego su pareja de la derecha</p>
            <div className="grid grid-cols-2 gap-3">
                {/* Left column */}
                <div className="space-y-2">
                    {pairs.map((p, i) => {
                        const isMatched = matches.has(i);
                        const isSelected = selectedLeft === i;
                        return (
                            <button key={`l-${i}`} onClick={() => handleLeftTap(i)} disabled={disabled || isMatched}
                                className={`w-full p-3 rounded-xl border-2 text-left text-sm font-medium min-h-[48px] transition-all ${
                                    isMatched ? "bg-teal-500/20 border-teal-400 text-teal-300" :
                                    isSelected ? (wrongFlash ? "bg-red-500/20 border-red-400" : "bg-blue-500/20 border-blue-400") :
                                    "bg-white/5 border-white/10 text-white hover:bg-white/10"
                                }`}>
                                {p.left}
                            </button>
                        );
                    })}
                </div>
                {/* Right column */}
                <div className="space-y-2">
                    {shuffledRight.map((right, ri) => {
                        const isMatched = [...matches.values()].includes(ri);
                        return (
                            <button key={`r-${ri}`} onClick={() => handleRightTap(ri)} disabled={disabled || isMatched}
                                className={`w-full p-3 rounded-xl border-2 text-left text-sm min-h-[48px] transition-all ${
                                    isMatched ? "bg-teal-500/20 border-teal-400 text-teal-300" :
                                    "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                                }`}>
                                {right}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// --- Numeric Input ---
function NumericInputQ({ question, onAnswer, disabled }: { question: ExamQuestion; onAnswer: (c: boolean, d?: string) => void; disabled: boolean }) {
    const [input, setInput] = useState("");

    useEffect(() => { setInput(""); }, [question.id]);

    const handleKey = (key: string) => {
        if (disabled) return;
        if (key === "BACK") {
            setInput(prev => prev.slice(0, -1));
        } else if (key === "ENTER") {
            if (input.length > 0) {
                const isCorrect = input.trim() === String(question.correctAnswer).trim();
                onAnswer(isCorrect, question.correctAnswer);
            }
        } else {
            if (key === "." && input.includes(".")) return;
            if (input.length < 10) {
                setInput(prev => prev + key);
            }
        }
    };

    return (
        <div className="w-full max-w-sm flex flex-col items-center">
            <div className="bg-white/5 border-2 border-white/20 rounded-2xl px-8 py-4 min-w-[160px] min-h-[72px] flex items-center justify-center mb-4">
                <span className="text-4xl md:text-5xl font-bold text-white tracking-wider">
                    {input || <span className="text-gray-600">?</span>}
                </span>
            </div>
            <NumericKeyboard onKey={handleKey} disabled={disabled} />
        </div>
    );
}

// --- Compare ---
function CompareQ({ question, onAnswer, disabled }: { question: ExamQuestion; onAnswer: (c: boolean, d?: string) => void; disabled: boolean }) {
    const [answered, setAnswered] = useState(false);
    const [a, b] = question.comparePair!;

    useEffect(() => { setAnswered(false); }, [question.id]);

    const handleCompare = (op: string) => {
        if (disabled || answered) return;
        setAnswered(true);
        const isCorrect = op === question.correctAnswer;
        const signNames: Record<string, string> = { "<": "menor que", ">": "mayor que", "=": "igual que" };
        onAnswer(isCorrect, `${a} ${question.correctAnswer} ${b} (${signNames[question.correctAnswer!] || ""})`);
    };

    return (
        <div className="w-full max-w-sm">
            <div className="flex items-center justify-center gap-4 mb-8">
                <div className="bg-white/10 border-2 border-white/20 rounded-2xl p-6 min-w-[100px] text-center">
                    <div className="text-3xl font-bold text-white">{Number(a).toLocaleString()}</div>
                </div>
                <div className="text-4xl text-gray-500 font-bold">?</div>
                <div className="bg-white/10 border-2 border-white/20 rounded-2xl p-6 min-w-[100px] text-center">
                    <div className="text-3xl font-bold text-white">{Number(b).toLocaleString()}</div>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {["<", "=", ">"].map(op => (
                    <button key={op} onClick={() => handleCompare(op)} disabled={disabled}
                        className="bg-white/5 border-2 border-white/10 rounded-2xl p-4 text-center active:scale-95 min-h-[64px] hover:bg-white/10 transition-all">
                        <div className="text-4xl font-bold text-white">{op}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// --- Word Problem ---
function WordProblemQ({ question, onAnswer, disabled }: { question: ExamQuestion; onAnswer: (c: boolean, d?: string) => void; disabled: boolean }) {
    const [step, setStep] = useState<"operation" | "solve">("operation");
    const [input, setInput] = useState("");
    const wpData = question.wordProblemData!;

    useEffect(() => { setStep("operation"); setInput(""); }, [question.id]);

    const handleOperation = (op: string) => {
        if (disabled) return;
        if (op !== wpData.correctOperation) {
            onAnswer(false, `Operación: ${wpData.correctOperation}, Resultado: ${wpData.correctAnswer}`);
            return;
        }
        playSfx("success");
        setStep("solve");
    };

    const handleKey = (key: string) => {
        if (disabled) return;
        if (key === "BACK") {
            setInput(prev => prev.slice(0, -1));
        } else if (key === "ENTER") {
            if (input.length > 0) {
                const isCorrect = input.trim() === wpData.correctAnswer;
                onAnswer(isCorrect, wpData.correctAnswer);
            }
        } else {
            if (key === "." || key === "/") return;
            if (input.length < 10) {
                setInput(prev => prev + key);
            }
        }
    };

    if (step === "operation") {
        return (
            <div className="w-full max-w-sm">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 text-center">
                    <p className="text-lg text-white leading-relaxed">{wpData.problemText}</p>
                </div>
                <p className="text-gray-400 mb-4 font-bold text-center text-sm">¿Qué operación necesitas?</p>
                <div className="grid grid-cols-2 gap-3">
                    {wpData.operationOptions.map(op => (
                        <button key={op} onClick={() => handleOperation(op)} disabled={disabled}
                            className="bg-white/5 border-2 border-white/10 rounded-2xl p-4 text-center text-xl font-bold text-white active:scale-95 min-h-[56px] hover:bg-white/10 transition-all">
                            {op === "Suma" ? "➕" : "➖"} {op}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm flex flex-col items-center">
            <div className="text-center mb-4">
                <span className="inline-block bg-teal-500/20 text-teal-300 text-xs font-bold px-3 py-1 rounded-full mb-3">
                    {wpData.correctOperation === "Suma" ? "➕" : "➖"} {wpData.correctOperation}
                </span>
                <p className="text-sm text-gray-300 leading-relaxed">{wpData.problemText}</p>
            </div>
            <div className="bg-white/5 border-2 border-white/20 rounded-2xl px-8 py-4 min-w-[160px] min-h-[72px] flex items-center justify-center mb-4">
                <span className="text-4xl md:text-5xl font-bold text-white tracking-wider">
                    {input || <span className="text-gray-600">?</span>}
                </span>
            </div>
            <NumericKeyboard onKey={handleKey} disabled={disabled} />
        </div>
    );
}

// --- Results ---
function ExamResults({ gameState, subject, onRestart, profile, previewMode = false }: { gameState: ExamGameState; subject: SubjectWorld; onRestart: () => void; profile: any; previewMode?: boolean }) {
    const correct = gameState.answers.filter(a => a.correct).length;
    const total = gameState.questions.length;
    const accuracy = Math.round((correct / total) * 100);
    const showConfetti = accuracy >= 80;

    let resultEmoji: string;
    let resultMessage: string;
    if (accuracy === 100) {
        resultEmoji = "🏆";
        resultMessage = "¡PERFECTO! ¡Eres un experto!";
    } else if (accuracy >= 80) {
        resultEmoji = "⭐";
        resultMessage = "¡Increíble! ¡Casi perfecto!";
    } else if (accuracy >= 60) {
        resultEmoji = "💪";
        resultMessage = "¡Buen trabajo! Vas mejorando";
    } else if (accuracy >= 40) {
        resultEmoji = "🌟";
        resultMessage = "¡Buen intento! Repasa un poco más";
    } else {
        resultEmoji = "🎯";
        resultMessage = "¡No te rindas! Inténtalo otra vez";
    }

    useEffect(() => {
        if (!previewMode && gameState.score > 0) {
            const timeSeconds = Math.round((Date.now() - gameState.startTime) / 1000);
            submitExamResult(gameState.score, gameState.subject, gameState.level.id, accuracy, {
                questionsCorrect: correct,
                questionsTotal: total,
                timeSeconds,
            });
        }
    }, []);

    return (
        <div className="max-w-md mx-auto p-4 text-center h-full flex flex-col justify-center relative overflow-y-auto">
            {showConfetti && <Confetti />}

            <div className="text-8xl mb-6 animate-bounce">{resultEmoji}</div>
            <h2 className="text-3xl font-bold mb-2 text-white">{resultMessage}</h2>
            <p className="text-gray-400 mb-2 text-lg">
                {gameState.level.emoji} {gameState.level.title}
            </p>
            <p className="text-gray-500 mb-8 text-sm">
                <span className="text-yellow-400 font-bold">{gameState.score} Puntos</span>
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                    <div className="text-4xl font-bold text-teal-400 mb-1">{accuracy}%</div>
                    <div className="text-sm text-gray-500 uppercase tracking-widest">Precisión</div>
                </div>
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                    <div className="text-4xl font-bold text-yellow-400 mb-1">{correct}/{total}</div>
                    <div className="text-sm text-gray-500 uppercase tracking-widest">Correctas</div>
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={onRestart} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-900/20 active:scale-95 transition-transform min-h-[56px]">
                    🔄 Jugar otra vez
                </button>
                <a href="/exam-prep" className="flex-1 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform min-h-[56px]">
                    📚 Mundos
                </a>
            </div>
        </div>
    );
}
