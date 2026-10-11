"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    type DictationWord,
    DICTATION_LIST_ID,
    DICTATION_TITLE,
    DICTATION_WORDS,
    dictationAudioPath,
    dictationImagePath,
} from "@/lib/dictation-data";
import { shuffleArray } from "@/lib/phrase-data";
import { unlockAudio, playCustomAudio } from "@/lib/audio";
import { submitDictationResult } from "@/lib/dictation-actions";
import Confetti from "./Confetti";

// --- Types ---

export type DictationKid = "isaac" | "elias";

// Etapas: 1 conocer · 2 completar viendo · 3 completar escuchando · 4 dictado
type Stage = 1 | 2 | 3 | 4;
type Screen =
    | { name: "intro" | "learn" | "fill" | "listen" | "final" | "prize" }
    | { name: "stage-intro"; stage: Stage }
    | { name: "review"; missed: Missed[] };

type Missed = { word: DictationWord; typed: string };

const KID_NAMES: Record<DictationKid, string> = { isaac: "Isaac", elias: "Elías" };
const TOTAL = DICTATION_WORDS.length;
const MAX_FREE_INPUT = 16;

const STAGE_INFO: Record<Stage, { emoji: string; title: string; text: string }> = {
    1: { emoji: "👀", title: "Conoce las palabras", text: "Mira el dibujo, lee qué significa y toca la palabra para escucharla." },
    2: { emoji: "🧩", title: "Completa la palabra", text: "Primero toca la bocina para escuchar la palabra. Después escribe las letras que faltan." },
    3: { emoji: "👂", title: "Escucha y completa", text: "La palabra suena sola. Solo te doy la primera letra: tú escribes las demás." },
    4: { emoji: "🏆", title: "Dictado final", text: `Te dicto las ${TOTAL} palabras y tú escribes todas las letras. Si te equivocas puedes corregir la palabra una sola vez. Para ganar tu mitad de la tarjeta necesitas las ${TOTAL} bien.` },
};

const CORRECT_MSGS = ["¡Correcto!", "¡Genial!", "¡Increíble!", "¡Eres un crack!", "¡Excelente!"];
function randomMsg(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)]; }

function playWord(word: DictationWord) {
    playCustomAudio(dictationAudioPath(word.w), word.w);
}

// ============================================================
// MAIN ENGINE
// ============================================================

