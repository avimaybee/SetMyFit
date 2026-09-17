"use client";

/**
 * Root error boundary (replaces the blank "Application error" page).
 * Must define its own <html>/<body> and cannot use app layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "monospace", background: "#FFF8E7" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ maxWidth: 480, width: "100%", border: "2px solid black", background: "#fff", boxShadow: "8px 8px 0px 0px #000" }}>
            <div style={{ background: "#FF8E72", borderBottom: "2px solid black", padding: "4px 8px", fontWeight: "bold" }}>
              FATAL_ERROR.SYS
            </div>
            <div style={{ padding: 16 }}>
              <p style={{ fontWeight: 900, fontSize: 24, margin: "0 0 8px" }}>APP CRASHED</p>
              <p style={{ fontSize: 12, wordBreak: "break-word" }}>{error.message || "An unexpected error occurred."}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  onClick={reset}
                  style={{ flex: 1, padding: "8px", fontWeight: "bold", border: "2px solid black", background: "#A0C4FF", cursor: "pointer" }}
                >
                  RETRY
                </button>
                <button
                  onClick={() => (window.location.href = "/")}
                  style={{ flex: 1, padding: "8px", fontWeight: "bold", border: "2px solid black", background: "#fff", cursor: "pointer" }}
                >
                  GO HOME
                </button>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
