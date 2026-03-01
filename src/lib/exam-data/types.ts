// --- Exam Prep Types for Misión Examen ---

export type ExamQuestionType =
    | "multiple_choice"
    | "classify"
    | "order_steps"
    | "true_false"
    | "match"
    | "numeric_input"
    | "compare"
    | "word_problem";

export type SubjectKey = "spanish" | "science" | "math";

export type ExamLevel = {
    id: string;
    title: string;
    emoji: string;
    description: string;
    color: string;
    questions: ExamQuestion[];
};

export type SubjectWorld = {
    id: SubjectKey;
    title: string;
    emoji: string;
    color: string;
    description: string;
    levels: ExamLevel[];
};

export type ClassifyCategory = {
    id: string;
    label: string;
    emoji?: string;
    color: string;
};

export type ClassifyItem = {
    text: string;
    emoji?: string;
    correctCategoryId: string;
};

export type MatchPair = {
    left: string;
    right: string;
};

export type WordProblemData = {
    problemText: string;
    operationOptions: string[];
    correctOperation: string;
    correctAnswer: string;
};

export type ExamQuestion = {
    id: string;
    levelId: string;
    questionType: ExamQuestionType;
    questionText: string;
    points: number;
    hint?: string;
    // multiple_choice
    options?: string[];
    correctAnswer?: string;
    // classify
    categories?: ClassifyCategory[];
    classifyItems?: ClassifyItem[];
    // order_steps
    steps?: string[];
    // match
    matchPairs?: MatchPair[];
    // compare
    comparePair?: [string, string];
    // word_problem
    wordProblemData?: WordProblemData;
};

export type ExamAnswer = {
    questionId: string;
    questionType: ExamQuestionType;
    correct: boolean;
    points: number;
};

export type ExamGameState = {
    subject: SubjectKey;
    level: ExamLevel;
    questions: ExamQuestion[];
    index: number;
    answers: ExamAnswer[];
    startTime: number;
    timeLeft: null;
    score: number;
    streak: number;
    status: "playing" | "results";
};

// --- Helper to get subject world by key ---
import { SPANISH_WORLD } from "./spanish";
import { SCIENCE_WORLD } from "./science";
import { MATH_EXAM_WORLD } from "./math-exam";

const WORLDS: Record<SubjectKey, SubjectWorld> = {
    spanish: SPANISH_WORLD,
    science: SCIENCE_WORLD,
    math: MATH_EXAM_WORLD,
};

export function getSubjectWorld(key: string): SubjectWorld | null {
    return WORLDS[key as SubjectKey] ?? null;
}

export function getAllWorlds(): SubjectWorld[] {
    return Object.values(WORLDS);
}