export default function DictationEngine({
    profile,
    previewMode = false,
    kid,
    wonAt,
}: {
    profile: any;
    previewMode?: boolean;
    kid: DictationKid;
    wonAt: string | null;
}) {
    const [screen, setScreen] = useState<Screen>({ name: "intro" });
    const [savedStage, setSavedStage] = useState<Stage>(1);
    const [winDate, setWinDate] = useState<string | null>(wonAt);
    const [missedWords, setMissedWords] = useState<string[]>([]);
    const startTime = useRef(0);
    const finalAttempts = useRef(0);

    const storageKey = `dictation:${DICTATION_LIST_ID}:${profile?.id ?? "anon"}`;
    const missedKey = `${storageKey}:missed`;

    // Retomar la etapa donde se quedó (solo en este dispositivo)
    useEffect(() => {
        try {
            const saved = Number(localStorage.getItem(storageKey));
            // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
            if (saved >= 2 && saved <= 4) setSavedStage(saved as Stage);
            const missed = JSON.parse(localStorage.getItem(missedKey) || "[]");
            // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
            if (Array.isArray(missed)) setMissedWords(missed.filter((w) => typeof w === "string"));
        } catch { /* sin almacenamiento: empieza en la etapa 1 */ }
    }, [storageKey, missedKey]);

    const rememberMissed = (words: string[]) => {
        setMissedWords(words);
        try { localStorage.setItem(missedKey, JSON.stringify(words)); } catch { /* no crítico */ }
    };

    const goToStage = useCallback((stage: Stage) => {
        try { localStorage.setItem(storageKey, String(stage)); } catch { /* no crítico */ }
        setSavedStage(stage);
        setScreen({ name: "stage-intro", stage });
    }, [storageKey]);

    const start = (stage: Stage) => {
        unlockAudio();
        if (!startTime.current) startTime.current = Date.now();
        goToStage(stage);
    };

    const handleWin = () => {
        const now = new Date().toISOString();
        if (!winDate) setWinDate(now);
        if (!previewMode && !winDate) {
            submitDictationResult({
                timeSeconds: Math.round((Date.now() - startTime.current) / 1000),
                finalAttempts: finalAttempts.current,
            });
        }
        try { localStorage.removeItem(storageKey); } catch { /* no crítico */ }
        rememberMissed([]);
        setSavedStage(1);
        setScreen({ name: "prize" });
    };

    const stageOf = (s: Screen): Stage | null => {
        switch (s.name) {
            case "stage-intro": return s.stage;
            case "learn": return 1;
            case "fill": return 2;
            case "listen": return 3;
            case "final": case "review": return 4;
            default: return null;
        }
    };
    const currentStage = stageOf(screen);

    return (
        <div className="h-full flex flex-col">
            <style>{`
                @keyframes dictation-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-8px); } 40%,80% { transform: translateX(8px); } }
                .dictation-shake { animation: dictation-shake 0.4s ease-in-out; }
                @keyframes dictation-pop { 0% { transform: scale(0.6) rotate(-6deg); opacity: 0; } 70% { transform: scale(1.06) rotate(1deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
                .dictation-pop { animation: dictation-pop 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
            `}</style>

            {currentStage && <StageSteps stage={currentStage} />}

            <div className="flex-1 min-h-0">
                {screen.name === "intro" && (
                    <Intro
                        kid={kid}
                        savedStage={savedStage}
                        winDate={winDate}
                        onStart={start}
                        onShowPrize={() => setScreen({ name: "prize" })}
                    />
                )}

                {screen.name === "stage-intro" && (
                    <StageIntro
                        stage={screen.stage}
                        onGo={() => {
                            unlockAudio();
                            const next = ({ 1: "learn", 2: "fill", 3: "listen", 4: "final" } as const)[screen.stage];
                            if (next === "final") finalAttempts.current += 1;
                            setScreen({ name: next });
                        }}
                    />
                )}

                {screen.name === "learn" && <LearnStage onDone={() => goToStage(2)} />}

                {screen.name === "fill" && (
                    <SpellStage key="fill" mode="fill" words={DICTATION_WORDS} onDone={() => goToStage(3)} />
                )}

                {screen.name === "listen" && (
                    <SpellStage key="listen" mode="listen" words={DICTATION_WORDS} onDone={() => goToStage(4)} />
                )}

                {screen.name === "final" && (
                    <FinalStage
                        first={missedWords}
                        onDone={(missed) => {
                            if (missed.length === 0) return handleWin();
                            rememberMissed(missed.map((m) => m.word.w));
                            setScreen({ name: "review", missed });
                        }}
                    />
                )}

                {screen.name === "review" && (
                    <Review
                        missed={screen.missed}
                        onRetry={() => {
                            unlockAudio();
                            finalAttempts.current += 1;
                            setScreen({ name: "final" });
                        }}
                    />
                )}

                {screen.name === "prize" && (
                    <Prize
                        kid={kid}
                        winDate={winDate}
                        previewMode={previewMode}
                        onReplay={() => setScreen({ name: "intro" })}
                    />
                )}
            </div>
        </div>
    );
}

// ============================================================
// SHARED UI
// ============================================================

function StageSteps({ stage }: { stage: Stage }) {
    return (
        <div className="flex items-center gap-2 mb-3 shrink-0">
            {([1, 2, 3, 4] as Stage[]).map((s) => (
                <div key={s} className="flex-1">
                    <div className={`h-2 rounded-full transition-colors ${s < stage ? "bg-teal-400" : s === stage ? "bg-yellow-400" : "bg-white/10"}`} />
                    <div className={`text-[11px] lg:text-xs font-bold mt-1 truncate ${s === stage ? "text-yellow-300" : s < stage ? "text-teal-300" : "text-gray-500"}`}>
                        {s < stage ? "✓ " : ""}{s}. {STAGE_INFO[s].title}
                    </div>
                </div>
            ))}
        </div>
    );
}

function WordImage(props: { word: DictationWord; className?: string }) {
    return <WordImageInner key={props.word.w} {...props} />;
}

function WordImageInner({ word, className }: { word: DictationWord; className?: string }) {
    const [error, setError] = useState(false);

    if (error) return <div className={`flex items-center justify-center text-8xl ${className}`}>{word.emoji}</div>;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={dictationImagePath(word.w)}
            alt={word.es}
            onError={() => setError(true)}
            className={`object-contain bg-white rounded-3xl shadow-xl ${className}`}
        />
    );
}

