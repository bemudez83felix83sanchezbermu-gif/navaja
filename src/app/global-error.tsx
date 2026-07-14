"use client";

/**
 * Last-resort error boundary — catches errors in the root layout itself, so it
 * must render its own <html>/<body>. Intentionally minimal and dependency-free.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#faf9f7",
          color: "#0c0a09",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Algo salió mal</h1>
          <p style={{ marginTop: "0.5rem", color: "#78716c" }}>
            Ocurrió un error inesperado.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              height: 44,
              padding: "0 1.25rem",
              borderRadius: 12,
              background: "#a16207",
              color: "#fff",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
