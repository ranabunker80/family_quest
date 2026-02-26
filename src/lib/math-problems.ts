// --- Math Problems Generator for Copa de Matemáticas ---
// Procedural generation of math problems for 4th grade (Copa Nacional, Phase 2)

export type QuestionType = "numeric" | "multiple_choice" | "fill_sequence" | "fraction";

export type MathProblem = {
    id: string;
    category: string;
    questionText: string;
    questionType: QuestionType;
    correctAnswer: string;
    options?: string[];
    hint?: string;
    displayData?: {
        sequence?: (number | null)[];
    };
    points: number;
};

export type MathDifficultyKey = "EASY" | "MEDIUM" | "HARD";

export const MATH_DIFFICULTY = {
    EASY: {
        label: "Fácil",
        stars: 1,
        timeLimit: 0,
        showHint: true,
        multiplier: 1,
        problemCount: 8,
        color: "#2A9D8F",
        desc: "Operaciones simples · Sin tiempo · Con pistas",
        categories: ["ADDITION_SUBTRACTION", "MULTIPLICATION", "SEQUENCES", "PLACE_VALUE"],
    },
    MEDIUM: {
        label: "Medio",
        stars: 2,
        timeLimit: 30,
        showHint: true,
        multiplier: 2,
        problemCount: 10,
        color: "#E9C46A",
        desc: "Mixto · 30s/problema · Pocas pistas",
        categories: ["ADDITION_SUBTRACTION", "MULTIPLICATION", "DIVISION", "SEQUENCES", "PLACE_VALUE", "DECOMPOSITION"],
    },
    HARD: {
        label: "Difícil",
        stars: 3,
        timeLimit: 15,
        showHint: false,
        multiplier: 3,
        problemCount: 12,
        color: "#E76F51",
        desc: "Todo incluido · 15s/problema · Sin pistas",
        categories: ["ADDITION_SUBTRACTION", "MULTIPLICATION", "DIVISION", "SEQUENCES", "PLACE_VALUE", "DECOMPOSITION", "FRACTIONS", "DECIMALS"],
    },
} as const;

export type MathCategoryDef = {
    id: string;
    name: string;
    emoji: string;
    color: string;
    generate: (diff: MathDifficultyKey) => MathProblem;
};

export const MATH_CATEGORIES: Record<string, MathCategoryDef> = {
    ADDITION_SUBTRACTION: { id: "ADDITION_SUBTRACTION", name: "Sumas y Restas", emoji: "➕", color: "#2A9D8F", generate: generateAddSub },
    MULTIPLICATION: { id: "MULTIPLICATION", name: "Multiplicación", emoji: "✖️", color: "#E9C46A", generate: generateMultiplication },
    DIVISION: { id: "DIVISION", name: "División", emoji: "➗", color: "#E76F51", generate: generateDivision },
    SEQUENCES: { id: "SEQUENCES", name: "Sucesiones", emoji: "🔢", color: "#457B9D", generate: generateSequence },
    PLACE_VALUE: { id: "PLACE_VALUE", name: "Valor Posicional", emoji: "🏗️", color: "#6A4C93", generate: generatePlaceValue },
    DECOMPOSITION: { id: "DECOMPOSITION", name: "Descomposición", emoji: "🧩", color: "#FF6B35", generate: generateDecomposition },
    FRACTIONS: { id: "FRACTIONS", name: "Fracciones", emoji: "🍕", color: "#E63946", generate: generateFractions },
    DECIMALS: { id: "DECIMALS", name: "Decimales", emoji: "🔍", color: "#0077B6", generate: generateDecimals },
};

// --- Helpers ---

let idCounter = 0;
function uid(): string {
    return `mp_${Date.now()}_${++idCounter}`;
}

