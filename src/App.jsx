import { useMemo, useState } from "react";
import AlertDetail from "./components/AlertDetail.jsx";
import DashboardMap from "./components/DashboardMap.jsx";
import EChart from "./components/EChart.jsx";
import KpiCard from "./components/KpiCard.jsx";
import {
  CATEGORY,
  PERIODS,
  PRIORITY_ORDER,
} from "./config/dashboard.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import {
  categoryInfo,
  formatCompact,
  formatDate,
  formatNumber,
  median,
} from "./utils/formatters.js";

function LoadingScreen() {
  return (
    <div className="state-screen" role="status">
      <div className="state-mark">V</div>
      <h1>Cargando inteligencia territorial</h1>
      <p>Preparando alertas, zonas y métricas comunitarias.</p>
      <span className="loading-line" />
    </div>
  );
}

function ErrorScreen({ error, onRetry }) {
  return (
    <div className="state-screen state-error" role="alert">
      <div className="state-mark">!</div>
      <h1>No fue posible cargar el tablero</h1>
      <p>{error?.message ?? "Error desconocido"}</p>
      <button type="button" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

function buildZoneGeoJson(data, filteredAlerts) {
  const counts = new Map();
  for (const alert of filteredAlerts) {
    const zone = counts.get(alert.zona) ?? { alertas: 0, criticas: 0 };
    zone.alertas += 1;
    if (alert.prioridad === "P1") zone.criticas += 1;
    counts.set(alert.zona, zone);
  }

  return {
    type: "FeatureCollection",
    features: data.zonas.features.map((feature) => {
      const values = counts.get(feature.properties.codigo) ?? {
        alertas: 0,
        criticas: 0,
      };
      const users = feature.properties.usuarios ?? 0;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          alertas: values.alertas,
          criticas: values.criticas,
          alertasPorMil: users
            ? Number(((values.alertas / users) * 1000).toFixed(1))
            : 0,
        },
      };
    }),
  };
}

