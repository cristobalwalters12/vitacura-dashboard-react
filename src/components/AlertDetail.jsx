import { useEffect, useRef } from "react";
import { SEVERITY } from "../config/dashboard.js";
import {
  categoryInfo,
  formatNumber,
  humanize,
} from "../utils/formatters.js";

const detailDate = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const detailTime = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const RESPONDER_LABELS = {
  seguridad_municipal: "Seguridad municipal",
  centro_salud: "Centro de salud",
  ambulancia: "Ambulancia",
  bomberos: "Bomberos",
  cuidador: "Cuidador",
  red_comunitaria: "Red comunitaria",
};

const REASON_LABELS = {
  critica: "Severidad crítica",
  alta: "Severidad alta",
  media: "Severidad media",
  baja: "Severidad baja",
  escalamiento_requerido: "Escalamiento requerido",
  evaluacion_operacional: "Evaluación operacional",
};

const STATE_LABELS = {
  resuelta: "Resuelta",
  cancelada: "Cancelada",
  falsa_alarma: "Falsa alarma",
  activa: "Activa",
  en_proceso: "En proceso",
};

const CARE_LABELS = {
  dependencia_severa: "Dependencia severa",
  media: "Vulnerabilidad media",
  ninguna: "Sin vulnerabilidad registrada",
  severa: "Severa",
  moderada: "Moderada",
  leve: "Leve",
  riesgo_caida: "Riesgo de caída",
  desorientacion: "Desorientación",
  asistida: "Movilidad asistida",
  independiente: "Movilidad independiente",
};

function label(value, dictionary = {}) {
  if (!value) return "Sin registro";
  const result = dictionary[value] ?? humanize(value);
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "Sin registro";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) {
    const minutes = seconds / 60;
    return `${minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)} min`;
  }
  return `${(seconds / 3600).toFixed(1)} h`;
}

function formatTimestamp(value, timeOnly = false) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Sin registro";
  return (timeOnly ? detailTime : detailDate).format(date);
}

function DetailSkeleton() {
  return (
    <div className="detail-skeleton" role="status">
      <span />
      <div className="detail-skeleton-grid">
        <i />
        <i />
        <i />
      </div>
      <span />
      <b />
      <b />
      <b />
      <small>Cargando trazabilidad del caso…</small>
    </div>
  );
}