function rand(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function generateDistractors(correct: number, count: number): string[] {
    const distractors = new Set<number>();
    const range = Math.max(Math.abs(correct) * 0.3, 5);
    while (distractors.size < count) {
        const offset = rand(1, Math.ceil(range));
        const sign = Math.random() > 0.5 ? 1 : -1;
        const val = correct + offset * sign;
        if (val !== correct && val >= 0) distractors.add(val);
    }
    return Array.from(distractors).map(String);
}

function makeMultipleChoice(correct: string, numericCorrect: number): { options: string[] } {
    const distractors = generateDistractors(numericCorrect, 3);
    const options = shuffle([correct, ...distractors]);
    return { options };
}

// --- Generators ---

function generateAddSub(diff: MathDifficultyKey): MathProblem {
    let a: number, b: number, answer: number, questionText: string, hint: string, points: number;

    if (diff === "EASY") {
        a = rand(100, 999);
        b = rand(100, 999);
        answer = a + b;
        questionText = `¿Cuánto es ${a.toLocaleString()} + ${b.toLocaleString()}?`;
        hint = "Suma las unidades, luego las decenas, luego las centenas";
        points = 5;
    } else if (diff === "MEDIUM") {
        const isSubtraction = Math.random() > 0.5;
        if (isSubtraction) {
            a = rand(1000, 9999);
            b = rand(100, a - 1);
            answer = a - b;
            questionText = `¿Cuánto es ${a.toLocaleString()} − ${b.toLocaleString()}?`;
            hint = "Recuerda pedir prestado si la cifra de arriba es menor";
        } else {
            a = rand(1000, 9999);
            b = rand(100, 9999);
            answer = a + b;
            questionText = `¿Cuánto es ${a.toLocaleString()} + ${b.toLocaleString()}?`;
            hint = "Alinea las cifras por posición";
        }
        points = 10;
    } else {
        // HARD: 4-5 digit operations, sometimes chained
        const useChain = Math.random() > 0.6;
        if (useChain) {
            a = rand(1000, 99999);
            b = rand(100, 9999);
            const c = rand(100, 9999);
            const isAdd = Math.random() > 0.5;
            if (isAdd) {
                answer = a + b - c;
                if (answer < 0) { answer = a + b + c; questionText = `¿Cuánto es ${a.toLocaleString()} + ${b.toLocaleString()} + ${c.toLocaleString()}?`; }
                else questionText = `¿Cuánto es ${a.toLocaleString()} + ${b.toLocaleString()} − ${c.toLocaleString()}?`;
            } else {
                answer = a - b + c;
                if (answer < 0) { answer = a + b + c; questionText = `¿Cuánto es ${a.toLocaleString()} + ${b.toLocaleString()} + ${c.toLocaleString()}?`; }
                else questionText = `¿Cuánto es ${a.toLocaleString()} − ${b.toLocaleString()} + ${c.toLocaleString()}?`;
            }
        } else {
            a = rand(10000, 99999);
            b = rand(1000, a);
            const isSub = Math.random() > 0.5;
            if (isSub) {
                answer = a - b;
                questionText = `¿Cuánto es ${a.toLocaleString()} − ${b.toLocaleString()}?`;
            } else {
                answer = a + b;
                questionText = `¿Cuánto es ${a.toLocaleString()} + ${b.toLocaleString()}?`;
            }
        }
        hint = "";
        points = 15;
    }

    return {
        id: uid(), category: "ADDITION_SUBTRACTION", questionText,
        questionType: "numeric", correctAnswer: String(answer),
        hint, points,
    };
}

function generateMultiplication(diff: MathDifficultyKey): MathProblem {
    let a: number, b: number, answer: number, questionText: string, hint: string, points: number;
    let questionType: QuestionType = "numeric";

    if (diff === "EASY") {
        a = rand(2, 9);
        b = rand(2, 9);
        answer = a * b;
        questionText = `¿Cuánto es ${a} × ${b}?`;
        hint = `Piensa: ${a} grupos de ${b}`;
        points = 5;
        questionType = "multiple_choice";
    } else if (diff === "MEDIUM") {
        a = rand(10, 99);
        b = rand(2, 9);
        answer = a * b;
        questionText = `¿Cuánto es ${a} × ${b}?`;
        hint = `Multiplica primero las unidades, luego las decenas`;
        points = 10;
    } else {
        a = rand(10, 99);
        b = rand(10, 99);
        answer = a * b;
        questionText = `¿Cuánto es ${a} × ${b}?`;
        hint = "";
        points = 15;
    }

    const problem: MathProblem = {
        id: uid(), category: "MULTIPLICATION", questionText, questionType,
        correctAnswer: String(answer), hint, points,
    };

    if (questionType === "multiple_choice") {
        problem.options = makeMultipleChoice(String(answer), answer).options;
    }

    return problem;
}

function generateDivision(diff: MathDifficultyKey): MathProblem {
    let divisor: number, quotient: number, dividend: number, questionText: string, hint: string, points: number;

    if (diff === "MEDIUM") {
        // Exact division
        divisor = rand(2, 9);
        quotient = rand(5, 99);
        dividend = divisor * quotient;
        questionText = `¿Cuánto es ${dividend} ÷ ${divisor}?`;
        hint = `¿${divisor} × cuánto = ${dividend}?`;
        points = 10;
    } else {
        // HARD: larger numbers, may ask for quotient only (exact division with larger numbers)
        divisor = rand(2, 9);
        quotient = rand(100, 999);
        dividend = divisor * quotient;
        questionText = `¿Cuánto es ${dividend.toLocaleString()} ÷ ${divisor}?`;
        hint = "";
        points = 15;
    }

    return {
        id: uid(), category: "DIVISION", questionText,
        questionType: "numeric", correctAnswer: String(quotient),
        hint, points,
    };
}

function generateSequence(diff: MathDifficultyKey): MathProblem {
    let step: number, start: number, length: number, missingIndex: number;
    let points: number, hint: string;

    if (diff === "EASY") {
        step = [2, 3, 5, 10][rand(0, 3)];
        start = rand(1, 20) * step;
        length = 5;
        missingIndex = length - 1; // Last position
        hint = `La sucesión avanza de ${step} en ${step}`;
        points = 5;
    } else if (diff === "MEDIUM") {
        const isDecreasing = Math.random() > 0.5;
        step = [3, 4, 5, 6, 7, 8][rand(0, 5)];
        if (isDecreasing) {
            start = rand(50, 200);
            step = -step;
        } else {
            start = rand(1, 50);
        }
        length = 6;
        missingIndex = rand(1, length - 2); // Middle position
        hint = isDecreasing ? "La sucesión es decreciente" : `Observa la diferencia entre números consecutivos`;
        points = 10;
    } else {
        const isDecreasing = Math.random() > 0.4;
        step = [7, 9, 11, 13, 15, 25, 50][rand(0, 6)];
        if (isDecreasing) {
            start = rand(200, 1000);
            step = -step;
        } else {
            start = rand(10, 100);
        }
        length = 6;
        missingIndex = rand(1, length - 2);
        hint = "";
        points = 10;
    }

    const sequence: (number | null)[] = [];
    for (let i = 0; i < length; i++) {
        sequence.push(start + step * i);
    }
    const correctAnswer = String(sequence[missingIndex]);
    sequence[missingIndex] = null;

    const visibleNums = sequence.filter(n => n !== null) as number[];
    const questionText = `Encuentra el valor faltante en la sucesión`;

    return {
        id: uid(), category: "SEQUENCES", questionText,
        questionType: "fill_sequence", correctAnswer,
        displayData: { sequence }, hint, points,
    };
}

function generatePlaceValue(diff: MathDifficultyKey): MathProblem {
    if (diff === "EASY") {
        const num = rand(1000, 9999);
        const digits = String(num).split("").map(Number);
        const posIndex = rand(0, digits.length - 1);
        const posNames = ["millares", "centenas", "decenas", "unidades"];
        const posMultipliers = [1000, 100, 10, 1];
        const offset = 4 - digits.length;
        const actualPos = posIndex + offset;
        const correctValue = digits[posIndex] * posMultipliers[actualPos];
        const posName = posNames[actualPos];

        const questionText = `En el número ${num.toLocaleString()}, ¿cuál es el valor de la cifra ${digits[posIndex]}?`;
        const correct = String(correctValue);
        const { options } = makeMultipleChoice(correct, correctValue);

        return {
            id: uid(), category: "PLACE_VALUE", questionText,
            questionType: "multiple_choice", correctAnswer: correct,
            options, hint: `La cifra ${digits[posIndex]} está en la posición de las ${posName}`,
            points: 5,
        };
    } else if (diff === "MEDIUM") {
        // "Escribe el número: 3 millares, 4 centenas, 5 decenas, 2 unidades"
        const m = rand(1, 9), c = rand(0, 9), d = rand(0, 9), u = rand(0, 9);
        const answer = m * 1000 + c * 100 + d * 10 + u;
        const questionText = `¿Qué número tiene ${m} millares, ${c} centenas, ${d} decenas y ${u} unidades?`;

        return {
            id: uid(), category: "PLACE_VALUE", questionText,
            questionType: "numeric", correctAnswer: String(answer),
            hint: "Millares × 1000 + Centenas × 100 + ...",
            points: 10,
        };
    } else {
        // HARD: decimal place value
        const whole = rand(1, 99);
        const tenths = rand(1, 9);
        const hundredths = rand(1, 9);
        const num = parseFloat(`${whole}.${tenths}${hundredths}`);

        // Ask for value of a specific digit
        const askTenths = Math.random() > 0.5;
        const digit = askTenths ? tenths : hundredths;
        const posName = askTenths ? "décimos" : "centésimos";
        const correctValue = askTenths ? `0.${tenths}` : `0.0${hundredths}`;

        const questionText = `En el número ${num}, ¿cuál es el valor posicional del ${digit} en los ${posName}?`;

        return {
            id: uid(), category: "PLACE_VALUE", questionText,
            questionType: "numeric", correctAnswer: correctValue,
            hint: "", points: 15,
        };
    }
}

function generateDecomposition(diff: MathDifficultyKey): MathProblem {
    if (diff === "MEDIUM") {
        // "¿Qué número es 4×1000 + 5×100 + 6×10 + 2?" -> 4562
        const m = rand(1, 9), c = rand(0, 9), d = rand(0, 9), u = rand(0, 9);
        const answer = m * 1000 + c * 100 + d * 10 + u;
        const parts: string[] = [];
        if (m > 0) parts.push(`${m}×1000`);
        if (c > 0) parts.push(`${c}×100`);
        if (d > 0) parts.push(`${d}×10`);
        if (u > 0) parts.push(`${u}`);

        const questionText = `¿Qué número es ${parts.join(" + ")}?`;

        return {
            id: uid(), category: "DECOMPOSITION", questionText,
            questionType: "numeric", correctAnswer: String(answer),
            hint: "Multiplica cada cifra por su valor posicional y suma",
            points: 10,
        };
    } else {
        // HARD: 5 digit number expanded notation
        const dm = rand(1, 9), m = rand(0, 9), c = rand(0, 9), d = rand(0, 9), u = rand(0, 9);
        const answer = dm * 10000 + m * 1000 + c * 100 + d * 10 + u;
        const parts: string[] = [];
        if (dm > 0) parts.push(`${dm}×10000`);
        if (m > 0) parts.push(`${m}×1000`);
        if (c > 0) parts.push(`${c}×100`);
        if (d > 0) parts.push(`${d}×10`);
        if (u > 0) parts.push(`${u}`);

        const questionText = `¿Qué número es ${parts.join(" + ")}?`;

        return {
            id: uid(), category: "DECOMPOSITION", questionText,
            questionType: "numeric", correctAnswer: String(answer),
            hint: "", points: 15,
        };
    }
}

function generateFractions(diff: MathDifficultyKey): MathProblem {
    // Same denominator fraction addition/subtraction (Copa requirement)
    const denominator = [2, 3, 4, 5, 6, 8][rand(0, 5)];
    const isAddition = Math.random() > 0.4;

    let a: number, b: number, answerNum: number;

    if (isAddition) {
        a = rand(1, denominator - 1);
        b = rand(1, denominator - a);
        answerNum = a + b;
    } else {
        a = rand(2, denominator);
        b = rand(1, a - 1);
        answerNum = a - b;
    }

    const op = isAddition ? "+" : "−";
    const questionText = `¿Cuánto es ${a}/${denominator} ${op} ${b}/${denominator}?`;

    return {
        id: uid(), category: "FRACTIONS", questionText,
        questionType: "fraction", correctAnswer: `${answerNum}/${denominator}`,
        hint: "Como tienen el mismo denominador, solo opera los numeradores",
        points: 15,
    };
}

function generateDecimals(diff: MathDifficultyKey): MathProblem {
    const variant = rand(0, 2);

    if (variant === 0) {
        // Expanded notation to decimal
        const whole = rand(1, 9);
        const tenths = rand(1, 9);
        const hundredths = rand(1, 9);
        const answer = parseFloat(`${whole}.${tenths}${hundredths}`);
        const questionText = `¿Qué número es ${whole} + 0.${tenths} + 0.0${hundredths}?`;

        return {
            id: uid(), category: "DECIMALS", questionText,
            questionType: "numeric", correctAnswer: String(answer),
            hint: "", points: 15,
        };
    } else if (variant === 1) {
        // Fraction to decimal
        const pairs: [number, number][] = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5]];
        const [num, den] = pairs[rand(0, pairs.length - 1)];
        const answer = (num / den).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
        const questionText = `¿Cuánto es ${num}/${den} como decimal?`;

        return {
            id: uid(), category: "DECIMALS", questionText,
            questionType: "numeric", correctAnswer: answer,
            hint: "", points: 15,
        };
    } else {
        // Add two decimals
        const a = (rand(1, 99) / 10);
        const b = (rand(1, 99) / 10);
        const answer = parseFloat((a + b).toFixed(2));
        const questionText = `¿Cuánto es ${a.toFixed(1)} + ${b.toFixed(1)}?`;

        return {
            id: uid(), category: "DECIMALS", questionText,
            questionType: "numeric", correctAnswer: String(answer),
            hint: "", points: 15,
        };
    }
}

