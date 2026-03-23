"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  HAIR_COLORS,
  HAIR_STUDIO_POINTS,
  HAIR_CATEGORY,
  type HairColor,
  type BlendMode,
} from "@/lib/hair-studio-data";
import { submitHairStudioResult } from "@/lib/hair-studio-actions";
import Confetti from "@/components/game/Confetti";
import Link from "next/link";

type Phase = "intro" | "studio" | "results";

interface Props {
  profile: any;
  previewMode?: boolean;
}

export default function HairStudioEngine({ profile, previewMode = false }: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [selectedColor, setSelectedColor] = useState<HairColor | null>(null);
  const [blendMode, setBlendMode] = useState<BlendMode>("overlay");
  const [intensity, setIntensity] = useState(0.7);
  const [photos, setPhotos] = useState<string[]>([]);
  const [colorsUsed, setColorsUsed] = useState<Set<string>>(new Set());
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [segmenterReady, setSegmenterReady] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [flashEffect, setFlashEffect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rainbowHue, setRainbowHue] = useState(0);
  const startTimeRef = useRef(Date.now());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const segmenterRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);

  // Initialize camera
  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setCameraError("No se pudo acceder a la camara. Verifica los permisos.");
    }
  }, []);

  // Initialize MediaPipe segmenter
  const initSegmenter = useCallback(async () => {
    try {
      // @ts-expect-error -- dynamic import for code-splitting, types resolve at runtime
      const vision = await import("@mediapipe/tasks-vision");
      const { ImageSegmenter, FilesetResolver } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const segmenter = await ImageSegmenter.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });

      segmenterRef.current = segmenter;
      setSegmenterReady(true);
    } catch (err) {
      console.error("Segmenter init error:", err);
      // Try CPU fallback
      try {
        // @ts-expect-error -- dynamic import for code-splitting
        const vision = await import("@mediapipe/tasks-vision");
        const { ImageSegmenter, FilesetResolver } = vision;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const segmenter = await ImageSegmenter.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
          },
          runningMode: "VIDEO",
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });

        segmenterRef.current = segmenter;
        setSegmenterReady(true);
      } catch (err2) {
        console.error("Segmenter CPU fallback error:", err2);
      }
    }
  }, []);

  // Render loop: draw video + hair color overlay
  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const segmenter = segmenterRef.current;

    if (!video || !canvas || !maskCanvas || !segmenter || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    maskCanvas.width = w;
    maskCanvas.height = h;

    const ctx = canvas.getContext("2d")!;
    const maskCtx = maskCanvas.getContext("2d")!;

    // Mirror the video (selfie mode)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -w, 0, w, h);
    ctx.restore();

    // Run segmentation
    try {
      const now = performance.now();
      const result = segmenter.segmentForVideo(video, now);

      if (result?.categoryMask && selectedColor) {
        const maskData = result.categoryMask.getAsUint8Array();

        // Create hair mask on offscreen canvas
        const maskImageData = maskCtx.createImageData(w, h);
        const pixels = maskImageData.data;

        let colorR: number, colorG: number, colorB: number;
        const isRainbow = selectedColor.hex === "rainbow";

        if (!isRainbow) {
          // Parse hex color
          const hex = selectedColor.hex;
          colorR = parseInt(hex.slice(1, 3), 16);
          colorG = parseInt(hex.slice(3, 5), 16);
          colorB = parseInt(hex.slice(5, 7), 16);
        } else {
          colorR = colorG = colorB = 0; // will be set per-pixel
        }

        for (let i = 0; i < maskData.length; i++) {
          if (maskData[i] === HAIR_CATEGORY) {
            if (isRainbow) {
              // Rainbow: color varies by horizontal position
              const x = i % w;
              const hue = ((x / w) * 360 + rainbowHue) % 360;
              const rgb = hslToRgb(hue, 100, 50);
              pixels[i * 4] = rgb[0];
              pixels[i * 4 + 1] = rgb[1];
              pixels[i * 4 + 2] = rgb[2];
            } else {
              pixels[i * 4] = colorR;
              pixels[i * 4 + 1] = colorG;
              pixels[i * 4 + 2] = colorB;
            }
            pixels[i * 4 + 3] = Math.floor(255 * intensity);
          }
        }

        maskCtx.putImageData(maskImageData, 0, 0);

        // Mirror the mask too
        ctx.save();
        ctx.scale(-1, 1);
        ctx.globalCompositeOperation = blendMode === "color" ? "color" : blendMode;
        ctx.drawImage(maskCanvas, -w, 0, w, h);
        ctx.restore();
      }

      result?.categoryMask?.close();
    } catch {
      // Segmentation frame error — skip silently
    }

    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, [selectedColor, blendMode, intensity, rainbowHue]);

  // Rainbow hue animation
  useEffect(() => {
    if (selectedColor?.hex !== "rainbow") return;
    const interval = setInterval(() => {
      setRainbowHue((h) => (h + 3) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, [selectedColor]);

  // Start render loop when studio is active
  useEffect(() => {
    if (phase !== "studio") return;

    initCamera();
    initSegmenter();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      // Stop camera
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
      }
      // Cleanup segmenter
      segmenterRef.current?.close();
      segmenterRef.current = null;
    };
  }, [phase, initCamera, initSegmenter]);

  // Start render loop when both camera and segmenter are ready
  useEffect(() => {
    if (cameraReady && segmenterReady && phase === "studio") {
      animFrameRef.current = requestAnimationFrame(renderFrame);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [cameraReady, segmenterReady, phase, renderFrame]);

  // Take photo
  const takePhoto = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Flash effect
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 300);

    const dataUrl = canvas.toDataURL("image/png");
    setPhotos((prev) => [...prev, dataUrl]);

    if (selectedColor) {
      setColorsUsed((prev) => new Set(prev).add(selectedColor.id));
    }
  };

  // Finish session
  const finishSession = async () => {
    if (photos.length === 0) {
      setPhase("results");
      return;
    }

    setSaving(true);
    const photoCount = Math.min(photos.length, HAIR_STUDIO_POINTS.maxPhotos);
    let score = photoCount * HAIR_STUDIO_POINTS.perPhoto;

    // Bonus for trying all colors
    if (colorsUsed.size >= HAIR_COLORS.length) {
      score += HAIR_STUDIO_POINTS.bonusAllColors;
    }

    const timeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);

    if (!previewMode) {
      await submitHairStudioResult(score, {
        photosCount: photoCount,
        colorsUsed: colorsUsed.size,
        timeSeconds,
      });
    }

    setSaving(false);
    setShowConfetti(true);
    setPhase("results");
  };

  // === INTRO SCREEN ===
  if (phase === "intro") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-fade-in">
        <div className="text-8xl mb-6 animate-bounce-slow">💇</div>
        <h1 className="text-4xl font-bold text-white mb-4">Hair Studio</h1>
        <p className="text-gray-300 text-lg mb-2 max-w-md">
          Tomate una selfie y cambia el color de tu pelo en tiempo real.
        </p>
        <p className="text-gray-500 text-sm mb-8 max-w-sm">
          Prueba todos los colores y gana monedas por cada foto.
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {HAIR_COLORS.map((c) => (
            <div
              key={c.id}
              className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center text-lg"
              style={c.hex !== "rainbow" ? { backgroundColor: c.hex } : {
                background: "conic-gradient(red, orange, yellow, green, cyan, blue, violet, red)",
              }}
            >
              {c.hex === "rainbow" ? "" : ""}
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            startTimeRef.current = Date.now();
            setPhase("studio");
          }}
          className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-xl px-10 py-4 rounded-2xl hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-purple-900/50"
          style={{ minHeight: 56 }}
        >
          Abrir Camara
        </button>
      </div>
    );
  }

  // === RESULTS SCREEN ===
  if (phase === "results") {
    const photoCount = Math.min(photos.length, HAIR_STUDIO_POINTS.maxPhotos);
    const baseScore = photoCount * HAIR_STUDIO_POINTS.perPhoto;
    const bonus = colorsUsed.size >= HAIR_COLORS.length ? HAIR_STUDIO_POINTS.bonusAllColors : 0;
    const totalScore = baseScore + bonus;

    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-fade-in">
        {showConfetti && <Confetti />}

        <div className="text-7xl mb-4">📸</div>
        <h2 className="text-3xl font-bold text-white mb-2">Sesion Completa</h2>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 mb-6 max-w-sm w-full">
          <div className="text-5xl font-bold text-yellow-400 mb-2">+{totalScore}</div>
          <div className="text-gray-400 text-sm">monedas ganadas</div>

          <div className="mt-4 space-y-2 text-left text-sm">
            <div className="flex justify-between text-gray-300">
              <span>Fotos tomadas</span>
              <span className="font-bold">{photos.length}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Colores probados</span>
              <span className="font-bold">{colorsUsed.size} / {HAIR_COLORS.length}</span>
            </div>
            {bonus > 0 && (
              <div className="flex justify-between text-yellow-300 font-bold">
                <span>Bonus todos los colores!</span>
                <span>+{bonus}</span>
              </div>
            )}
          </div>
        </div>

        {/* Photo gallery */}
        {photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 max-w-full mb-6">
            {photos.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Foto ${i + 1}`}
                className="w-20 h-20 rounded-xl object-cover border-2 border-white/20 shrink-0"
              />
            ))}
          </div>
        )}

        <Link
          href="/"
          className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold px-8 py-3 rounded-2xl hover:scale-105 active:scale-95 transition-transform"
          style={{ minHeight: 56 }}
        >
          Volver al Inicio
        </Link>
      </div>
    );
  }

  // === STUDIO SCREEN ===
  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 animate-fade-in relative">
      {/* Flash effect */}
      {flashEffect && (
        <div className="absolute inset-0 bg-white z-50 animate-flash pointer-events-none rounded-2xl" />
      )}

      <style>{`
        @keyframes flash {
          0% { opacity: 0.9; }
          100% { opacity: 0; }
        }
        .animate-flash { animation: flash 0.3s ease-out forwards; }
      `}</style>

      {/* Camera / Canvas area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden bg-black/50 border border-white/10">
        <video
          ref={videoRef}
          className="absolute opacity-0 pointer-events-none"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
          style={{ transform: "scaleX(1)" }}
        />
        <canvas ref={maskCanvasRef} className="hidden" />

        {/* Loading overlay */}
        {(!cameraReady || !segmenterReady) && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <div className="text-5xl mb-4 animate-bounce-slow">📷</div>
            <p className="text-white font-bold text-lg">
              {!cameraReady ? "Activando camara..." : "Cargando IA..."}
            </p>
            <div className="mt-4 w-32 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4">
            <div className="text-5xl mb-4">😕</div>
            <p className="text-white font-bold text-lg text-center mb-4">{cameraError}</p>
            <button
              onClick={() => { setCameraError(null); initCamera(); }}
              className="bg-purple-600 text-white font-bold px-6 py-2 rounded-xl"
              style={{ minHeight: 56 }}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Photo count badge */}
        {photos.length > 0 && (
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white font-bold px-3 py-1 rounded-full text-sm">
            📸 {photos.length}
          </div>
        )}

        {/* No color selected hint */}
        {cameraReady && segmenterReady && !selectedColor && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white font-bold px-4 py-2 rounded-full text-sm whitespace-nowrap">
            Elige un color abajo
          </div>
        )}
      </div>

      {/* Controls panel */}
      <div className="lg:w-72 shrink-0 flex flex-col gap-3">
        {/* Color picker */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <h3 className="text-white font-bold text-sm mb-3">Color de Pelo</h3>
          <div className="grid grid-cols-5 gap-2">
            {HAIR_COLORS.map((color) => (
              <button
                key={color.id}
                onClick={() => {
                  setSelectedColor(color);
                  setColorsUsed((prev) => new Set(prev).add(color.id));
                }}
                className={`w-12 h-12 rounded-xl border-2 transition-all hover:scale-110 active:scale-95 flex items-center justify-center ${
                  selectedColor?.id === color.id
                    ? "border-white shadow-lg scale-110"
                    : "border-white/20"
                }`}
                style={
                  color.hex !== "rainbow"
                    ? { backgroundColor: color.hex }
                    : {
                        background:
                          "conic-gradient(red, orange, yellow, green, cyan, blue, violet, red)",
                      }
                }
                title={color.label}
              />
            ))}
          </div>

          {/* Clear color */}
          {selectedColor && (
            <button
              onClick={() => setSelectedColor(null)}
              className="mt-2 text-gray-400 text-xs hover:text-white transition-colors w-full text-center"
            >
              Quitar color
            </button>
          )}
        </div>

        {/* Intensity slider */}
        {selectedColor && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-bold text-sm mb-2">Intensidad</h3>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Suave</span>
              <span>Fuerte</span>
            </div>
          </div>
        )}

        {/* Blend mode */}
        {selectedColor && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-bold text-sm mb-2">Efecto</h3>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "overlay" as BlendMode, label: "Brillante" },
                  { id: "multiply" as BlendMode, label: "Intenso" },
                  { id: "soft-light" as BlendMode, label: "Suave" },
                  { id: "color" as BlendMode, label: "Natural" },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setBlendMode(mode.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    blendMode === mode.id
                      ? "bg-purple-600 text-white"
                      : "bg-white/10 text-gray-400 hover:bg-white/20"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={takePhoto}
            disabled={!cameraReady || !segmenterReady}
            className="flex-1 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold py-3 rounded-2xl hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:hover:scale-100 text-lg"
            style={{ minHeight: 56 }}
          >
            📸 Foto
          </button>
          <button
            onClick={finishSession}
            disabled={saving}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-2xl hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 text-lg"
            style={{ minHeight: 56 }}
          >
            {saving ? "Guardando..." : "Listo ✓"}
          </button>
        </div>

        {/* Progress hint */}
        <div className="text-center text-xs text-gray-500">
          {colorsUsed.size} / {HAIR_COLORS.length} colores probados
          {colorsUsed.size >= HAIR_COLORS.length && (
            <span className="text-yellow-400 font-bold ml-1">Bonus!</span>
          )}
        </div>
      </div>
    </div>
  );
}

// HSL to RGB helper for rainbow effect
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;

  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}
