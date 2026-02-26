"use client";

function NumKey({ char, onClick, dimmed }: { char: string; onClick: () => void; dimmed?: boolean }) {
    if (!char || dimmed) {
        return <div className="aspect-square rounded-xl" />;
    }
    return (
        <button
            type="button"
            onClick={onClick}
            className="aspect-square bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-xl text-2xl md:text-3xl font-bold text-white shadow-md border-b-2 border-white/5 transform active:translate-y-[2px] active:border-b-0 transition-all select-none flex items-center justify-center min-h-[52px] md:min-h-[60px]"
        >
            {char}
        </button>
    );
}

export default function NumericKeyboard({
    onKey,
    showDecimal = false,
    showFraction = false,
    disabled = false,
}: {
    onKey: (key: string) => void;
    showDecimal?: boolean;
    showFraction?: boolean;
    disabled?: boolean;
}) {
    const handleKey = (key: string) => {
        if (disabled) return;
        onKey(key);
    };

    return (
        <div data-game-keyboard className="shrink-0 pt-2 pb-6 px-4 md:px-8">
            <div className="grid grid-cols-3 gap-2 md:gap-3 max-w-[280px] mx-auto">
                {["7", "8", "9"].map(n => <NumKey key={n} char={n} onClick={() => handleKey(n)} />)}
                {["4", "5", "6"].map(n => <NumKey key={n} char={n} onClick={() => handleKey(n)} />)}
                {["1", "2", "3"].map(n => <NumKey key={n} char={n} onClick={() => handleKey(n)} />)}
                <NumKey char={showDecimal ? "." : ""} onClick={() => handleKey(".")} dimmed={!showDecimal} />
                <NumKey char="0" onClick={() => handleKey("0")} />
                <NumKey char={showFraction ? "/" : ""} onClick={() => handleKey("/")} dimmed={!showFraction} />
            </div>
            <div className="grid grid-cols-2 gap-2 md:gap-3 max-w-[280px] mx-auto mt-2">
                <button
                    type="button"
                    onClick={() => handleKey("BACK")}
                    disabled={disabled}
                    className="bg-red-500/20 active:bg-red-500/40 text-red-200 rounded-xl font-bold text-2xl min-h-[52px] md:min-h-[60px] shadow-md border-b-2 border-red-900/50 transform active:translate-y-[2px] transition-all flex items-center justify-center"
                >
                    ⌫
                </button>
                <button
                    type="button"
                    onClick={() => handleKey("ENTER")}
                    disabled={disabled}
                    className="bg-green-500 active:bg-green-600 text-white rounded-xl font-bold text-2xl min-h-[52px] md:min-h-[60px] shadow-md border-b-2 border-green-800 transform active:translate-y-[2px] transition-all flex items-center justify-center"
                >
                    ✓
                </button>
            </div>
        </div>
    );
}
