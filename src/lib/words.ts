export const CATEGORIES = {
    ANIMALS: { emoji: "🐾", color: "#FF6B35", words: ["pig", "dog", "cat", "lion", "zebra", "bear", "chicken", "duck", "sheep", "goat"] },
    HEALTH: { emoji: "🏥", color: "#E63946", words: ["flu", "rest", "germs", "sick", "bed", "fever", "pain", "nurse", "doctor"] },
    PLACES: { emoji: "🏠", color: "#457B9D", words: ["house", "farm", "city", "town", "park", "school", "mall", "hospital", "street", "bank"] },
    FAMILY: { emoji: "👨‍👩‍👧‍👦", color: "#E9C46A", words: ["mom", "dad", "sister", "brother", "aunt", "uncle", "me", "cousin", "baby", "family"] },
    SCHOOL: { emoji: "📚", color: "#2A9D8F", words: ["boy", "girl", "teacher", "student", "pencil", "eraser", "table", "chair", "board", "book"] },
    OCEAN: { emoji: "🌊", color: "#0077B6", words: ["beach", "map", "tree", "sand", "chest", "ship", "fish", "pirate", "ocean", "sky"] },
    SPORTS: { emoji: "⚽", color: "#F4A261", words: ["sport", "ball", "run", "climb", "hit", "kick", "team", "soccer", "tennis", "jump"] },
    FOOD: { emoji: "🍎", color: "#E76F51", words: ["apple", "milk", "salt", "fruit", "egg", "protein", "drink", "carrot", "grain", "cheese"] },
    DINOSAUR: { emoji: "🦕", color: "#6A4C93", words: ["head", "horn", "leg", "tail", "neck", "teeth", "bones", "wings", "spikes", "claws"] },
    PLANTS: { emoji: "🌱", color: "#606C38", words: ["seed", "plant", "flower", "roots", "leaves", "petals", "bloom", "grow", "water", "soil"] },
};

export const HINTS: Record<string, string> = {
    pig: "🐷", dog: "🐕", cat: "🐱", lion: "🦁", zebra: "🦓", bear: "🐻", chicken: "🐔", duck: "🦆", sheep: "🐑", goat: "🐐",
    flu: "🤒", rest: "😴", germs: "🦠", sick: "🤢", bed: "🛏️", fever: "🌡️", pain: "🤕", nurse: "👩‍⚕️", doctor: "👨‍⚕️",
    house: "🏠", farm: "🚜", city: "🏙️", town: "🏘️", park: "🌳", school: "🏫", mall: "🛍️", hospital: "🏥", street: "🛣️", bank: "🏦",
    mom: "👩", dad: "👨", sister: "👧", brother: "👦", aunt: "👩‍🦰", uncle: "👨‍🦱", me: "🙋", cousin: "🧑", baby: "👶", family: "👨‍👩‍👧‍👦",
    boy: "👦", girl: "👧", teacher: "👩‍🏫", student: "🎒", pencil: "✏️", eraser: "🧽", table: "🪑", chair: "💺", board: "📋", book: "📖",
    beach: "🏖️", map: "🗺️", tree: "🌲", sand: "⏳", chest: "📦", ship: "🚢", fish: "🐟", pirate: "🏴‍☠️", ocean: "🌊", sky: "☁️",
    sport: "🏅", ball: "⚽", run: "🏃", climb: "🧗", hit: "🥊", kick: "🦶", team: "👥", soccer: "⚽", tennis: "🎾", jump: "🤸",
    apple: "🍎", milk: "🥛", salt: "🧂", fruit: "🍇", egg: "🥚", protein: "💪", drink: "🥤", carrot: "🥕", grain: "🌾", cheese: "🧀",
    head: "🦕", horn: "🦏", leg: "🦿", tail: "🐊", neck: "🦒", teeth: "🦷", bones: "🦴", wings: "🪽", spikes: "🔱", claws: "🐾",
    seed: "🌰", plant: "🌿", flower: "🌸", roots: "🌳", leaves: "🍃", petals: "🌺", bloom: "🌷", grow: "📈", water: "💧", soil: "🟤"
};

export const DIFFICULTY = {
    EASY: { label: "Fácil", stars: 1, timeLimit: 0, showHint: true, showFirst: true, multiplier: 1, color: "#2A9D8F", wordCount: 6, desc: "Emoji + letra · Sin tiempo" },
    MEDIUM: { label: "Medio", stars: 2, timeLimit: 30, showHint: true, showFirst: false, multiplier: 2, color: "#E9C46A", wordCount: 8, desc: "Solo emoji · 30s/palabra" },
    HARD: { label: "Difícil", stars: 3, timeLimit: 15, showHint: false, showFirst: false, multiplier: 3, color: "#E76F51", wordCount: 10, desc: "Solo categoría · 15s/palabra" }
};
