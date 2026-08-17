import { useEffect, useRef } from "react";
import { CATEGORY } from "../config/dashboard.js";

const CRITICALITY = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const STATUS = {
  nueva: "Nueva",
  revisando: "Revisada",
  atendida: "Atendida",
  cerrada: "Cerrada",
};

function AlertCameraIndicator() {
  return (
    <span className="operational-camera-indicator" title="Cámara disponible">
      <i /> Cámara
    </span>
  );
}

export function OperationalQueueButton({ alerts, connected, onClick }) {
  const pending = alerts.filter((alert) => alert.estado === "nueva").length;
  return (
    <button
      className="operational-queue-button"
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={`Abrir cola de alertas, ${pending} nuevas`}
    >
      <span className="operational-bell" aria-hidden="true">!</span>
      <span>
        <strong>Cola de alertas</strong>
        <small>{connected ? "Recepción en tiempo real" : "Reconectando…"}</small>
      </span>
      <b>{pending}</b>
    </button>
  );
}

export function NewOperationalAlert({
  alert,
  busy,
  error,
  onReview,
  onDismiss,
}) {
  if (!alert) return null;
  return (
    <aside className={`new-alert-toast criticality-${alert.criticidad}`} role="alert">
      <div className="new-alert-signal"><i /></div>
      <div className="new-alert-copy">
        <span>Nueva alerta recibida</span>
        <strong>{CRITICALITY[alert.criticidad] ?? alert.criticidad}</strong>
        <p>{alert.transcripcion.texto}</p>
        <small>{alert.persona.nombre} · {alert.codigo}</small>
      </div>
      {alert.camara && <AlertCameraIndicator />}
      <div className="new-alert-actions">
        <button type="button" onClick={onReview} disabled={busy}>
          {busy ? "Calculando ruta…" : "Revisar alerta"}
        </button>
        <button type="button" onClick={onDismiss}>Descartar aviso</button>
      </div>
      {error && <p className="operational-open-error" role="alert">{error}</p>}
    </aside>
  );
}

export function OperationalAlertQueue({
  alerts,
  loading,
  error,
  connected,
  openingId,
  openError,
  onSelect,
  onRetry,
  onClose,
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    const handleKeys = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [
        ...panelRef.current.querySelectorAll(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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
    document.addEventListener("keydown", handleKeys);
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeys);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="operational-queue-backdrop" onMouseDown={onClose}>
      <aside
        ref={panelRef}
        className="operational-queue-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operational-queue-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">Centro operacional</span>
            <h2 id="operational-queue-title">Cola de alertas</h2>
            <small><i className={connected ? "connected" : ""} /> {connected ? "Atlas conectado en tiempo real" : "Reconectando con Atlas"}</small>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar cola">×</button>
        </header>
        <div className="operational-queue-summary">
          <div><strong>{alerts.filter((alert) => alert.estado === "nueva").length}</strong><span>Nuevas</span></div>
          <div><strong>{alerts.filter((alert) => alert.criticidad === "critica").length}</strong><span>Críticas</span></div>
          <div><strong>{alerts.filter((alert) => alert.camara).length}</strong><span>Con cámara</span></div>
        </div>
        <div className="operational-queue-list">
          {openError && (
            <p className="operational-open-error" role="alert">{openError}</p>
          )}
          {loading && <p className="operational-empty">Cargando alertas operativas…</p>}
          {error && (
            <div className="operational-empty">
              <p>No fue posible consultar la cola.</p>
              <button type="button" onClick={onRetry}>Reintentar</button>
            </div>
          )}
          {!loading && !error && alerts.length === 0 && (
            <p className="operational-empty">No hay alertas recibidas.</p>
          )}
          {alerts.map((alert) => {
            const category = CATEGORY[alert.categoria] ?? CATEGORY.sin_clasificar;
            return (
              <button
                key={alert.id}
                className={`operational-queue-item criticality-${alert.criticidad}`}
                type="button"
                disabled={openingId === alert.id}
                onClick={() => onSelect(alert)}
              >
                <span className="queue-item-color" style={{ backgroundColor: category.color }} />
                <span className="queue-item-copy">
                  <span>{alert.codigo} · {category.label}</span>
                  <strong>{alert.persona.nombre}</strong>
                  <p>{alert.transcripcion.texto}</p>
                  <small>{alert.ubicacion.direccion_referencia}</small>
                </span>
                <span className="queue-item-side">
                  <b>
                    {openingId === alert.id
                      ? "Calculando ruta…"
                      : CRITICALITY[alert.criticidad] ?? alert.criticidad}
                  </b>
                  <em className={`queue-status queue-status-${alert.estado}`}>
                    {STATUS[alert.estado] ?? alert.estado}
                  </em>
                  {alert.camara && <AlertCameraIndicator />}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
