"use client";

import { useEffect, useState } from "react";

const COLORS = ["#facc15", "#2dd4bf", "#60a5fa", "#c084fc"]; // yellow-400, teal-400, blue-400, purple-400
const PARTICLE_COUNT = 40;

type Particle = {
    id: number;
    x: number;
    delay: number;
    duration: number;
    color: string;
    size: number;
    rotation: number;
    shape: "circle" | "square" | "strip";
};

function generateParticles(): Particle[] {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2 + Math.random() * 1.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
        shape: (["circle", "square", "strip"] as const)[Math.floor(Math.random() * 3)],
    }));
}

export default function Confetti() {
    const [visible, setVisible] = useState(true);
    const [particles] = useState(generateParticles);

    useEffect(() => {
        const timer = setTimeout(() => setVisible(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
            {particles.map((p) => (
                <span
                    key={p.id}
                    className="absolute top-0 animate-confetti-fall"
                    style={{
                        left: `${p.x}%`,
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                        width: p.shape === "strip" ? `${p.size * 0.4}px` : `${p.size}px`,
                        height: p.shape === "strip" ? `${p.size * 1.8}px` : `${p.size}px`,
                        backgroundColor: p.color,
                        borderRadius: p.shape === "circle" ? "50%" : p.shape === "strip" ? "2px" : "2px",
                        transform: `rotate(${p.rotation}deg)`,
                        opacity: 0,
                    }}
                />
            ))}

            <style jsx>{`
                @keyframes confetti-fall {
                    0% {
                        opacity: 1;
                        transform: translateY(-20px) rotate(0deg) scale(1);
                    }
                    20% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(100vh) rotate(720deg) scale(0.5);
                    }
                }
                .animate-confetti-fall {
                    animation-name: confetti-fall;
                    animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    animation-fill-mode: forwards;
                }
            `}</style>
        </div>
    );
}