export default function AlertDetail({
  alert,
  detail,
  loading,
  error,
  onRetry,
  onClose,
  onExploreZone,
}) {
  const closeRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!alert) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    const handleDialogKeys = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [
        ...panelRef.current.querySelectorAll(
          'button:not([disabled]), [href], select:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
  }, [alert, onClose]);

  if (!alert) return null;

  const classification = detail?.clasificacion;
  const identification = detail?.identificacion;
  const category = categoryInfo(
    classification?.categoria ?? alert.categoria,
  );
  const severity = classification?.severidad ?? alert.severidad;
  const priority = detail?.prioridad ?? {
    nivel: alert.prioridad,
    puntaje: alert.puntajePrioridad,
    razones: [],
  };
  const notifications = detail?.notificaciones;
  const care = detail?.persona_afectada?.cuidado;
  const device = detail?.activacion?.dispositivo;
  const lastStage = detail?.operacion?.etapas?.at(-1);

  return (
    <div className="detail-backdrop" onMouseDown={onClose}>
      <aside
        ref={panelRef}
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-detail-title"
        aria-describedby="alert-detail-context"
        aria-busy={loading}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="detail-header">
          <button
            ref={closeRef}
            className="close-detail"
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            ×
          </button>
          <div className="detail-kicker-row">
            <span className="eyebrow">
              {identification?.codigo ?? alert.codigo}
            </span>
            <span className="synthetic-detail-badge">Caso sintético</span>
          </div>
          <h2 id="alert-detail-title">{category.label}</h2>
          <div className="detail-status-row">
            <span style={{ "--status-color": category.color }}>
              <i /> {SEVERITY[severity] ?? label(severity)}
            </span>
            <b>{priority.nivel ?? "—"}</b>
            <em>
              {label(identification?.estado ?? alert.estado, STATE_LABELS)}
            </em>
          </div>
          <p className="detail-location-line" id="alert-detail-context">
            <span>⌖</span>
            {detail?.ubicacion
              ? `${detail.ubicacion.calle} · ${detail.ubicacion.zona_nombre}`
              : `${alert.calle} · ${alert.zonaNombre}`}
          </p>
          <small>
            {formatTimestamp(identification?.creado_en ?? alert.fecha)}
          </small>
        </header>

        {loading && <DetailSkeleton />}

        {error && !loading && (
          <div className="detail-error" role="alert">
            <span>!</span>
            <strong>No fue posible cargar la trazabilidad</strong>
            <p>{error.message}</p>
            <button type="button" onClick={onRetry}>
              Reintentar
            </button>
          </div>
        )}

        {detail && !loading && (
          <div className="detail-content">
            <section className="detail-snapshot" aria-label="Resumen del caso">
              <div>
                <span>Puntaje de prioridad</span>
                <strong>{priority.puntaje ?? "—"}</strong>
                <i>
                  <em style={{ width: `${priority.puntaje ?? 0}%` }} />
                </i>
              </div>
              <div>
                <span>Canal</span>
                <strong>{label(detail.activacion.canal)}</strong>
                <small>{label(detail.activacion.metodo)}</small>
              </div>
              <div>
                <span>Respondedor</span>
                <strong>
                  {label(
                    detail.operacion.tipo_respondedor,
                    RESPONDER_LABELS,
                  )}
                </strong>
                <small>
                  {detail.operacion.escalada_centro_emergencia
                    ? "Con escalamiento"
                    : "Gestión local"}
                </small>
              </div>
            </section>

            <section className="detail-section">
              <div className="detail-section-heading">
                <div>
                  <span className="eyebrow">Trazabilidad individual</span>
                  <h3>Línea de tiempo del incidente</h3>
                </div>
                <small>
                  {formatDuration(lastStage?.segundos_acumulados)} total
                </small>
              </div>
              <ol className="incident-timeline">
                {detail.operacion.etapas.map((stage) => (
                  <li key={stage.id} className={`timeline-${stage.estado}`}>
                    <span>{stage.estado === "completada" ? "✓" : "·"}</span>
                    <div>
                      <strong>{stage.nombre}</strong>
                      <small>{formatTimestamp(stage.fecha, true)}</small>
                    </div>
                    <b>
                      {stage.id === "activacion"
                        ? "Inicio"
                        : `+${formatDuration(stage.segundos_acumulados)}`}
                    </b>
                  </li>
                ))}
              </ol>
            </section>

            <section className="detail-section ai-explanation">
              <div className="detail-section-heading">
                <div>
                  <span className="eyebrow">Explicabilidad</span>
                  <h3>Decisión del modelo</h3>
                </div>
                <span
                  className={`decision-mode ${classification.requiere_revision ? "review" : "automatic"}`}
                >
                  {classification.requiere_revision
                    ? "Revisión humana"
                    : "Automática"}
                </span>
              </div>
              <div className="confidence-detail">
                <div>
                  <strong>
                    {Math.round((classification.confianza ?? 0) * 100)}%
                  </strong>
                  <span>confianza {classification.nivel_confianza}</span>
                </div>
                <i>
                  <em
                    style={{
                      width: `${(classification.confianza ?? 0) * 100}%`,
                    }}
                  />
                </i>
              </div>
              <div className="model-facts">
                <div>
                  <span>Clasificación</span>
                  <strong>{label(classification.tipo)}</strong>
                </div>
                <div>
                  <span>Modelo</span>
                  <strong>{classification.modelo.nombre}</strong>
                  <small>v{classification.modelo.version}</small>
                </div>
                <div>
                  <span>Latencia</span>
                  <strong>{classification.modelo.latencia_ms} ms</strong>
                </div>
              </div>
              <div className="priority-reasons">
                <span>Factores de prioridad</span>
                <div>
                  {priority.razones.map((reason) => (
                    <b key={reason}>{label(reason, REASON_LABELS)}</b>
                  ))}
                </div>
              </div>
              <blockquote>
                <span>Transcripción anonimizada · evidencia simulada</span>
                “{classification.transcripcion.texto_anonimizado}”
                <small>
                  {classification.transcripcion.contiene_datos_sensibles
                    ? "Marcada para protección adicional"
                    : "Sin datos sensibles detectados"}
                </small>
              </blockquote>
            </section>

            <div className="detail-two-columns">
              <section className="detail-section compact-detail-section">
                <div className="detail-section-heading">
                  <div>
                    <span className="eyebrow">Movilización</span>
                    <h3>Tramos de respuesta</h3>
                  </div>
                </div>
                <dl className="response-segments">
                  <div>
                    <dt>Confirmación → despacho</dt>
                    <dd>
                      {formatDuration(
                        detail.operacion.segmentos.confirmacion_a_despacho,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Despacho → llegada</dt>
                    <dd>
                      {formatDuration(
                        detail.operacion.segmentos.despacho_a_llegada,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Llegada → resolución</dt>
                    <dd>
                      {formatDuration(
                        detail.operacion.segmentos.llegada_a_resolucion,
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="detail-section compact-detail-section">
                <div className="detail-section-heading">
                  <div>
                    <span className="eyebrow">Alcance comunitario</span>
                    <h3>Notificaciones</h3>
                  </div>
                </div>
                <div className="notification-detail">
                  <div>
                    <strong>
                      {Math.round((notifications.tasa_entrega ?? 0) * 100)}%
                    </strong>
                    <span>entrega</span>
                    <small>
                      {formatNumber.format(notifications.entregadas)} de {" "}
                      {formatNumber.format(notifications.usuarios_notificados)}
                    </small>
                  </div>
                  <div>
                    <strong>
                      {Math.round(
                        (notifications.tasa_confirmacion ?? 0) * 100,
                      )}%
                    </strong>
                    <span>confirmación</span>
                    <small>
                      {formatNumber.format(notifications.confirmadas)} respuestas
                    </small>
                  </div>
                </div>
              </section>
            </div>

            {device && (
              <section className="detail-section device-detail">
                <div className="detail-section-heading">
                  <div>
                    <span className="eyebrow">Origen conectado</span>
                    <h3>Dispositivo de activación</h3>
                  </div>
                  <span className={`device-state device-${device.estado}`}>
                    {label(device.estado)}
                  </span>
                </div>
                <div className="device-facts">
                  <div>
                    <span>Equipo</span>
                    <strong>{device.modelo}</strong>
                    <small>{device.fabricante}</small>
                  </div>
                  <div>
                    <span>Batería</span>
                    <strong>{device.bateria ?? "—"}%</strong>
                  </div>
                  <div>
                    <span>Conectividad</span>
                    <strong>{label(device.conectividad)}</strong>
                    <small>
                      Señal {device.intensidad_senal ?? "—"}%
                    </small>
                  </div>
                  <div>
                    <span>Firmware</span>
                    <strong>{device.version_firmware}</strong>
                  </div>
                </div>
              </section>
            )}

            {(care || detail.persona_afectada.nivel_vulnerabilidad !== "ninguna") && (
              <section className="detail-section care-detail-section">
                <div className="detail-section-heading">
                  <div>
                    <span className="eyebrow">Protección diferenciada</span>
                    <h3>Contexto de cuidado</h3>
                  </div>
                  <span className="care-detail-badge">Datos minimizados</span>
                </div>
                <div className="care-detail-grid">
                  <div>
                    <span>Vulnerabilidad</span>
                    <strong>
                      {label(
                        detail.persona_afectada.nivel_vulnerabilidad,
                        CARE_LABELS,
                      )}
                    </strong>
                  </div>
                  {care && (
                    <>
                      <div>
                        <span>Dependencia</span>
                        <strong>
                          {label(care.nivel_dependencia, CARE_LABELS)}
                        </strong>
                      </div>
                      <div>
                        <span>Movilidad</span>
                        <strong>{label(care.movilidad, CARE_LABELS)}</strong>
                      </div>
                      <div>
                        <span>Vive solo</span>
                        <strong>{care.vive_solo ? "Sí" : "No"}</strong>
                      </div>
                    </>
                  )}
                </div>
                {care?.factores_riesgo?.length > 0 && (
                  <div className="care-risk-tags">
                    {care.factores_riesgo.map((risk) => (
                      <span key={risk}>{label(risk, CARE_LABELS)}</span>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="resolution-detail">
              <span>Resultado final</span>
              <div>
                <strong>{label(detail.resolucion.resultado)}</strong>
                <small>
                  Cerrada {formatTimestamp(detail.resolucion.resuelto_en)}
                </small>
              </div>
              <i>✓</i>
            </section>

            <div className="detail-actions">
              <button
                type="button"
                onClick={() => onExploreZone(detail.ubicacion.zona)}
              >
                Analizar zona {detail.ubicacion.zona} <span>→</span>
              </button>
              <small>{detail.metadata.privacidad}</small>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
