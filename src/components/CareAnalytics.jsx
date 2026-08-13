import { useMemo } from "react";
import EChart from "./EChart.jsx";

const numberFormat = new Intl.NumberFormat("es-CL");

const DEPENDENCY_LABELS = {
  severa: "Severa",
  moderada: "Moderada",
  leve: "Leve",
  independiente: "Independiente",
};

const RISK_LABELS = {
  caidas: "Riesgo de caídas",
  riesgo_caida: "Riesgo de caída",
  desorientacion: "Desorientación",
  deterioro_cognitivo: "Deterioro cognitivo",
  medicacion_critica: "Medicación crítica",
  aislamiento_social: "Aislamiento social",
  movilidad_reducida: "Movilidad reducida",
};

export default function CareAnalytics({ analytics }) {
  const care = analytics?.cuidado;
  const summary = care?.resumen ?? {};
  const devices = care?.dispositivos ?? {};
  const demand = care?.demanda_horaria ?? [];
  const dependency = care?.dependencia ?? [];
  const risks = care?.riesgos ?? [];
  const vulnerability = care?.vulnerabilidad_respuesta ?? [];

  const hourlyOption = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, hour) => {
      const value = demand.find((item) => item.hora === hour);
      return value ?? { hora: hour, total: 0, respuesta_mediana: 0 };
    });
    const peak = Math.max(...hours.map((item) => item.total), 0);
    return {
      grid: { left: 34, right: 14, top: 16, bottom: 28 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const source = hours[params[0].dataIndex];
          return `${String(source.hora).padStart(2, "0")}:00<br><strong>${source.total} solicitudes</strong><br>${source.respuesta_mediana} s de primera respuesta`;
        },
      },
      xAxis: {
        type: "category",
        data: hours.map((item) => String(item.hora).padStart(2, "0")),
        axisLabel: {
          color: "#71859c",
          fontSize: 8,
          interval: 3,
          formatter: (value) => `${value}h`,
        },
        axisLine: { lineStyle: { color: "rgba(127,145,168,.16)" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#71859c", fontSize: 8 },
        splitLine: { lineStyle: { color: "rgba(127,145,168,.1)" } },
      },
      series: [
        {
          type: "bar",
          barWidth: "52%",
          data: hours.map((item) => ({
            value: item.total,
            itemStyle: {
              color: item.total === peak ? "#ffb84d" : "#39d4c5",
              borderRadius: [4, 4, 0, 0],
            },
          })),
        },
      ],
    };
  }, [demand]);

  if (!care) return null;

  const totalProfiles = summary.total || 1;
  const totalDependency = dependency.reduce((sum, item) => sum + item.total, 0) || 1;
  const severeResponse = vulnerability.find(
    (item) => item.nivel === "dependencia_severa",
  );
  const hasDemand = demand.some((item) => item.total > 0);

  return (
    <article className="advanced-card care-card" id="cuidado">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Protección focalizada</span>
          <h2>Analítica de cuidado</h2>
        </div>
        <span className="care-profile-count">
          <strong>{numberFormat.format(summary.total ?? 0)}</strong> perfiles
        </span>
      </div>

      <div className="care-stat-grid">
        <div>
          <span>Dependencia severa</span>
          <strong>{numberFormat.format(summary.dependencia_severa ?? 0)}</strong>
          <small>{Math.round(((summary.dependencia_severa ?? 0) / totalProfiles) * 100)}% de perfiles</small>
        </div>
        <div>
          <span>Viven solos</span>
          <strong>{numberFormat.format(summary.vive_solo ?? 0)}</strong>
          <small>monitoreo prioritario</small>
        </div>
        <div className={devices.bateria_baja ? "care-stat-warning" : ""}>
          <span>Batería baja</span>
          <strong>{numberFormat.format(devices.bateria_baja ?? 0)}</strong>
          <small>de {numberFormat.format(devices.total ?? 0)} dispositivos</small>
        </div>
        <div>
          <span>Respuesta severa</span>
          <strong>{severeResponse?.respuesta_mediana ?? 0} s</strong>
          <small>{Math.round((severeResponse?.tasa_escalada ?? 0) * 100)}% escalada</small>
        </div>
      </div>

      <div className="advanced-chart-heading">
        <span>Demanda de asistencia por hora</span>
        <small>Solicitudes clasificadas como apoyo a cuidadores</small>
      </div>
      {hasDemand ? (
        <EChart
          option={hourlyOption}
          className="care-hourly-chart"
          ariaLabel="Demanda horaria de asistencia a cuidadores"
        />
      ) : (
        <div className="advanced-empty-state">
          <span>◇</span>
          <strong>Sin solicitudes de cuidado en esta selección</strong>
          <small>
            Amplía el período o cambia la categoría para observar su patrón
            horario.
          </small>
        </div>
      )}

      <div className="care-breakdown-grid">
        <div>
          <div className="advanced-chart-heading">
            <span>Nivel de dependencia</span>
          </div>
          <div className="dependency-bars">
            {dependency.map((item) => (
              <div key={item.nivel}>
                <span>
                  {DEPENDENCY_LABELS[item.nivel] ?? item.nivel}
                  <b>{numberFormat.format(item.total)}</b>
                </span>
                <i>
                  <em
                    style={{ width: `${(item.total / totalDependency) * 100}%` }}
                  />
                </i>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="advanced-chart-heading">
            <span>Factores de riesgo</span>
          </div>
          <div className="risk-list">
            {risks.slice(0, 4).map((item, index) => (
              <span key={item.riesgo}>
                <i>{index + 1}</i>
                {RISK_LABELS[item.riesgo] ?? item.riesgo.replaceAll("_", " ")}
                <b>{numberFormat.format(item.total)}</b>
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