function LetterBoxes({ letters, activeIndex, wrongIndexes, tone, length }: {
    letters: { char: string; given: boolean }[];
    activeIndex: number | null;
    wrongIndexes?: Set<number>;
    tone: "idle" | "ok" | "no";
    length: number;
}) {
    // Las palabras largas (vaccinations) necesitan cajas más angostas para caber en una fila
    const size = length > 9
        ? "w-8 h-11 text-xl md:w-10 md:h-12 md:text-2xl lg:w-12 lg:h-14 lg:text-3xl"
        : "w-10 h-12 text-2xl md:w-12 md:h-14 lg:w-16 lg:h-[72px] lg:text-4xl";
    return (
        <div className={`flex gap-1 md:gap-1.5 lg:gap-2 justify-center ${tone === "no" ? "dictation-shake" : ""}`}>
            {letters.map((l, i) => {
                let style = "border-white/10 bg-black/20 text-gray-600";
                if (l.given) style = "border-transparent bg-white/5 text-teal-300";
                else if (wrongIndexes?.has(i)) style = "border-red-400 bg-red-500/20 text-red-200";
                else if (tone === "ok") style = "border-teal-400 bg-teal-400/20 text-teal-200";
                else if (l.char) style = "border-white bg-white/20 text-white";
                else if (i === activeIndex) style = "border-yellow-400 bg-yellow-400/10 text-white";
                return (
                    <div key={i} className={`${size} rounded-xl border-2 flex items-center justify-center font-bold uppercase transition-all shadow-lg ${style}`}>
                        {l.char}
                    </div>
                );
            })}
        </div>
    );
}

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"].map((r) => r.split(""));

function Keyboard({ onKey, disabled, canSubmit }: { onKey: (key: string) => void; disabled: boolean; canSubmit: boolean }) {
    // Teclado físico (útil para probar en computadora)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === "Backspace") onKey("BACK");
            else if (e.key === "Enter") onKey("ENTER");
            else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onKey]);

    const keyClass = "bg-white/10 active:bg-white/30 rounded-lg lg:rounded-2xl text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white shadow-md border-b-2 border-white/5 active:translate-y-[2px] transition-all select-none min-h-[48px] md:min-h-[56px] lg:min-h-[60px]";
    return (
        <div data-game-keyboard className={`shrink-0 pt-2 pb-2 transition-opacity ${disabled ? "opacity-30 pointer-events-none" : ""}`}>
            <div className="grid grid-cols-10 gap-1 sm:gap-1.5 md:gap-2 mb-1.5">
                {KEY_ROWS[0].map((l) => <button type="button" key={l} onClick={() => onKey(l)} className={keyClass}>{l}</button>)}
            </div>
            <div className="grid grid-cols-9 gap-1 sm:gap-1.5 md:gap-2 mb-1.5 px-[5%]">
                {KEY_ROWS[1].map((l) => <button type="button" key={l} onClick={() => onKey(l)} className={keyClass}>{l}</button>)}
            </div>
            <div className="grid grid-cols-11 gap-1 sm:gap-1.5 md:gap-2">
                <button type="button" onClick={() => onKey("BACK")} className="col-span-2 bg-red-500/20 active:bg-red-500/40 text-red-200 rounded-lg lg:rounded-2xl font-bold text-xl md:text-2xl lg:text-3xl shadow-md border-b-2 border-red-900/50 active:translate-y-[2px] transition-all min-h-[48px] md:min-h-[56px] lg:min-h-[60px]" aria-label="Borrar">⌫</button>
                {KEY_ROWS[2].map((l) => <button type="button" key={l} onClick={() => onKey(l)} className={keyClass}>{l}</button>)}
                <button type="button" onClick={() => onKey("ENTER")} className={`col-span-2 rounded-lg lg:rounded-2xl font-bold text-xl md:text-2xl lg:text-3xl shadow-md border-b-2 active:translate-y-[2px] transition-all min-h-[48px] md:min-h-[56px] lg:min-h-[60px] ${canSubmit ? "bg-green-500 active:bg-green-600 text-white border-green-800" : "bg-white/5 text-gray-600 border-white/5"}`} aria-label="Revisar">✓</button>
            </div>
        </div>
    );
}

