"use client";

import { useEffect } from "react";
import { RetroWindow, RetroButton } from "@/components/retro-ui";
import { ShieldAlert } from "lucide-react";

/**
 * Route-level error boundary: renders instead of the Next.js
 * "Application error" page when a route throws during render.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <RetroWindow title="RUNTIME_ERROR.SYS" icon={<ShieldAlert size={14} />}>
          <div className="flex flex-col gap-4 py-4">
            <p className="font-black text-2xl tracking-tighter">SOMETHING CRASHED</p>
            <p className="font-mono text-xs leading-relaxed break-words">
              {error.message || "An unexpected error occurred."}
            </p>
            <div className="flex gap-2">
              <RetroButton onClick={reset} className="flex-1 text-xs">
                RETRY
              </RetroButton>
              <RetroButton
                variant="neutral"
                onClick={() => (window.location.href = "/")}
                className="flex-1 text-xs"
              >
                GO HOME
              </RetroButton>
            </div>
          </div>
        </RetroWindow>
      </div>
    </div>
  );
}
