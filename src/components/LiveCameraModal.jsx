import { useEffect, useRef, useState } from "react";

const STATUS = {
  connecting: "Conectando",
  live: "En vivo",
  error: "Sin señal",
};

export function LiveCameraPlayer({ streamUrl }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    let cancelled = false;
    let hls;

    const fail = (message) => {
      if (cancelled) return;
      setStatus("error");
      setError(message);
    };
    const play = async () => {
      try {
        await video.play();
      } catch {
        // Los controles permiten iniciar manualmente si el autoplay es bloqueado.
      }
      if (!cancelled) {
        setStatus("live");
        setError(null);
      }
    };
    const connect = async () => {
      setStatus("connecting");
      setError(null);
      if (!streamUrl) {
        fail("No se configuró la URL HLS de la cámara.");
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (Hls.isSupported()) {
        hls = new Hls({
          lowLatencyMode: true,
          backBufferLength: 30,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 6,
        });
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(streamUrl));
        hls.on(Hls.Events.MANIFEST_PARSED, play);
        hls.on(Hls.Events.ERROR, (_event, details) => {
          if (details.fatal) {
            fail("No fue posible recibir la señal. Verifica el gateway de cámara.");
          }
        });
        hls.attachMedia(video);
        return;
      }
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.addEventListener("loadedmetadata", play, { once: true });
        video.addEventListener(
          "error",
          () => fail("No fue posible abrir la señal de la cámara."),
          { once: true },
        );
        return;
      }
      fail("Este navegador no admite reproducción HLS.");
    };

    connect().catch(() =>
      fail("No fue posible inicializar el reproductor de la cámara."),
    );
    return () => {
      cancelled = true;
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [attempt, streamUrl]);

  return (
    <div className="inline-camera-player">
      <div className={`camera-status camera-status-${status}`} aria-live="polite">
        <i /> {STATUS[status]}
      </div>
      <div className="camera-stage">
        <video
          ref={videoRef}
          className="camera-video"
          controls
          muted
          autoPlay
          playsInline
          aria-label="Transmisión de la cámara asociada a la alerta"
        />
        {status === "connecting" && (
          <div className="camera-overlay" role="status">
            <span className="camera-loader" />
            <strong>Conectando con la cámara</strong>
            <small>La primera imagen puede tardar algunos segundos.</small>
          </div>
        )}
        {status === "error" && (
          <div className="camera-overlay camera-overlay-error" role="alert">
            <span>!</span>
            <strong>Señal no disponible</strong>
            <small>{error}</small>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>
              Reintentar conexión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveCameraModal({ streamUrl, alert, onClose }) {
  const videoRef = useRef(null);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    const handleDialogKeys = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll(
          'button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleDialogKeys);
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeys);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [onClose]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    let cancelled = false;
    let hls;

    const fail = (message) => {
      if (cancelled) return;
      setStatus("error");
      setError(message);
    };
    const play = async () => {
      try {
        await video.play();
        if (!cancelled) {
          setStatus("live");
          setError(null);
        }
      } catch {
        if (!cancelled) setStatus("live");
      }
    };
    const connect = async () => {
      setStatus("connecting");
      setError(null);
      if (!streamUrl) {
        fail("No se configuró la URL HLS de la cámara.");
        return;
      }

      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (Hls.isSupported()) {
        hls = new Hls({
          lowLatencyMode: true,
          backBufferLength: 30,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 6,
        });
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(streamUrl));
        hls.on(Hls.Events.MANIFEST_PARSED, play);
        hls.on(Hls.Events.ERROR, (_event, details) => {
          if (!details.fatal) return;
          fail("No fue posible recibir la señal. Verifica el gateway de cámara.");
        });
        hls.attachMedia(video);
        return;
      }

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.addEventListener("loadedmetadata", play, { once: true });
        video.addEventListener(
          "error",
          () => fail("No fue posible abrir la señal de la cámara."),
          { once: true },
        );
        return;
      }

      fail("Este navegador no admite reproducción HLS.");
    };

    connect().catch(() =>
      fail("No fue posible inicializar el reproductor de la cámara."),
    );
    return () => {
      cancelled = true;
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [attempt, streamUrl]);

  return (
    <div className="camera-backdrop" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="camera-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-modal-title"
        aria-describedby="camera-modal-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="camera-modal-header">
          <div>
            <span className="camera-kicker">Alerta {alert?.codigo ?? "operacional"}</span>
            <h2 id="camera-modal-title">Cámara en vivo</h2>
            <p id="camera-modal-description">
              {alert?.persona?.nombre ?? "Señal operacional"} · Stream 2
            </p>
          </div>
          <div className={`camera-status camera-status-${status}`} aria-live="polite">
            <i />
            {STATUS[status]}
          </div>
          <button
            ref={closeRef}
            className="camera-close"
            type="button"
            onClick={onClose}
            aria-label="Cerrar cámara en vivo"
          >
            ×
          </button>
        </header>

        <div className="camera-stage">
          <video
            ref={videoRef}
            className="camera-video"
            controls
            muted
            autoPlay
            playsInline
            aria-label="Transmisión de la cámara Stream 2"
          />
          {status === "connecting" && (
            <div className="camera-overlay" role="status">
              <span className="camera-loader" />
              <strong>Conectando con la cámara</strong>
              <small>La primera imagen puede tardar algunos segundos.</small>
            </div>
          )}
          {status === "error" && (
            <div className="camera-overlay camera-overlay-error" role="alert">
              <span>!</span>
              <strong>Señal no disponible</strong>
              <small>{error}</small>
              <button type="button" onClick={() => setAttempt((value) => value + 1)}>
                Reintentar conexión
              </button>
            </div>
          )}
        </div>

        <footer className="camera-modal-footer">
          <span><i /> Transmisión en tiempo real</span>
          <small>El video se desconecta automáticamente al cerrar esta ventana.</small>
        </footer>
      </section>
    </div>
  );
}
