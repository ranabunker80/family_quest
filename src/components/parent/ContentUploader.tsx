"use client";

import { useState, useRef, useCallback } from "react";

// TODO: Import from parent-actions.ts when available
// import { uploadEducationalContent } from "@/lib/parent-actions";

interface KidProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface ContentForm {
  title: string;
  type: "vocabulary" | "reading" | "math" | "science" | "other";
  targetKidId: string;
  file: File | null;
}

interface Props {
  kids: KidProfile[];
}

const CONTENT_TYPES = [
  { id: "vocabulary", label: "Vocabulario", emoji: "📝" },
  { id: "reading", label: "Lectura", emoji: "📖" },
  { id: "math", label: "Matematicas", emoji: "🔢" },
  { id: "science", label: "Ciencias", emoji: "🔬" },
  { id: "other", label: "Otro", emoji: "📎" },
] as const;

const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.txt,.csv,.xlsx,.jpg,.jpeg,.png";

export default function ContentUploader({ kids }: Props) {
  const [form, setForm] = useState<ContentForm>({
    title: "",
    type: "vocabulary",
    targetKidId: kids[0]?.id || "",
    file: null,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setForm((prev) => ({ ...prev, file: droppedFile }));
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setForm((prev) => ({ ...prev, file: selectedFile }));
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.file || !form.targetKidId) return;

    setIsUploading(true);

    // TODO: Replace with actual server action
    // await uploadEducationalContent(form);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsUploading(false);
    setUploadSuccess(true);
    setForm({
      title: "",
      type: "vocabulary",
      targetKidId: kids[0]?.id || "",
      file: null,
    });

    setTimeout(() => setUploadSuccess(false), 3000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "📕";
      case "doc":
      case "docx":
        return "📄";
      case "csv":
      case "xlsx":
        return "📊";
      case "jpg":
      case "jpeg":
      case "png":
        return "🖼️";
      case "txt":
        return "📝";
      default:
        return "📎";
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      {uploadSuccess && (
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <p className="text-teal-400 font-bold text-sm">
            Contenido subido exitosamente!
          </p>
        </div>
      )}

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">📚</span>
          <div>
            <h3 className="text-lg font-bold text-white">
              Subir Contenido Educativo
            </h3>
            <p className="text-gray-500 text-xs">
              Agrega material personalizado para tus hijos
            </p>
          </div>
        </div>

        {/* Title Input */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">
            Titulo del contenido
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder='Ej: "Palabras de ciencia nivel 3"'
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 outline-none focus:border-teal-400 transition-colors"
          />
        </div>

        {/* Content Type Selector */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">
            Tipo de contenido
          </label>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct.id}
                onClick={() =>
                  setForm((prev) => ({ ...prev, type: ct.id }))
                }
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  form.type === ct.id
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {ct.emoji} {ct.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target Kid Selector */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">
            Para quien es?
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                setForm((prev) => ({ ...prev, targetKidId: "all" }))
              }
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                form.targetKidId === "all"
                  ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              👨‍👩‍👧‍👦 Todos
            </button>
            {kids.map((kid) => (
              <button
                key={kid.id}
                onClick={() =>
                  setForm((prev) => ({ ...prev, targetKidId: kid.id }))
                }
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  form.targetKidId === kid.id
                    ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {kid.avatar_url || "👤"} {kid.full_name || "Hijo"}
              </button>
            ))}
          </div>
        </div>

        {/* File Drop Zone */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">
            Archivo
          </label>

          {form.file ? (
            // File Preview
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
              <span className="text-3xl">
                {getFileIcon(form.file.name)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">
                  {form.file.name}
                </p>
                <p className="text-gray-500 text-xs">
                  {formatFileSize(form.file.size)}
                </p>
              </div>
              <button
                onClick={() =>
                  setForm((prev) => ({ ...prev, file: null }))
                }
                className="text-red-400 hover:text-red-300 text-sm font-bold px-3 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                Quitar
              </button>
            </div>
          ) : (
            // Drop Zone
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-teal-400 bg-teal-500/10"
                  : "border-white/10 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <div className="text-4xl mb-3">📄</div>
              <p className="text-gray-300 text-sm font-medium mb-1">
                {isDragging
                  ? "Suelta el archivo aqui"
                  : "Arrastra un archivo o haz clic para seleccionar"}
              </p>
              <p className="text-gray-500 text-xs">
                PDF, Word, Excel, TXT, CSV o imagenes (max 10 MB)
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!form.title.trim() || !form.file || isUploading}
          className="w-full py-3.5 rounded-2xl bg-teal-500 text-white font-bold hover:bg-teal-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-teal-500/20 hover:-translate-y-0.5"
        >
          {isUploading ? "Subiendo..." : "📤 Subir Contenido"}
        </button>
      </div>
    </div>
  );
}