// --- Game Generation ---

export function generateMathGame(diffKey: MathDifficultyKey): MathProblem[] {
    const diff = MATH_DIFFICULTY[diffKey];
    const problems: MathProblem[] = [];
    let catIndex = 0;

    for (let i = 0; i < diff.problemCount; i++) {
        const catId = diff.categories[catIndex % diff.categories.length];
        const category = MATH_CATEGORIES[catId];
        problems.push(category.generate(diffKey));
        catIndex++;
    }

    return shuffle(problems);
}

// --- Answer Checking ---

function fractionsEqual(a: string, b: string): boolean {
    const partsA = a.split("/").map(Number);
    const partsB = b.split("/").map(Number);
    if (partsA.length !== 2 || partsB.length !== 2) return false;
    const [aN, aD] = partsA;
    const [bN, bD] = partsB;
    if (isNaN(aN) || isNaN(aD) || isNaN(bN) || isNaN(bD)) return false;
    if (aD === 0 || bD === 0) return false;
    return aN * bD === bN * aD;
}

export function checkAnswer(problem: MathProblem, userAnswer: string): boolean {
    const normalize = (s: string) => s.trim().replace(/\s/g, "").replace(/,/g, "");

    if (problem.questionType === "fraction") {
        return fractionsEqual(normalize(userAnswer), normalize(problem.correctAnswer));
    }

    const userNum = parseFloat(normalize(userAnswer));
    const correctNum = parseFloat(normalize(problem.correctAnswer));

    if (isNaN(userNum) || isNaN(correctNum)) {
        return normalize(userAnswer) === normalize(problem.correctAnswer);
    }

    return Math.abs(userNum - correctNum) < 0.001;
}