function ListenButton({ word, onHeard, pulse, label }: { word: DictationWord; onHeard?: () => void; pulse?: boolean; label: string }) {
    return (
        <button
            type="button"
            onClick={() => { unlockAudio(); playWord(word); onHeard?.(); }}
            className={`flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-400 active:scale-95 text-white font-bold text-lg lg:text-xl px-6 py-4 rounded-2xl shadow-lg shadow-blue-900/40 transition-all min-h-[64px] ${pulse ? "animate-pulse ring-4 ring-yellow-400/60" : ""}`}
        >
            <span className="text-3xl">🔊</span> {label}
        </button>
    );
}

// ============================================================
// INTRO + STAGE INTRO
// ============================================================

function Intro({ kid, savedStage, winDate, onStart, onShowPrize }: {
    kid: DictationKid;
    savedStage: Stage;
    winDate: string | null;
    onStart: (stage: Stage) => void;
    onShowPrize: () => void;
}) {
    return (
        <div className="h-full flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12 text-center lg:text-left overflow-y-auto py-2">
            <div className="shrink-0 opacity-90">
                <HalfCard kid={kid} locked={!winDate} />
            </div>
            <div className="max-w-md">
                <div className="text-sm font-bold uppercase tracking-widest text-teal-300 mb-1">{DICTATION_TITLE} · {TOTAL} palabras</div>
                <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3">Reto de Dictado</h1>
                {winDate ? (
                    <p className="text-gray-300 mb-5">¡Ya ganaste tu mitad de la tarjeta, {KID_NAMES[kid]}! Puedes volver a practicar cuando quieras.</p>
                ) : (
                    <p className="text-gray-300 mb-5">
                        {KID_NAMES[kid]}, pasa las 4 etapas y escribe las {TOTAL} palabras perfectas para ganar <b className="text-yellow-300">tu mitad de una tarjeta de Robux</b>. Tu hermano gana la otra mitad.
                    </p>
                )}
                <div className="flex flex-col gap-3">
                    {winDate && (
                        <button onClick={onShowPrize} className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xl px-8 py-4 rounded-2xl shadow-xl active:scale-95 transition-all min-h-[64px]">
                            🎁 Ver mi mitad de la tarjeta
                        </button>
                    )}
                    {savedStage > 1 && (
                        <button onClick={() => onStart(savedStage)} className="bg-green-500 hover:bg-green-400 text-white font-bold text-xl px-8 py-4 rounded-2xl shadow-xl active:scale-95 transition-all min-h-[64px]">
                            ▶ Seguir en la etapa {savedStage}
                        </button>
                    )}
                    <button onClick={() => onStart(1)} className={`${savedStage > 1 || winDate ? "bg-white/10 hover:bg-white/20 text-white" : "bg-green-500 hover:bg-green-400 text-white shadow-xl"} font-bold text-xl px-8 py-4 rounded-2xl active:scale-95 transition-all min-h-[64px]`}>
                        {savedStage > 1 ? "Empezar desde el principio" : winDate ? "🔄 Practicar otra vez" : "▶ ¡Empezar!"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function StageIntro({ stage, onGo }: { stage: Stage; onGo: () => void }) {
    const info = STAGE_INFO[stage];
    return (
        <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="text-7xl lg:text-8xl mb-4">{info.emoji}</div>
            <div className="text-sm font-bold uppercase tracking-widest text-yellow-300 mb-1">Etapa {stage} de 4</div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-3">{info.title}</h2>
            <p className="text-lg lg:text-xl text-gray-300 max-w-xl mb-8">{info.text}</p>
            <button onClick={onGo} className="bg-green-500 hover:bg-green-400 text-white font-bold text-2xl px-12 py-4 rounded-2xl shadow-xl active:scale-95 transition-all min-h-[64px]">
                ¡Vamos! ➡
            </button>
        </div>
    );
}

// ============================================================
// ETAPA 1 — Conocer: dibujo + español + tocar la palabra para oírla
// ============================================================

function LearnStage({ onDone }: { onDone: () => void }) {
    const [index, setIndex] = useState(0);
    const [heard, setHeard] = useState(false);
    const word = DICTATION_WORDS[index];

    const next = () => {
        if (index + 1 >= TOTAL) return onDone();
        setIndex(index + 1);
        setHeard(false);
    };

    return (
        <div className="h-full flex flex-col lg:flex-row gap-4 lg:gap-8 items-center justify-center">
            <WordImage word={word} className="w-full max-w-[260px] lg:max-w-[400px] aspect-square shrink min-h-0" />

            <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-3 lg:gap-4 lg:w-[420px]">
                <div className="text-sm font-bold text-gray-400">Palabra {index + 1} de {TOTAL}</div>

                <button
                    type="button"
                    onClick={() => { unlockAudio(); playWord(word); setHeard(true); }}
                    className={`flex items-center gap-4 bg-blue-500 hover:bg-blue-400 active:scale-95 text-white font-bold px-6 py-4 rounded-3xl shadow-xl shadow-blue-900/40 transition-all min-h-[72px] ${heard ? "" : "animate-pulse ring-4 ring-yellow-400/60"}`}
                >
                    <span className="text-3xl lg:text-4xl">🔊</span>
                    <span className={`${word.w.length > 9 ? "text-3xl lg:text-4xl" : "text-4xl lg:text-5xl"} tracking-wide`}>{word.w}</span>
                </button>
                {!heard && <div className="text-yellow-300 font-bold text-sm">👆 Toca la palabra para escucharla</div>}

                <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                    <div className="text-xs font-bold uppercase tracking-widest text-gray-400">En español</div>
                    <div className="text-2xl lg:text-3xl font-bold text-teal-300">{word.es}</div>
                </div>

                <button
                    onClick={next}
                    disabled={!heard}
                    className="bg-green-500 hover:bg-green-400 disabled:bg-white/5 disabled:text-gray-600 text-white font-bold text-xl px-10 py-4 rounded-2xl shadow-lg active:scale-95 transition-all min-h-[64px] mt-1"
                >
                    {index + 1 >= TOTAL ? "¡Listo! ➡" : "Siguiente ➡"}
                </button>
            </div>
        </div>
    );
}

// ============================================================
// ETAPAS 2 y 3 — Completar letras
//   fill:   se ve el dibujo, hay que tocar la bocina antes de escribir, faltan pocas letras
//   listen: la palabra suena sola, solo se da la primera letra
// Una palabra fallada regresa al final de la fila hasta que salga bien.
// ============================================================

function SpellStage({ mode, words, onDone }: { mode: "fill" | "listen"; words: DictationWord[]; onDone: () => void }) {
    const [queue, setQueue] = useState<DictationWord[]>(() => (mode === "listen" ? shuffleArray(words) : words));
    const [typed, setTyped] = useState("");
    const [heard, setHeard] = useState(mode === "listen");
    const [feedback, setFeedback] = useState<"ok" | "no" | null>(null);
    const [msg, setMsg] = useState("");
    const [turn, setTurn] = useState(0);

    const word = queue[0];
    const gapIndexes = mode === "fill" ? word.gaps : word.w.split("").map((_, i) => i).slice(1);
    const gapSet = new Set(gapIndexes);

    // Etapa 3: la palabra suena sola al aparecer
    useEffect(() => {
        if (mode === "listen") playWord(word);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [turn, mode]);

    let gapCursor = 0;
    const letters = word.w.split("").map((char, i) => {
        if (!gapSet.has(i)) return { char, given: true };
        const c = feedback === "no" ? char : typed[gapCursor] || "";
        gapCursor++;
        return { char: c, given: false };
    });
    const wrongIndexes = new Set(feedback === "no" ? gapIndexes.filter((idx, n) => typed[n] !== word.w[idx]) : []);
    const activeIndex = heard && !feedback ? gapIndexes[typed.length] ?? null : null;
    const canSubmit = typed.length === gapIndexes.length && !feedback;

    const advance = (wasCorrect: boolean) => {
        const rest = queue.slice(1);
        if (wasCorrect && rest.length === 0) return onDone();
        setQueue(wasCorrect ? rest : [...rest, word]);
        setTurn((t) => t + 1);
        setTyped("");
        setFeedback(null);
        setHeard(mode === "listen");
    };

    const handleKey = useCallback((key: string) => {
        if (feedback || !heard) return;
        if (key === "BACK") return setTyped((t) => t.slice(0, -1));
        if (key === "ENTER") {
            if (typed.length !== gapIndexes.length) return;
            const ok = gapIndexes.every((idx, n) => typed[n] === word.w[idx]);
            setFeedback(ok ? "ok" : "no");
            setMsg(ok ? randomMsg(CORRECT_MSGS) : "¡Casi! Fíjate en las letras rojas");
            if (!ok) playWord(word);
            return;
        }
        setTyped((t) => (t.length < gapIndexes.length ? t + key.toLowerCase() : t));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [feedback, heard, typed, word.w]);

    // Acierto: avanza solo
    useEffect(() => {
        if (feedback !== "ok") return;
        const t = setTimeout(() => advance(true), 900);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [feedback]);

    const solved = words.length - queue.length;

    return (
        <div className="h-full flex flex-col lg:flex-row gap-3 lg:gap-6">
            {/* LEFT: pista */}
            <div className="shrink-0 lg:w-[30%] flex lg:flex-col items-center justify-center gap-3 lg:gap-4">
                {mode === "fill" && <WordImage word={word} className="w-24 h-24 lg:w-full lg:h-auto lg:max-w-[240px] lg:aspect-square" />}
                <div className="flex flex-col items-center gap-2 lg:gap-3">
                    <ListenButton
                        word={word}
                        onHeard={() => setHeard(true)}
                        pulse={!heard}
                        label={heard ? "Escuchar otra vez" : "Toca para escuchar"}
                    />
                    <div className="text-center">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400">En español</div>
                        <div className="text-xl lg:text-2xl font-bold text-teal-300">{word.es}</div>
                    </div>
                </div>
            </div>

            {/* RIGHT: cajas + teclado */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 flex flex-col items-center justify-center min-h-0 gap-3">
                    <div className="text-sm font-bold text-gray-400">{solved} de {words.length} listas</div>
                    <LetterBoxes letters={letters} activeIndex={activeIndex} wrongIndexes={wrongIndexes} tone={feedback ?? "idle"} length={word.w.length} />
                    <div className="h-14 flex items-center justify-center gap-4">
                        {!heard && <div className="text-yellow-300 font-bold">👈 Primero toca la bocina para escuchar la palabra</div>}
                        {feedback === "ok" && <div className="text-2xl font-bold text-teal-300">✅ {msg}</div>}
                        {feedback === "no" && (
                            <>
                                <div className="text-lg font-bold text-red-300">{msg}</div>
                                <button onClick={() => advance(false)} className="bg-white text-black font-bold text-lg px-6 py-3 rounded-2xl active:scale-95 transition-all min-h-[56px]">
                                    Entendido ➡
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <Keyboard onKey={handleKey} disabled={!heard || !!feedback} canSubmit={canSubmit} />
            </div>
        </div>
    );
}

// ============================================================
// ETAPA 4 — Dictado final: suena la palabra y se escriben todas las letras
// Si se equivocan pueden corregir la palabra una sola vez. Sin cajas: como en el examen,
// no se sabe cuántas letras son. Las palabras falladas en el dictado anterior salen primero.
// ============================================================

function FinalStage({ first, onDone }: { first: string[]; onDone: (missed: Missed[]) => void }) {
    const [order] = useState(() => [
        ...shuffleArray(DICTATION_WORDS.filter((w) => first.includes(w.w))),
        ...shuffleArray(DICTATION_WORDS.filter((w) => !first.includes(w.w))),
    ]);
    const [index, setIndex] = useState(0);
    const [typed, setTyped] = useState("");
    const [feedback, setFeedback] = useState<"ok" | "no" | null>(null);
    const [missed, setMissed] = useState<Missed[]>([]);
    const [retried, setRetried] = useState(false);
    const [shake, setShake] = useState(0);

    const word = order[index];

    useEffect(() => { playWord(word); }, [word]);

    const next = useCallback(() => {
        if (index + 1 >= order.length) return onDone(missed);
        setIndex(index + 1);
        setTyped("");
        setFeedback(null);
        setRetried(false);
    }, [index, order.length, missed, onDone]);

    const handleKey = useCallback((key: string) => {
        if (feedback) return;
        if (key === "BACK") return setTyped((t) => t.slice(0, -1));
        if (key === "ENTER") {
            if (!typed) return;
            const ok = typed === word.w;
            if (!ok) playWord(word);
            if (!ok && !retried) {
                // Primera falla: no se muestra la respuesta, se deja lo escrito para corregirlo
                setRetried(true);
                return setShake((n) => n + 1);
            }
            if (!ok) setMissed((m) => [...m, { word, typed }]);
            return setFeedback(ok ? "ok" : "no");
        }
        setTyped((t) => (t.length < MAX_FREE_INPUT ? t + key.toLowerCase() : t));
    }, [feedback, typed, word, retried]);

    useEffect(() => {
        if (feedback !== "ok") return;
        const t = setTimeout(next, 800);
        return () => clearTimeout(t);
    }, [feedback, next]);

    return (
        <div className="h-full flex flex-col lg:flex-row gap-3 lg:gap-6">
            <div className="shrink-0 lg:w-[30%] flex lg:flex-col items-center justify-center gap-3 lg:gap-4">
                <div className="text-center">
                    <div className="text-sm font-bold text-gray-400">Palabra {index + 1} de {order.length}</div>
                    <div className={`text-lg font-bold ${missed.length ? "text-red-300" : "text-teal-300"}`}>
                        {missed.length ? `${missed.length} con error` : "Vas perfecto ⭐"}
                    </div>
                </div>
                <ListenButton word={word} label="Escuchar otra vez" />
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 flex flex-col items-center justify-center min-h-0 gap-3">
                    <div key={shake} className={`w-full max-w-xl min-h-[72px] rounded-2xl border-2 flex items-center justify-center px-4 text-3xl lg:text-5xl font-bold tracking-[0.15em] lowercase transition-colors ${feedback === "ok" ? "border-teal-400 bg-teal-400/20 text-teal-200" : feedback === "no" ? "border-red-400 bg-red-500/20 text-red-200 dictation-shake" : retried ? "border-yellow-400 bg-yellow-400/10 text-white dictation-shake" : "border-white/20 bg-black/20 text-white"}`}>
                        {typed}{!feedback && <span className="animate-pulse text-yellow-400">|</span>}
                    </div>
                    <div className="h-16 flex items-center justify-center gap-4">
                        {!feedback && !retried && !typed && <div className="text-gray-400 font-bold">Escribe la palabra que escuchaste y toca ✓</div>}
                        {!feedback && retried && <div className="text-yellow-300 font-bold text-lg">🤔 ¡Casi! Escúchala otra vez y corrígela. Te queda 1 oportunidad.</div>}
                        {feedback === "ok" && <div className="text-2xl font-bold text-teal-300">✅ ¡Correcto!</div>}
                        {feedback === "no" && (
                            <>
                                <div className="text-lg text-gray-300">Se escribe <b className="text-yellow-300 text-2xl tracking-wider">{word.w}</b></div>
                                <button onClick={next} className="bg-white text-black font-bold text-lg px-6 py-3 rounded-2xl active:scale-95 transition-all min-h-[56px]">
                                    Siguiente ➡
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <Keyboard onKey={handleKey} disabled={!!feedback} canSubmit={!!typed && !feedback} />
            </div>
        </div>
    );
}

function Review({ missed, onRetry }: { missed: Missed[]; onRetry: () => void }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center px-4 overflow-y-auto py-2">
            <div className="text-6xl mb-2">💪</div>
            <h2 className="text-3xl font-bold text-white mb-1">¡Casi lo logras!</h2>
            <p className="text-lg text-gray-300 mb-4">
                Sacaste <b className="text-teal-300">{TOTAL - missed.length} de {TOTAL}</b>. Para ganar tu mitad necesitas las {TOTAL} bien. Fíjate bien en {missed.length === 1 ? "esta" : "estas"}: el dictado va a empezar con {missed.length === 1 ? "ella" : "ellas"}.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-6 max-w-3xl">
                {missed.map(({ word, typed }) => (
                    <button key={word.w} onClick={() => playWord(word)} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-left active:scale-95 transition-all min-h-[64px]">
                        <div className="text-sm text-red-300 line-through">{typed}</div>
                        <div className="text-xl font-bold text-yellow-300">🔊 {word.w}</div>
                    </button>
                ))}
            </div>
            <button onClick={onRetry} className="bg-green-500 hover:bg-green-400 text-white font-bold text-xl px-10 py-4 rounded-2xl shadow-xl active:scale-95 transition-all min-h-[64px]">
                Volver al dictado ➡
            </button>
        </div>
    );
}

// ============================================================
// PREMIO — mitad de la tarjeta de Robux
// Isaac tiene la mitad izquierda y Elías la derecha: juntando las dos tablets se ve completa.
// ============================================================

// Corte en zigzag compartido por las dos mitades (x alterna alrededor de 320)
const CUT_POINTS = Array.from({ length: 21 }, (_, i) => `${i % 2 === 0 ? 330 : 310},${i * 20}`).join(" ");

function HalfCard({ kid, locked = false, big = false }: { kid: DictationKid; locked?: boolean; big?: boolean }) {
    const left = kid === "isaac";
    const clipId = `dictation-cut-${kid}`;
    return (
        <svg
            viewBox={left ? "0 0 332 400" : "308 0 332 400"}
            className={`${big ? "w-[240px] lg:w-[400px]" : "w-[200px] lg:w-[280px]"} h-auto drop-shadow-2xl ${locked ? "grayscale opacity-60" : ""}`}
            role="img"
            aria-label={`Mitad de la tarjeta de Robux de ${KID_NAMES[kid]}`}
        >
            <defs>
                <linearGradient id={`${clipId}-bg`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#10b981" />
                    <stop offset="0.55" stopColor="#065f46" />
                    <stop offset="1" stopColor="#0f172a" />
                </linearGradient>
                <linearGradient id={`${clipId}-gold`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fde68a" />
                    <stop offset="1" stopColor="#f59e0b" />
                </linearGradient>
                <clipPath id={clipId}>
                    <polygon points={left ? `0,0 ${CUT_POINTS} 0,400` : `640,0 ${CUT_POINTS} 640,400`} />
                </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`} fontFamily="inherit" fontWeight="800">
                <rect width="640" height="400" rx="32" fill={`url(#${clipId}-bg)`} />
                <path d="M0 300 L640 120 L640 200 L0 380 Z" fill="#ffffff" opacity="0.06" />
                <rect x="14" y="14" width="612" height="372" rx="22" fill="none" stroke="#fde68a" strokeOpacity="0.5" strokeWidth="3" />

                <text x="320" y="78" textAnchor="middle" fontSize="46" fill="#ffffff" letterSpacing="3">TARJETA DE ROBUX</text>

                {/* Moneda hexagonal */}
                <polygon points="320,105 398,150 398,240 320,285 242,240 242,150" fill={`url(#${clipId}-gold)`} stroke="#78350f" strokeWidth="6" strokeLinejoin="round" />
                <polygon points="320,133 374,164 374,226 320,257 266,226 266,164" fill="none" stroke="#78350f" strokeOpacity="0.45" strokeWidth="5" strokeLinejoin="round" />
                <rect x="296" y="171" width="48" height="48" rx="6" fill="#78350f" />

                <text x="320" y="335" textAnchor="middle" fontSize="30" fill="#fde68a" letterSpacing="2">VALE POR UNA TARJETA</text>
                <text x="40" y="372" fontSize="22" fill="#ffffff" opacity="0.9">Mitad de Isaac</text>
                <text x="600" y="372" textAnchor="end" fontSize="22" fill="#ffffff" opacity="0.9">Mitad de Elías</text>
            </g>
        </svg>
    );
}

function Prize({ kid, winDate, previewMode, onReplay }: { kid: DictationKid; winDate: string | null; previewMode: boolean; onReplay: () => void }) {
    const left = kid === "isaac";
    const brother = left ? "Elías" : "Isaac";
    const dateLabel = winDate
        ? new Date(winDate).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
        : "";

    return (
        <div className={`h-full flex flex-col ${left ? "lg:flex-row-reverse" : "lg:flex-row"} items-center justify-center lg:justify-between gap-6 relative overflow-y-auto py-2`}>
            <Confetti />

            {/* La mitad va pegada al borde por donde se junta con la tablet del hermano */}
            <div className="dictation-pop shrink-0">
                <HalfCard kid={kid} big />
            </div>

            <div className="max-w-lg text-center lg:text-left px-2">
                <div className="text-5xl mb-2">🏆</div>
                <h2 className="text-3xl lg:text-4xl font-bold text-white mb-2">¡{TOTAL} de {TOTAL} perfectas, {KID_NAMES[kid]}!</h2>
                <p className="text-lg text-gray-200 mb-3">
                    Ganaste <b className="text-yellow-300">tu mitad de la tarjeta de Robux</b>.
                </p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 text-gray-200">
                    <b>¿Cómo se cobra?</b> Cuando {brother} gane su mitad, junten las dos tablets para armar la tarjeta completa y enséñensela a sus papás.
                </div>
                <div className="text-sm text-teal-300 font-bold mb-4">
                    {previewMode ? "👀 Vista previa: no se guarda" : `✅ Dictado perfecto${dateLabel ? ` · ${dateLabel}` : ""}`}
                </div>
                <div className="flex gap-3 justify-center lg:justify-start">
                    <button onClick={onReplay} className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-4 rounded-2xl active:scale-95 transition-all min-h-[56px]">
                        🔄 Practicar otra vez
                    </button>
                </div>
            </div>
        </div>
    );
}
