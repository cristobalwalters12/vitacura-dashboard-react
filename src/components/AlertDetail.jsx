import { SEVERITY } from "../config/dashboard.js";
import {
  categoryInfo,
  formatDate,
  humanize,
} from "../utils/formatters.js";

export default function AlertDetail({ alert, onClose }) {
  if (!alert) return null;
  const category = categoryInfo(alert.categoria);

  return (
    <div className="detail-backdrop" onClick={onClose}>
      <aside
        className="detail-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="close-detail"
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
        >
          ×
        </button>
        <span className="eyebrow">{alert.codigo}</span>
        <h2>{category.label}</h2>
        <div className="detail-status">
          <span style={{ backgroundColor: category.color }} />
          {SEVERITY[alert.severidad] ?? alert.severidad} · {alert.prioridad}
        </div>
        <dl>
          <div>
            <dt>Fecha</dt>
            <dd>{formatDate.format(new Date(alert.fecha))}</dd>
          </div>
          <div>
            <dt>Ubicación</dt>
            <dd>
              {alert.calle}, {alert.zonaNombre}
            </dd>
          </div>
          <div>
            <dt>Activación</dt>
            <dd>
              {humanize(alert.canal)} · {humanize(alert.metodo)}
            </dd>
          </div>
          <div>
            <dt>Clasificación</dt>
            <dd>
              {humanize(alert.tipo)} ({Math.round((alert.confianza ?? 0) * 100)}%)
            </dd>
          </div>
          <div>
            <dt>Primera respuesta</dt>
            <dd>
              {alert.respuestaSegundos
                ? `${alert.respuestaSegundos} segundos`
                : "Sin registro"}
            </dd>
          </div>
          <div>
            <dt>Resultado</dt>
            <dd>{humanize(alert.resultado, "En seguimiento")}</dd>
          </div>
        </dl>
        <p className="privacy-note">
          Evento completamente sintético. La coordenada corresponde a un punto
          público de la red vial.
        </p>
      </aside>
    </div>
  );
}
