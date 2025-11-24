"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Calendar, RotateCcw, Star, Tag, Trash2 } from "lucide-react";
import { IClothingItem } from "@/lib/types";
import { RetroButton, RetroWindow } from "@/components/retro-ui";
import { ListSkeleton } from "@/components/ui/skeletons";
import { toast } from "@/components/ui/toaster";

interface OutfitHistoryEntry {
  id: number;
  outfit_date: string;
  feedback: number | null;
  weather_data?: Record<string, unknown> | null;
  items: IClothingItem[];
}

const formatDateLabel = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const extractWeatherDetails = (weather?: Record<string, unknown> | null) => {
  if (!weather || typeof weather !== "object") {
    return { condition: undefined, temperature: undefined };
  }

  const conditionCandidates = ["condition", "summary", "description"] as const;
  const temperatureCandidates = ["temperature", "temp", "temp_feels_like", "feels_like"] as const;

  const condition = conditionCandidates.map((key) => weather[key] as string | undefined).find(Boolean);
  const temperature = temperatureCandidates
    .map((key) => {
      const value = weather[key];
      return typeof value === "number" ? Math.round(value) : undefined;
    })
    .find((value) => typeof value === "number");

  return { condition, temperature };
};

export default function HistoryPage() {
  const [history, setHistory] = useState<OutfitHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/outfits/history?limit=60", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload?.error || "Failed to load outfit history");
      }
      setHistory(payload.data as OutfitHistoryEntry[]);
    } catch (error) {
      console.error("Failed to load outfit history", error);
      toast.error("Failed to load logs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm("Delete this log entry?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/outfits/${id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload?.error || "Failed to delete log");
      }
      setHistory(prev => prev.filter(entry => entry.id !== id));
      toast.success("Log deleted");
    } catch (error) {
      console.error("Failed to delete log", error);
      toast.error("Failed to delete log");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleWearAgain = useCallback(() => {
    toast("Re-run recommendation coming soon", { icon: "🧠" });
  }, []);

  return (
    <div className="h-full p-4 md:p-8 overflow-y-auto bg-[var(--bg-primary)] min-h-screen text-[var(--text)]">
      <div className="max-w-5xl mx-auto space-y-6">
        <RetroWindow title="OUTFIT_LOGS.DB" icon={<Calendar size={14} />} className="h-full">
          {loading ? (
            <div className="py-10">
              <ListSkeleton />
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center font-mono text-sm text-[var(--text-muted)]">
              <p>NO LOGS FOUND.</p>
              <p className="mt-2">RUN A RECOMMENDATION AND LOG YOUR FITS.</p>
            </div>
          ) : (
            <div className="space-y-6 p-2 md:p-4">
              {history.map((entry) => {
                const { condition, temperature } = extractWeatherDetails(entry.weather_data);
                const previewItems = entry.items.slice(0, 4);
                const remainingCount = Math.max(entry.items.length - previewItems.length, 0);
                const rating = typeof entry.feedback === "number" ? Math.max(0, Math.min(5, entry.feedback)) : null;

                return (
                  <article
                    key={entry.id}
                    className="bg-[var(--bg-secondary)] border-2 border-[var(--border)] shadow-[6px_6px_0px_0px_var(--border)] p-1 relative group hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_var(--border)] transition-all duration-200"
                  >
                    <div className="absolute -top-6 left-4 bg-[var(--accent-pink)] border-2 border-[var(--border)] border-b-0 px-3 py-1">
                      <span className="font-mono font-bold text-xs text-[var(--text)] mix-blend-hard-light">{formatDateLabel(entry.outfit_date)}</span>
                    </div>
                    <div className="relative z-10 bg-[var(--bg-secondary)] p-4 border-2 border-transparent">
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-shrink-0 w-full md:w-1/3">
                          <div className="relative grid grid-cols-2 gap-2 bg-[var(--bg-tertiary)] p-2 border-2 border-[var(--border)] border-dashed">
                            {previewItems.map((item) => (
                              <div key={`${entry.id}-${item.id}`} className="aspect-square border border-[var(--border)] bg-[var(--bg-main)] relative overflow-hidden">
                                <Image
                                  src={item.image_url}
                                  alt={item.name}
                                  fill
                                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 20vw"
                                  className="object-cover"
                                />
                              </div>
                            ))}
                            {remainingCount > 0 && (
                              <div className="absolute bottom-2 right-2 bg-black text-white text-[10px] font-mono px-1 border border-[var(--border)]">
                                +{remainingCount} MORE
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col">
                          <div className="flex justify-between items-start gap-3 flex-wrap mb-3">
                            <div>
                              <h3 className="font-black text-lg uppercase text-[var(--text)]">LOG #{entry.id}</h3>
                              <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                                <span className="bg-[var(--accent-yellow)] px-2 py-0.5 border border-[var(--border)] text-[var(--text)] font-bold">
                                  {condition ?? "N/A"}
                                  {typeof temperature === "number" ? `, ${temperature}°` : ""}
                                </span>
                                {rating !== null && (
                                  <div className="flex items-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, index) => (
                                      <Star
                                        key={`${entry.id}-star-${index}`}
                                        size={10}
                                        className={index < rating ? "fill-[var(--text)] text-[var(--text)]" : "text-[var(--text-muted)] opacity-30"}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <RetroButton
                              variant="danger"
                              className="p-1.5"
                              onClick={() => handleDelete(entry.id)}
                              disabled={deletingId === entry.id}
                              title="Delete Log"
                            >
                              <Trash2 size={14} />
                            </RetroButton>
                          </div>
                          <div className="mb-4">
                            <p className="font-mono text-xs text-[var(--text-muted)] mb-1">ITEMS WORN:</p>
                            <div className="flex flex-wrap gap-1">
                              {entry.items.map((item) => (
                                <span
                                  key={`${entry.id}-item-${item.id}`}
                                  className="text-[10px] border border-[var(--border)] px-2 py-0.5 bg-[var(--accent-green)] flex items-center gap-1 text-[var(--text)]"
                                >
                                  <Tag size={8} /> {item.name}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="mt-auto pt-3 border-t-2 border-[var(--border)] border-dashed flex justify-end gap-3">
                            <RetroButton className="flex items-center gap-2 text-xs py-1.5" variant="primary" onClick={handleWearAgain}>
                              <RotateCcw size={12} /> WEAR THIS AGAIN
                            </RetroButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </RetroWindow>
      </div>
    </div>
  );
}
