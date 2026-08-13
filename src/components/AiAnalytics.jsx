import { useMemo } from "react";
import EChart from "./EChart.jsx";
import { categoryInfo } from "../utils/formatters.js";

const numberFormat = new Intl.NumberFormat("es-CL");

function confidenceLabel(value) {
  const labels = {
    0: "< 60%",
    0.6: "60–70%",
    0.7: "70–78%",
    0.78: "78–85%",
    0.85: "85–92%",
    0.92: "> 92%",
  };
  return labels[value] ?? `${Math.round(Number(value) * 100)}%`;
}

export default function AiAnalytics({ analytics }) {
  const ai = analytics?.ia;
  const summary = ai?.resumen ?? {};
  const categories = ai?.categorias ?? [];
  const distribution = ai?.distribucion_confianza ?? [];
  const score = ai?.salud?.puntaje ?? 0;

  const categoryOption = useMemo(() => {
    const selected = categories.slice(0, 6).reverse();
    return {
      grid: { left: 96, right: 34, top: 12, bottom: 24 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const item = params[0];
          const source = selected[item.dataIndex];
          return `${categoryInfo(source.categoria).label}<br><strong>${Math.round(source.tasa_revision * 100)}%</strong> revisión humana<br>${Math.round(source.confianza_media * 100)}% confianza media`;
        },
      },
      xAxis: {
        type: "value",
        max: 1,
        axisLabel: {
          color: "#71859c",
          fontSize: 9,
          formatter: (value) => `${Math.round(value * 100)}%`,
        },
        splitLine: { lineStyle: { color: "rgba(127,145,168,.1)" } },
      },
      yAxis: {
        type: "category",
        data: selected.map((item) => categoryInfo(item.categoria).label),
        axisLabel: { color: "#9fb0c3", fontSize: 8.5 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar",
          data: selected.map((item) => ({
            value: item.tasa_revision,
            itemStyle: {
              color:
                item.tasa_revision >= 0.5
                  ? "#ffb84d"
                  : "rgba(157,140,255,.82)",
              borderRadius: [0, 5, 5, 0],
            },
          })),
          barWidth: 9,
        },
      ],
    };
  }, [categories]);

  if (!ai) return null;

  const maxBucket = Math.max(...distribution.map((item) => item.total), 1);

  return (
    <article className="advanced-card ai-card" id="ia">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Observabilidad del modelo</span>
          <h2>Calidad de clasificación IA</h2>
        </div>
        <span className={`health-state health-${ai.salud?.estado}`}>
          {ai.salud?.estado?.replaceAll("_", " ")}
        </span>
      </div>

      <div className="ai-overview">
        <div
          className="health-ring"
          style={{ "--health-score": `${score * 3.6}deg` }}
          aria-label={`Índice de salud IA ${score} de 100`}
        >
          <div>
            <strong>{score}</strong>
            <span>/ 100</span>
          </div>
        </div>
        <div className="ai-stat-grid">
          <div>
            <span>Confianza media</span>
            <strong>{Math.round((summary.confianza_media ?? 0) * 100)}%</strong>
          </div>
          <div>
            <span>Automáticas</span>
            <strong>{Math.round((summary.tasa_automatica ?? 0) * 100)}%</strong>
          </div>
          <div>
            <span>Revisión humana</span>
            <strong>{numberFormat.format(summary.revisiones ?? 0)}</strong>
          </div>
          <div>
            <span>Latencia mediana</span>
            <strong>{numberFormat.format(summary.latencia_mediana_ms ?? 0)} ms</strong>
          </div>
        </div>
      </div>

      <div className="advanced-chart-heading">
        <span>Casos derivados a revisión por categoría</span>
        <small>Mayor porcentaje implica más intervención humana</small>
      </div>
      <EChart
        option={categoryOption}
        className="ai-category-chart"
        ariaLabel="Tasa de revisión humana por categoría de clasificación"
      />

      <div className="confidence-strip">
        <div className="advanced-chart-heading">
          <span>Distribución de confianza</span>
          <small>Umbral de revisión: 78%</small>
        </div>
        <div className="confidence-buckets">
          {distribution.map((bucket) => (
            <div key={bucket.desde}>
              <span
                style={{
                  height: `${Math.max(10, (bucket.total / maxBucket) * 100)}%`,
                }}
              />
              <b>{numberFormat.format(bucket.total)}</b>
              <small>{confidenceLabel(bucket.desde)}</small>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
