import { useMemo } from "react";
import EChart from "./EChart.jsx";

const numberFormat = new Intl.NumberFormat("es-CL");

function formatDuration(seconds) {
  const value = Number(seconds) || 0;
  if (value < 60) return `${Math.round(value)} s`;
  if (value < 3600) {
    const minutes = value / 60;
    return `${minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)} min`;
  }
  return `${(value / 3600).toFixed(1)} h`;
}

const RESPONDER_LABELS = {
  seguridad_municipal: "Seguridad municipal",
  ambulancia: "Ambulancia",
  centro_salud: "Centro de salud",
  bomberos: "Bomberos",
  red_comunitaria: "Red comunitaria",
  cuidador: "Cuidador",
};

export default function OperationalJourney({ analytics }) {
  const response = analytics?.respuesta;
  const stages = response?.etapas ?? [];
  const zones = response?.zonas ?? [];
  const notifications = response?.notificaciones ?? {};
  const responders = response?.respondedores ?? [];
  const summary = response?.resumen ?? {};

  const zoneOption = useMemo(() => {
    const selected = zones.slice(0, 6).reverse();
    return {
      animationDurationUpdate: 450,
      grid: { left: 88, right: 20, top: 12, bottom: 28 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const item = params[0];
          return `${item.name}<br><strong>${formatDuration(item.value)}</strong> hasta llegada`;
        },
      },
      xAxis: {
        type: "value",
        axisLabel: {
          color: "#71859c",
          fontSize: 9,
          formatter: (value) => formatDuration(value),
        },
        splitLine: { lineStyle: { color: "rgba(127,145,168,.1)" } },
      },
      yAxis: {
        type: "category",
        data: selected.map((zone) => zone.codigo),
        axisLabel: { color: "#9fb0c3", fontSize: 9 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar",
          barWidth: 10,
          data: selected.map((zone, index) => ({
            value: zone.llegada,
            itemStyle: {
              color:
                index === selected.length - 1 ? "#ffb84d" : "#4b86c8",
              borderRadius: [0, 5, 5, 0],
            },
          })),
          markLine: {
            silent: true,
            symbol: "none",
            label: {
              formatter: "Comuna",
              color: "#8fa1b7",
              fontSize: 8,
            },
            lineStyle: { color: "#39d4c5", type: "dashed", width: 1 },
            data: [{ xAxis: summary.mediana_llegada ?? 0 }],
          },
        },
      ],
    };
  }, [summary.mediana_llegada, zones]);

  if (!response) return null;

  return (
    <section className="operations-card" id="operacion">
      <div className="section-heading operations-heading">
        <div>
          <span className="eyebrow">Trazabilidad de punta a punta</span>
          <h2>Recorrido operacional de una alerta</h2>
        </div>
        <div className="operations-headline">
          <span>Mediana hasta llegada</span>
          <strong>{formatDuration(summary.mediana_llegada)}</strong>
        </div>
      </div>

      <div className="journey-track" aria-label="Tiempos acumulados del proceso">
        {stages.map((stage, index) => (
          <article className="journey-stage" key={stage.id}>
            <div className="journey-stage-top">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <i aria-hidden="true" />
            </div>
            <strong>{stage.nombre}</strong>
            <b>{formatDuration(stage.mediana_segundos)}</b>
            <small>P90 · {formatDuration(stage.p90_segundos)}</small>
          </article>
        ))}
      </div>
      <p className="journey-caption">
        Tiempo acumulado desde la activación. P90 representa el umbral bajo el
        cual se completa el 90% de los casos.
      </p>

      <div className="operations-detail-grid">
        <article className="operations-subpanel">
          <div className="subpanel-heading">
            <div>
              <span className="eyebrow">Presión territorial</span>
              <h3>Tiempo hasta llegada por zona</h3>
            </div>
            <span>6 zonas con mayor demora</span>
          </div>
          <EChart
            option={zoneOption}
            className="operations-zone-chart"
            ariaLabel="Comparación de tiempo mediano hasta llegada por zona"
          />
        </article>

        <aside className="operations-pulse">
          <span className="eyebrow">Capacidad de movilización</span>
          <h3>Red de respuesta</h3>
          <div className="notification-rates">
            <div>
              <span>Entrega</span>
              <strong>{Math.round((notifications.tasa_entrega ?? 0) * 100)}%</strong>
              <small>
                {numberFormat.format(notifications.entregadas ?? 0)} mensajes
              </small>
            </div>
            <div>
              <span>Confirmación</span>
              <strong>
                {Math.round((notifications.tasa_confirmacion ?? 0) * 100)}%
              </strong>
              <small>
                {numberFormat.format(notifications.confirmadas ?? 0)} respuestas
              </small>
            </div>
          </div>
          <div className="responder-list">
            {responders.slice(0, 4).map((responder) => (
              <div key={responder.tipo}>
                <span>{RESPONDER_LABELS[responder.tipo] ?? responder.tipo}</span>
                <b>{numberFormat.format(responder.total)}</b>
                <small>{formatDuration(responder.llegada_mediana)}</small>
              </div>
            ))}
          </div>
          <p>
            <i /> El tiempo de llegada mide el proceso completo desde la
            activación, no solo el traslado del equipo.
          </p>
        </aside>
      </div>
    </section>
  );
}
