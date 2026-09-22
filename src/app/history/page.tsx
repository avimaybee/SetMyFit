"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Calendar, Star, Tag, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { IClothingItem } from "@/lib/types";
import { RetroButton, RetroWindow, RetroImage } from "@/components/retro-ui";
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const router = useRouter();

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await apiFetch("/api/outfits/history?limit=60", { cache: "no-store" });
      if (res.status === 401) {
        toast.error("Your session timed out. Log back in real quick.");
        router.push('/auth/sign-in');
        return;
      }
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload?.error || "Failed to load outfit history");
      }
      setHistory(payload.data as OutfitHistoryEntry[]);
    } catch (error) {
      console.error("Failed to load outfit history", error);
      setLoadFailed(true);
      toast.error("Couldn't pull up your fit history. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = useCallback(async (id: number) => {
    setPendingDeleteId(null);
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/outfits/${id}`, { method: "DELETE" });
      if (res.status === 401) {
        toast.error("Your session timed out. Log back in real quick.");
        router.push('/auth/sign-in');
        return;
      }
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload?.error || "Failed to delete log");
      }
      setHistory(prev => prev.filter(entry => entry.id !== id));
      toast.success("Removed that fit from your history.");
    } catch (error) {
      console.error("Failed to delete history entry", error);
      toast.error("Couldn't delete that log. Try once more.");
    } finally {
      setDeletingId(null);
    }
  }, [router]);

  return (
    <div className="h-full p-4 md:p-8 overflow-y-auto bg-[var(--bg-main)] min-h-screen text-[var(--text)]">
      <h1 className="sr-only">Outfit history</h1>
      <div className="max-w-5xl mx-auto space-y-6">
          <RetroWindow title="OUTFIT HISTORY" icon={<Calendar size={14} />} className="h-full">
          {loading ? (
            <div className="py-10">
              <ListSkeleton />
            </div>
          ) : loadFailed && history.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-mono text-sm font-bold">COULDN&apos;T LOAD OUTFIT LOGS</p>
              <p className="font-mono text-xs mt-2 text-[var(--text-muted)]">Check your connection and try again.</p>
              <RetroButton className="mt-4 text-xs" onClick={fetchHistory}>
                RETRY
              </RetroButton>
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center font-mono text-sm text-[var(--text-muted)] flex flex-col items-center gap-2">
              <p className="font-bold text-[var(--text)]">NO OUTFIT LOGS YET</p>
              <p className="text-xs">Generate a fit and tap Log Outfit to start your style history.</p>
              <RetroButton className="mt-3 text-xs" onClick={() => router.push('/')}>
                GO TO GENERATOR
              </RetroButton>
            </div>
          ) : (
            <div className="space-y-10 p-2 md:p-4 pt-6">
              {history.map((entry) => {
                const { condition, temperature } = extractWeatherDetails(entry.weather_data);
                const previewItems = entry.items.slice(0, 4);
                const remainingCount = Math.max(entry.items.length - previewItems.length, 0);
                const rating = typeof entry.feedback === "number" ? Math.max(0, Math.min(5, entry.feedback)) : null;

                return (
                  <article
                    key={entry.id}
                    className="bg-[var(--bg-secondary)] border-2 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] md:shadow-[6px_6px_0px_0px_var(--border)] p-1 relative group hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--border)] md:hover:shadow-[8px_8px_0px_0px_var(--border)] transition-all duration-200 mt-4"
                  >
                    <div className="absolute -top-6 left-4 bg-[var(--accent-pink)] border-2 border-[var(--border)] border-b-0 px-3 py-1">
                      <span className="font-mono font-bold text-xs text-[var(--text)]">{formatDateLabel(entry.outfit_date)}</span>
                    </div>
                    <div className="relative z-10 bg-[var(--bg-secondary)] p-4 border-2 border-transparent">
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-shrink-0 w-full md:w-1/3">
                          <div className="relative grid grid-cols-2 gap-2 bg-[var(--bg-tertiary)] p-2 border-2 border-[var(--border)] border-dashed">
                            {previewItems.map((item) => (
                              <div key={`${entry.id}-${item.id}`} className="aspect-square relative overflow-hidden">
                                <RetroImage
                                  src={item.image_url}
                                  alt={item.name}
                                  containerClassName="absolute inset-0 border border-[var(--border)]"
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
                              <h3 className="font-black text-lg uppercase text-[var(--text)]">ENTRY #{entry.id}</h3>
                              <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                                <span className="bg-[var(--accent-yellow)] px-2 py-0.5 border border-[var(--border)] text-[var(--text)] font-bold">
                                  {condition ?? "N/A"}
                                  {typeof temperature === "number" ? `, ${temperature}°C` : ""}
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
                              className="w-9 h-9 min-h-[36px] flex items-center justify-center p-0"
                              onClick={() => setPendingDeleteId(entry.id)}
                              disabled={deletingId === entry.id}
                              title="Delete outfit entry"
                              aria-label={`Delete outfit entry ${entry.id}`}
                            >
                              <Trash2 size={15} />
                            </RetroButton>
                          </div>
                          <div>
                            <p className="font-mono text-xs text-[var(--text-muted)] mb-1">ITEMS WORN:</p>
                            <div className="flex flex-wrap gap-1">
                              {entry.items.slice(0, 8).map((item) => (
                                <span
                                  key={`${entry.id}-item-${item.id}`}
                                  className="text-[10px] border border-[var(--border)] px-2 py-0.5 bg-[var(--accent-green)] flex items-center gap-1 text-[var(--text)] max-w-full"
                                >
                                  <Tag size={8} className="shrink-0" /> <span className="truncate">{item.name}</span>
                                </span>
                              ))}
                              {entry.items.length > 8 && (
                                <span className="text-[10px] border border-[var(--border)] px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text)]">
                                  +{entry.items.length - 8} MORE
                                </span>
                              )}
                            </div>
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

      {/* Delete confirmation */}
      {pendingDeleteId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="max-w-sm w-full">
            <RetroWindow title="CONFIRM REMOVAL" icon={<Trash2 size={14} />}>
              <div className="p-2 text-center">
                <p className="font-mono text-sm font-bold">REMOVE THIS OUTFIT LOG?</p>
                <p className="font-mono text-xs mt-2 text-[var(--text-muted)]">This cannot be undone.</p>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <RetroButton
                    variant="neutral"
                    className="text-xs"
                    onClick={() => setPendingDeleteId(null)}
                  >
                    CANCEL
                  </RetroButton>
                  <RetroButton
                    variant="danger"
                    className="text-xs"
                    onClick={() => handleDelete(pendingDeleteId)}
                  >
                    REMOVE
                  </RetroButton>
                </div>
              </div>
            </RetroWindow>
          </div>
        </div>
      )}
    </div>
  );
}