function Dashboard({
  data,
  source,
  period,
  category,
  onPeriodChange,
  onCategoryChange,
}) {
  const [mode, setMode] = useState("calor");
  const [selectedAlert, setSelectedAlert] = useState(null);
  const updatedAtLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CL", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.metadata.actualizadoEn)),
    [data.metadata.actualizadoEn],
  );

  const maximumDate = useMemo(
    () => new Date(data.metadata.periodo.fin),
    [data.metadata.periodo.fin],
  );

  const filteredAlerts = useMemo(() => {
    const cutoff = new Date(maximumDate);
    cutoff.setUTCDate(cutoff.getUTCDate() - period);
    return data.alertas.filter(
      (alert) =>
        new Date(alert.fecha) >= cutoff &&
        (category === "todas" || alert.categoria === category),
    );
  }, [category, data.alertas, maximumDate, period]);

  const filteredZones = useMemo(
    () =>
      data.metricasServidor
        ? data.zonas
        : buildZoneGeoJson(data, filteredAlerts),
    [data, filteredAlerts],
  );

  const metrics = useMemo(() => {
    if (data.metricasServidor) return data.metricasServidor;
    const responses = filteredAlerts
      .map((alert) => alert.respuestaSegundos)
      .filter(Number.isFinite);
    const critical = filteredAlerts.filter(
      (alert) => alert.prioridad === "P1",
    ).length;
    const smartwatch = filteredAlerts.filter(
      (alert) => alert.canal === "reloj_inteligente",
    ).length;
    const escalated = filteredAlerts.filter((alert) => alert.escalada).length;
    const automatic = filteredAlerts.filter(
      (alert) => !alert.requiereRevision,
    ).length;

    return {
      total: filteredAlerts.length,
      critical,
      medianResponse: median(responses),
      sla: responses.length
        ? responses.filter((value) => value <= 300).length / responses.length
        : 0,
      smartwatch: filteredAlerts.length
        ? smartwatch / filteredAlerts.length
        : 0,
      escalated,
      automatic: filteredAlerts.length
        ? automatic / filteredAlerts.length
        : 0,
    };
  }, [data.metricasServidor, filteredAlerts]);

  const trend = useMemo(() => {
    if (data.tendenciaServidor) return data.tendenciaServidor;
    const grouped = new Map();
    for (const alert of filteredAlerts) {
      const date = alert.fecha.slice(0, 10);
      const value = grouped.get(date) ?? { date, total: 0 };
      value.total += 1;
      grouped.set(date, value);
    }
    return [...grouped.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [data.tendenciaServidor, filteredAlerts]);

  const categories = useMemo(() => {
    if (data.categoriasServidor) return data.categoriasServidor;
    const grouped = new Map();
    for (const alert of filteredAlerts) {
      grouped.set(
        alert.categoria,
        (grouped.get(alert.categoria) ?? 0) + 1,
      );
    }
    return [...grouped.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data.categoriasServidor, filteredAlerts]);

  const priorityAlerts = useMemo(
    () =>
      [...filteredAlerts]
        .sort(
          (a, b) =>
            PRIORITY_ORDER[a.prioridad] - PRIORITY_ORDER[b.prioridad] ||
            b.fecha.localeCompare(a.fecha),
        )
        .slice(0, 6),
    [filteredAlerts],
  );

  const zoneRanking = useMemo(() => {
    if (data.metricasServidor) {
      return [...data.estadisticasZonas]
        .sort((a, b) => b.alertasPorMil - a.alertasPorMil)
        .slice(0, 6);
    }
    const grouped = new Map(
      data.estadisticasZonas.map((zone) => [
        zone.codigo,
        { ...zone, alertas: 0, criticas: 0, responses: [] },
      ]),
    );

    for (const alert of filteredAlerts) {
      const zone = grouped.get(alert.zona);
      if (!zone) continue;
      zone.alertas += 1;
      if (alert.prioridad === "P1") zone.criticas += 1;
      if (Number.isFinite(alert.respuestaSegundos)) {
        zone.responses.push(alert.respuestaSegundos);
      }
    }

    return [...grouped.values()]
      .map((zone) => ({
        ...zone,
        alertasPorMil: zone.usuarios
          ? (zone.alertas / zone.usuarios) * 1000
          : 0,
        respuestaMediana: median(zone.responses),
        sla: zone.responses.length
          ? zone.responses.filter((value) => value <= 300).length /
            zone.responses.length
          : 0,
      }))
      .sort((a, b) => b.alertasPorMil - a.alertasPorMil)
      .slice(0, 6);
  }, [data.estadisticasZonas, data.metricasServidor, filteredAlerts]);

  const trendOption = useMemo(
    () => ({
      animationDurationUpdate: 450,
      grid: { left: 46, right: 22, top: 24, bottom: 36 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) => `${value} alertas`,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: trend.map((item) => item.date),
        axisLabel: {
          color: "#7f91a8",
          hideOverlap: true,
          formatter: (value) => value.slice(5),
        },
        axisLine: { lineStyle: { color: "#23354b" } },
      },
      yAxis: {
        type: "value",
        name: "Alertas / día",
        nameTextStyle: { color: "#7f91a8" },
        axisLabel: { color: "#7f91a8" },
        splitLine: { lineStyle: { color: "rgba(127,145,168,.13)" } },
      },
      series: [
        {
          name: "Alertas",
          type: "line",
          data: trend.map((item) => item.total),
          symbol: "none",
          smooth: 0.28,
          lineStyle: { color: "#39d4c5", width: 2.4 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(57,212,197,.35)" },
                { offset: 1, color: "rgba(57,212,197,0)" },
              ],
            },
          },
        },
      ],
    }),
    [trend],
  );

  const categoryOption = useMemo(
    () => ({
      tooltip: {
        trigger: "item",
        formatter: "{b}<br><strong>{c}</strong> ({d}%)",
      },
      legend: {
        bottom: 0,
        left: "center",
        textStyle: { color: "#9aabc0" },
        itemWidth: 10,
        itemHeight: 10,
        formatter: (name) => categoryInfo(name).label,
      },
      series: [
        {
          type: "pie",
          radius: ["47%", "70%"],
          center: ["50%", "42%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "#0d1a2b", borderWidth: 3 },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              formatter: "{d}%",
              color: "#f4f8fb",
              fontSize: 16,
            },
          },
          data: categories.map((item) => ({
            ...item,
            itemStyle: { color: categoryInfo(item.name).color },
          })),
        },
      ],
    }),
    [categories],
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <strong>Vitacura</strong>
            <span>Comunidad Segura</span>
          </div>
        </div>
        <nav aria-label="Secciones del tablero">
          <a className="active" href="#resumen">
            <span>⌂</span>Resumen
          </a>
          <a href="#mapa">
            <span>⌖</span>Mapa territorial
          </a>
          <a href="#tendencia">
            <span>⌁</span>Tendencias
          </a>
          <a href="#zonas">
            <span>◎</span>Zonas
          </a>
        </nav>
        <div className="sidebar-status">
          <span className="status-dot" />
          <div>
            <strong>Sistema operativo</strong>
            <small>Fuente: {source === "api" ? "API" : "snapshot local"}</small>
          </div>
        </div>
        <p className="sidebar-disclaimer">
          Entorno demostrativo
          <br />
          Datos 100% sintéticos
        </p>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">Municipalidad de Vitacura</span>
            <h1>Panorama comunitario</h1>
          </div>
          <div className="topbar-meta">
            <span className="live-badge">
              <i />Monitoreo activo
            </span>
            <span>Actualizado {updatedAtLabel}</span>
          </div>
        </header>

        <div className="synthetic-banner">
          <strong>Demostración con datos simulados</strong>
          <span>
            20.000 incidentes sintéticos sobre coordenadas públicas reales de
            Vitacura.
          </span>
        </div>

        <section className="filters" aria-label="Filtros del tablero">
          <div className="segmented">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={period === item.value ? "selected" : ""}
                onClick={() => onPeriodChange(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label>
            <span>Tipo de alerta</span>
            <select
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
            >
              <option value="todas">Todas las categorías</option>
              {Object.entries(CATEGORY).map(([value, item]) => (
                <option key={value} value={value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="kpi-grid" id="resumen">
          <KpiCard
            label="Personas protegidas"
            value={formatNumber.format(data.resumen.usuariosActivos)}
            detail={`${formatNumber.format(data.resumen.perfilesCuidado)} perfiles de cuidado activos`}
            tone="teal"
            icon="♙"
          />
          <KpiCard
            label="Alertas del período"
            value={formatNumber.format(metrics.total)}
            detail={`${metrics.critical} de prioridad crítica`}
            tone={metrics.critical > 0 ? "red" : "neutral"}
            icon="!"
          />
          <KpiCard
            label="Primera respuesta"
            value={`${Math.round(metrics.medianResponse)} s`}
            detail="Mediana desde la activación"
            tone="blue"
            icon="↗"
          />
          <KpiCard
            label="Cumplimiento SLA"
            value={`${Math.round(metrics.sla * 100)}%`}
            detail="Respuesta confirmada en menos de 5 min"
            tone="green"
            icon="✓"
          />
          <KpiCard
            label="Activación desde reloj"
            value={`${Math.round(metrics.smartwatch * 100)}%`}
            detail={`${formatNumber.format(data.resumen.dispositivosActivos)} dispositivos activos`}
            tone="purple"
            icon="◉"
          />
          <KpiCard
            label="Escaladas a emergencia"
            value={formatNumber.format(metrics.escalated)}
            detail={`${Math.round(metrics.automatic * 100)}% clasificación automática`}
            tone="orange"
            icon="⌁"
          />
        </section>

        <div className="map-layout">
          <DashboardMap
            alerts={filteredAlerts}
            zones={filteredZones}
            mapInfo={data.mapa}
            mode={mode}
            onModeChange={setMode}
            onSelectAlert={setSelectedAlert}
          />
          <section className="priority-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Seguimiento</span>
                <h2>Alertas prioritarias</h2>
              </div>
            </div>
            <div className="priority-list">
              {priorityAlerts.map((alert) => {
                const info = categoryInfo(alert.categoria);
                return (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <span
                      className="priority-color"
                      style={{ backgroundColor: info.color }}
                    />
                    <span className="priority-main">
                      <strong>{info.label}</strong>
                      <small>
                        {alert.calle} · {alert.zona}
                      </small>
                    </span>
                    <span className="priority-meta">
                      <b>{alert.prioridad}</b>
                      <small>{formatDate.format(new Date(alert.fecha))}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="correlation-note">
              <span>◎</span>
              <div>
                <strong>Agrupación geográfica activa</strong>
                <small>
                  Los círculos consolidan alertas cercanas según el nivel de
                  zoom.
                </small>
              </div>
            </div>
          </section>
        </div>

        <section className="analytics-grid" id="tendencia">
          <article className="chart-card chart-wide">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Comportamiento temporal</span>
                <h2>Evolución de alertas</h2>
              </div>
              <span className="chart-summary">
                {formatCompact.format(metrics.total)} en {period} días
              </span>
            </div>
            <EChart
              option={trendOption}
              className="trend-chart"
              ariaLabel="Serie temporal diaria del total de alertas"
            />
          </article>
          <article className="chart-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Composición</span>
                <h2>Tipos de alerta</h2>
              </div>
            </div>
            <EChart
              option={categoryOption}
              className="category-chart"
              ariaLabel="Distribución de alertas por categoría"
            />
          </article>
        </section>

        <section className="zone-card" id="zonas">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Comparación normalizada</span>
              <h2>Zonas con mayor incidencia</h2>
            </div>
            <span className="table-note">
              Ordenado por alertas cada 1.000 usuarios
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Zona</th>
                  <th>Alertas</th>
                  <th>Por 1.000 usuarios</th>
                  <th>Críticas</th>
                  <th>Respuesta mediana</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {zoneRanking.map((zone, index) => (
                  <tr key={zone.codigo}>
                    <td>
                      <span className="rank">{index + 1}</span>
                      <strong>{zone.nombre}</strong>
                      <small>{zone.codigo}</small>
                    </td>
                    <td>{formatNumber.format(zone.alertas)}</td>
                    <td>
                      <strong>{zone.alertasPorMil.toFixed(1)}</strong>
                    </td>
                    <td>{formatNumber.format(zone.criticas)}</td>
                    <td>{Math.round(zone.respuestaMediana)} s</td>
                    <td>
                      <span
                        className={
                          zone.sla >= 0.95 ? "sla-good" : "sla-watch"
                        }
                      >
                        {Math.round(zone.sla * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer>
          <span>Vitacura Comunidad Segura · Prototipo analítico</span>
          <span>
            Incidentes sintéticos · Geometrías municipales y red vial pública
          </span>
        </footer>
      </main>

      <AlertDetail
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
      />
    </div>
  );
}

export default function App() {
  const [period, setPeriod] = useState(90);
  const [category, setCategory] = useState("todas");
  const { data, loading, error, retry, source } = useDashboardData({
    dias: period,
    categoria: category,
  });

  if (loading && !data) return <LoadingScreen />;
  if (error && !data) return <ErrorScreen error={error} onRetry={retry} />;
  return (
    <Dashboard
      data={data}
      source={source}
      period={period}
      category={category}
      onPeriodChange={setPeriod}
      onCategoryChange={setCategory}
    />
  );
}
