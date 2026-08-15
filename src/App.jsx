import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import DeferredModule from "./components/DeferredModule.jsx";
import KpiCard from "./components/KpiCard.jsx";
import InsightCenter from "./components/InsightCenter.jsx";
import OperationalFilters from "./components/OperationalFilters.jsx";
import {
  CATEGORY,
  PERIODS,
  PRIORITY_ORDER,
} from "./config/dashboard.js";
import { getThemePalette } from "./config/theme.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { useAlertDetail } from "./hooks/useAlertDetail.js";
import { useTheme } from "./hooks/useTheme.js";
import {
  alertInBounds,
  alertMatchesFilters,
} from "./utils/dashboardFilters.js";
import {
  categoryInfo,
  formatCompact,
  formatDate,
  formatNumber,
  median,
} from "./utils/formatters.js";

const DashboardMap = lazy(() => import("./components/DashboardMap.jsx"));
const EChart = lazy(() => import("./components/EChart.jsx"));
const OperationalJourney = lazy(
  () => import("./components/OperationalJourney.jsx"),
);
const AiAnalytics = lazy(() => import("./components/AiAnalytics.jsx"));
const CareAnalytics = lazy(() => import("./components/CareAnalytics.jsx"));
const AlertDetail = lazy(() => import("./components/AlertDetail.jsx"));

const NAVIGATION_SECTIONS = [
  "resumen",
  "hallazgos",
  "mapa",
  "tendencia",
  "operacion",
  "ia",
  "zonas",
];

function useActiveSection() {
  const [activeSection, setActiveSection] = useState("resumen");

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const reference = window.innerHeight * 0.28;
        const positions = NAVIGATION_SECTIONS.map((id) => {
          const element = document.getElementById(id);
          return element
            ? { id, top: element.getBoundingClientRect().top }
            : null;
        }).filter(Boolean);
        const reached = positions.filter((item) => item.top <= reference);
        const next = reached.length
          ? reached.reduce((best, item) =>
              item.top > best.top ? item : best,
            ).id
          : positions.sort(
              (a, b) => Math.abs(a.top - reference) - Math.abs(b.top - reference),
            )[0]?.id;
        if (next) setActiveSection((current) => (current === next ? current : next));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return activeSection;
}

function DetailModuleFallback() {
  return (
    <div className="detail-backdrop" role="status">
      <aside className="detail-panel detail-module-fallback">
        <span />
        <b />
        <b />
        <small>Preparando trazabilidad del caso…</small>
      </aside>
    </div>
  );
}

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
    const zone = counts.get(alert.zona) ?? {
      alertas: 0,
      criticas: 0,
      responses: [],
      categories: new Map(),
    };
    zone.alertas += 1;
    if (alert.prioridad === "P1") zone.criticas += 1;
    if (Number.isFinite(alert.respuestaSegundos)) {
      zone.responses.push(alert.respuestaSegundos);
    }
    zone.categories.set(
      alert.categoria,
      (zone.categories.get(alert.categoria) ?? 0) + 1,
    );
    counts.set(alert.zona, zone);
  }

  return {
    type: "FeatureCollection",
    features: data.zonas.features.map((feature) => {
      const values = counts.get(feature.properties.codigo) ?? {
        alertas: 0,
        criticas: 0,
        responses: [],
        categories: new Map(),
      };
      const users = feature.properties.usuarios ?? 0;
      const dominantCategory = [...values.categories.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0];
      return {
        ...feature,
        id: feature.properties.codigo,
        properties: {
          ...feature.properties,
          alertas: values.alertas,
          criticas: values.criticas,
          alertasPorMil: users
            ? Number(((values.alertas / users) * 1000).toFixed(1))
            : 0,
          respuestaMediana: median(values.responses),
          categoriaDominante: dominantCategory ?? null,
          sla: values.responses.length
            ? Number(
                ((
                  values.responses.filter((value) => value <= 300).length /
                  values.responses.length
                ) * 100).toFixed(1),
              )
            : 0,
        },
      };
    }),
  };
}

function Dashboard({
  data,
  theme,
  source,
  refreshing,
  staleError,
  analyticsLoading,
  analyticsError,
  filters,
  bbox,
  onRetry,
  onRetryAnalytics,
  onFiltersChange,
  onClearOperationalFilters,
  onBoundsChange,
  onThemeToggle,
}) {
  const activeSection = useActiveSection();
  const [mode, setMode] = useState("calor");
  const [selectedAlert, setSelectedAlert] = useState(null);
  const {
    detail: selectedAlertDetail,
    loading: alertDetailLoading,
    error: alertDetailError,
    retry: retryAlertDetail,
  } = useAlertDetail(selectedAlert);
  const comparison = data.comparacionServidor;
  const palette = getThemePalette(theme);
  const insights = useMemo(() => {
    const combined = [
      ...(data.hallazgosServidor ?? []),
      ...(data.analiticaServidor?.hallazgos ?? []),
    ];
    const unique = [...new Map(combined.map((item) => [item.id, item])).values()];
    const priority = { alto: 0, medio: 1, positivo: 2 };
    return unique
      .map((item, index) => ({ item, index }))
      .sort(
        (a, b) =>
          (priority[a.item.nivel] ?? 1) - (priority[b.item.nivel] ?? 1) ||
          a.index - b.index,
      )
      .slice(0, 6)
      .map(({ item }) => item);
  }, [data.analiticaServidor?.hallazgos, data.hallazgosServidor]);
  const updatedAtLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CL", {
        dateStyle: "long",
        timeZone: "America/Santiago",
      }).format(new Date(data.metadata.actualizadoEn)),
    [data.metadata.actualizadoEn],
  );

  const maximumDate = useMemo(
    () => new Date(data.metadata.periodo.fin),
    [data.metadata.periodo.fin],
  );

  const analyticAlerts = useMemo(
    () =>
      data.metricasServidor
        ? data.alertas
        : data.alertas.filter((alert) =>
            alertMatchesFilters(alert, filters, maximumDate),
          ),
    [data.alertas, data.metricasServidor, filters, maximumDate],
  );

  const visibleAlerts = useMemo(
    () =>
      data.metricasServidor
        ? data.alertas
        : analyticAlerts.filter((alert) => alertInBounds(alert, bbox)),
    [analyticAlerts, bbox, data.alertas, data.metricasServidor],
  );

  const filteredZones = useMemo(
    () =>
      data.metricasServidor
        ? data.zonas
        : buildZoneGeoJson(data, analyticAlerts),
    [analyticAlerts, data],
  );

  const mapInfo = data.mapa ?? {
    total: visibleAlerts.length,
    entregadas: visibleAlerts.length,
    limite: visibleAlerts.length,
    truncado: false,
  };

  const metrics = useMemo(() => {
    if (data.metricasServidor) return data.metricasServidor;
    const responses = analyticAlerts
      .map((alert) => alert.respuestaSegundos)
      .filter(Number.isFinite);
    const critical = analyticAlerts.filter(
      (alert) => alert.prioridad === "P1",
    ).length;
    const smartwatch = analyticAlerts.filter(
      (alert) => alert.canal === "reloj_inteligente",
    ).length;
    const escalated = analyticAlerts.filter((alert) => alert.escalada).length;
    const automatic = analyticAlerts.filter(
      (alert) => !alert.requiereRevision,
    ).length;

    return {
      total: analyticAlerts.length,
      critical,
      medianResponse: median(responses),
      sla: responses.length
        ? responses.filter((value) => value <= 300).length / responses.length
        : 0,
      smartwatch: analyticAlerts.length
        ? smartwatch / analyticAlerts.length
        : 0,
      escalated,
      automatic: analyticAlerts.length
        ? automatic / analyticAlerts.length
        : 0,
    };
  }, [analyticAlerts, data.metricasServidor]);

  const trend = useMemo(() => {
    if (data.tendenciaServidor) return data.tendenciaServidor;
    const grouped = new Map();
    for (const alert of analyticAlerts) {
      const date = alert.fecha.slice(0, 10);
      const value = grouped.get(date) ?? { date, total: 0 };
      value.total += 1;
      grouped.set(date, value);
    }
    return [...grouped.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [analyticAlerts, data.tendenciaServidor]);

  const categories = useMemo(() => {
    if (data.categoriasServidor) return data.categoriasServidor;
    const grouped = new Map();
    for (const alert of analyticAlerts) {
      grouped.set(
        alert.categoria,
        (grouped.get(alert.categoria) ?? 0) + 1,
      );
    }
    return [...grouped.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [analyticAlerts, data.categoriasServidor]);

  const priorityAlerts = useMemo(
    () =>
      [...visibleAlerts]
        .sort(
          (a, b) =>
            PRIORITY_ORDER[a.prioridad] - PRIORITY_ORDER[b.prioridad] ||
            b.fecha.localeCompare(a.fecha),
        )
        .slice(0, 6),
    [visibleAlerts],
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

    for (const alert of analyticAlerts) {
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
  }, [analyticAlerts, data.estadisticasZonas, data.metricasServidor]);

  const selectAlert = useCallback((alert) => {
    setMode("grupos");
    setSelectedAlert(alert);
  }, []);

  const selectZone = useCallback(
    (zoneCode) => {
      onFiltersChange({
        zona: filters.zona === zoneCode ? null : zoneCode,
      });
    },
    [filters.zona, onFiltersChange],
  );

  const exploreAlertZone = useCallback(
    (zoneCode) => {
      if (!zoneCode) return;
      onFiltersChange({ zona: zoneCode });
      setSelectedAlert(null);
      requestAnimationFrame(() => {
        document
          .querySelector("#mapa")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [onFiltersChange],
  );

  const applyInsight = useCallback(
    (insightFilters) => {
      onFiltersChange(insightFilters);
      requestAnimationFrame(() => {
        document
          .querySelector(insightFilters.zona ? "#mapa" : "#resumen")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [onFiltersChange],
  );

  const comparisonZones = useMemo(
    () =>
      new Map(
        (comparison?.disponible ? comparison.zonas : []).map((item) => [
          item.codigo,
          item,
        ]),
      ),
    [comparison],
  );

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
          color: palette.onSurfaceVariant,
          hideOverlap: true,
          formatter: (value) => value.slice(5),
        },
        axisLine: { lineStyle: { color: palette.outline } },
      },
      yAxis: {
        type: "value",
        name: "Alertas / día",
        nameTextStyle: { color: palette.onSurfaceVariant },
        axisLabel: { color: palette.onSurfaceVariant },
        splitLine: { lineStyle: { color: palette.grid } },
      },
      series: [
        {
          name: "Alertas",
          type: "line",
          data: trend.map((item) => item.total),
          symbol: "none",
          smooth: 0.28,
          lineStyle: { color: palette.secondary, width: 2.4 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: palette.secondaryAlpha },
                { offset: 1, color: palette.secondaryFade },
              ],
            },
          },
        },
        ...(comparison?.disponible && comparison?.tendenciaAnterior?.length
          ? [
              {
                name: "Período anterior",
                type: "line",
                data: comparison.tendenciaAnterior.map((item) => item.total),
                symbol: "none",
                smooth: 0.28,
                lineStyle: {
                  color: palette.onSurfaceVariant,
                  width: 1.5,
                  type: "dashed",
                },
              },
            ]
          : []),
      ],
    }),
    [comparison, palette, trend],
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
        textStyle: {
          color: palette.onSurfaceVariant,
          fontFamily: '"Space Grotesk", ui-sans-serif, sans-serif',
        },
        itemWidth: 10,
        itemHeight: 10,
        formatter: (name) => categoryInfo(name, theme).label,
      },
      series: [
        {
          type: "pie",
          radius: ["47%", "70%"],
          center: ["50%", "42%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: palette.surface, borderWidth: 3 },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              formatter: "{d}%",
              color: palette.onSurface,
              fontSize: 16,
            },
          },
          data: categories.map((item) => ({
            ...item,
            itemStyle: { color: categoryInfo(item.name, theme).color },
          })),
        },
      ],
    }),
    [categories, palette, theme],
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">
        Saltar al contenido principal
      </a>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <strong>Vitacura</strong>
            <span>Comunidad Segura</span>
          </div>
        </div>
        <nav aria-label="Secciones del tablero">
          <a
            className={activeSection === "resumen" ? "active" : ""}
            aria-current={activeSection === "resumen" ? "location" : undefined}
            href="#resumen"
          >
            <span>⌂</span>Resumen
          </a>
          <a
            className={activeSection === "hallazgos" ? "active" : ""}
            aria-current={activeSection === "hallazgos" ? "location" : undefined}
            href="#hallazgos"
          >
            <span>✦</span>Hallazgos
          </a>
          <a
            className={activeSection === "mapa" ? "active" : ""}
            aria-current={activeSection === "mapa" ? "location" : undefined}
            href="#mapa"
          >
            <span>⌖</span>Mapa territorial
          </a>
          <a
            className={activeSection === "tendencia" ? "active" : ""}
            aria-current={activeSection === "tendencia" ? "location" : undefined}
            href="#tendencia"
          >
            <span>⌁</span>Tendencias
          </a>
          <a
            className={activeSection === "operacion" ? "active" : ""}
            aria-current={activeSection === "operacion" ? "location" : undefined}
            href="#operacion"
          >
            <span>⇥</span>Operación
          </a>
          <a
            className={activeSection === "ia" ? "active" : ""}
            aria-current={activeSection === "ia" ? "location" : undefined}
            href="#ia"
          >
            <span>◇</span>IA y cuidado
          </a>
          <a
            className={activeSection === "zonas" ? "active" : ""}
            aria-current={activeSection === "zonas" ? "location" : undefined}
            href="#zonas"
          >
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

      <main id="contenido" tabIndex="-1">
        <header className="topbar">
          <div>
            <span className="eyebrow">Municipalidad de Vitacura</span>
            <h1>Panorama comunitario</h1>
          </div>
          <div className="topbar-meta">
            <button
              type="button"
              className="theme-toggle"
              onClick={onThemeToggle}
              aria-label={`Cambiar a modo ${theme === "dark" ? "claro" : "oscuro"}`}
              title={`Cambiar a modo ${theme === "dark" ? "claro" : "oscuro"}`}
            >
              <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
              <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
            </button>
            <span
              className={`live-badge ${refreshing ? "syncing" : ""}`}
              aria-live="polite"
            >
              <i />
              {refreshing
                ? "Actualizando datos"
                : source === "api"
                  ? "API conectada"
                  : "Escenario demostrativo"}
            </span>
            <span>Corte analítico {updatedAtLabel}</span>
          </div>
        </header>

        <div className="synthetic-banner">
          <strong>Demostración con datos simulados</strong>
          <span>
            20.000 incidentes sintéticos sobre coordenadas públicas reales de
            Vitacura.
          </span>
        </div>

        {staleError && (
          <div className="data-warning" role="alert">
            <span>!</span>
            <p>
              No se pudo actualizar el tablero. Se conserva la última lectura
              disponible.
            </p>
            <button type="button" onClick={onRetry}>
              Reintentar
            </button>
          </div>
        )}

        <section className="filters" aria-label="Filtros del tablero">
          <div className="segmented">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={filters.dias === item.value ? "selected" : ""}
                onClick={() => onFiltersChange({ dias: item.value })}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label>
            <span>Tipo de alerta</span>
            <select
              value={filters.categoria}
              onChange={(event) =>
                onFiltersChange({ categoria: event.target.value })
              }
            >
              <option value="todas">Todas las categorías</option>
              {Object.entries(CATEGORY)
                .filter(([value]) => value !== "sin_clasificar")
                .map(([value, item]) => (
                <option key={value} value={value}>
                  {item.label}
                </option>
                ))}
            </select>
          </label>
        </section>

        <OperationalFilters
          filters={filters}
          zones={data.estadisticasZonas}
          onChange={onFiltersChange}
          onClear={onClearOperationalFilters}
        />

        <div id="hallazgos">
          <InsightCenter
            insights={insights}
            comparison={comparison}
            onApply={applyInsight}
          />
        </div>

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
            comparison={comparison?.disponible ? comparison.metricas.total : null}
            inverse
          />
          <KpiCard
            label="Primera respuesta"
            value={`${Math.round(metrics.medianResponse)} s`}
            detail="Mediana desde la activación"
            tone="blue"
            icon="↗"
            comparison={
              comparison?.disponible
                ? comparison.metricas.medianResponse
                : null
            }
            inverse
          />
          <KpiCard
            label="Cumplimiento SLA"
            value={`${Math.round(metrics.sla * 100)}%`}
            detail="Respuesta confirmada en menos de 5 min"
            tone="green"
            icon="✓"
            comparison={comparison?.disponible ? comparison.metricas.sla : null}
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
            comparison={
              comparison?.disponible ? comparison.metricas.escalated : null
            }
            inverse
          />
        </section>

        <div className="map-layout">
          <DeferredModule
            id="mapa"
            className="map-card deferred-map"
            minHeight={547}
            label="mapa territorial"
            rootMargin="600px 0px"
          >
            <DashboardMap
              theme={theme}
              alerts={visibleAlerts}
              zones={filteredZones}
              mapInfo={mapInfo}
              mode={mode}
              selectedAlert={selectedAlert}
              selectedZone={filters.zona}
              onModeChange={setMode}
              onSelectAlert={selectAlert}
              onSelectZone={selectZone}
              onBoundsChange={onBoundsChange}
            />
          </DeferredModule>
          <section className="priority-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Seguimiento</span>
                <h2>Alertas prioritarias</h2>
              </div>
            </div>
            <div className="priority-list">
              {priorityAlerts.length === 0 && (
                <div className="priority-empty">
                  No hay alertas visibles con los filtros seleccionados.
                </div>
              )}
              {priorityAlerts.map((alert) => {
                const info = categoryInfo(alert.categoria, theme);
                return (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => selectAlert(alert)}
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

        <DeferredModule
          id="tendencia"
          className="analytics-grid deferred-analytics"
          minHeight={314}
          label="gráficos de tendencia"
        >
          <section className="analytics-grid" id="tendencia">
            <article className="chart-card chart-wide">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Comportamiento temporal</span>
                  <h2>Evolución de alertas</h2>
                </div>
                <span className="chart-summary">
                  {formatCompact.format(metrics.total)} en {filters.dias} días
                  {comparison?.disponible &&
                    " · línea punteada: período anterior"}
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
        </DeferredModule>

        {analyticsLoading && !data.analiticaServidor && (
          <section
            className="advanced-data-state"
            id="operacion"
            role="status"
            aria-live="polite"
          >
            <span className="skeleton-line skeleton-line-short" />
            <span className="skeleton-line" />
            <p>Preparando la analítica operacional, de IA y cuidado…</p>
          </section>
        )}

        {analyticsError && !data.analiticaServidor && (
          <section className="advanced-data-error" id="operacion" role="alert">
            <div>
              <strong>La vista principal está disponible.</strong>
              <span>No fue posible cargar la analítica avanzada.</span>
            </div>
            <button type="button" onClick={onRetryAnalytics}>
              Reintentar analítica
            </button>
          </section>
        )}

        {data.analiticaServidor && (
          <>
            <DeferredModule
              id="operacion"
              className="operations-card"
              minHeight={510}
              label="recorrido operacional"
            >
              <OperationalJourney
                analytics={data.analiticaServidor}
                theme={theme}
              />
            </DeferredModule>
            <DeferredModule
              id="ia"
              className="advanced-analytics-grid deferred-advanced"
              minHeight={610}
              label="analítica de IA y cuidado"
            >
              <section
                className="advanced-analytics-grid"
                aria-label="Analítica avanzada de inteligencia artificial y cuidado"
              >
                <AiAnalytics analytics={data.analiticaServidor} theme={theme} />
                <CareAnalytics
                  analytics={data.analiticaServidor}
                  theme={theme}
                />
              </section>
            </DeferredModule>
          </>
        )}

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
                  <th>Variación</th>
                </tr>
              </thead>
              <tbody>
                {zoneRanking.map((zone, index) => (
                  <tr key={zone.codigo}>
                    <td>
                      <span className="rank">{index + 1}</span>
                      <button
                        type="button"
                        className="zone-table-select"
                        onClick={() => selectZone(zone.codigo)}
                      >
                        {zone.nombre}
                      </button>
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
                    <td>
                      {comparisonZones.get(zone.codigo) ? (
                        <span
                          className={`zone-variation ${comparisonZones.get(zone.codigo).alertas.direccion}`}
                        >
                          {comparisonZones.get(zone.codigo).alertas.direccion ===
                          "sube"
                            ? "↑"
                            : comparisonZones.get(zone.codigo).alertas
                                  .direccion === "baja"
                              ? "↓"
                              : "→"}{" "}
                          {Math.abs(
                            comparisonZones.get(zone.codigo).alertas.porcentaje,
                          ).toFixed(1)}%
                        </span>
                      ) : (
                        "—"
                      )}
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

      {selectedAlert && (
        <Suspense fallback={<DetailModuleFallback />}>
          <AlertDetail
            theme={theme}
            alert={selectedAlert}
            detail={selectedAlertDetail}
            loading={alertDetailLoading}
            error={alertDetailError}
            onRetry={retryAlertDetail}
            onClose={() => setSelectedAlert(null)}
            onExploreZone={exploreAlertZone}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [filters, setFilters] = useState({
    dias: 90,
    categoria: "todas",
    zona: null,
    prioridades: [],
    severidades: [],
    canales: [],
    requiereRevision: null,
    escalada: null,
  });
  const [bbox, setBbox] = useState([
    -70.625157,
    -33.417503,
    -70.533843,
    -33.364089,
  ]);
  const {
    data,
    loading,
    error,
    retry,
    source,
    analyticsLoading,
    analyticsError,
    retryAnalytics,
  } = useDashboardData({
    ...filters,
    bbox,
  });

  const updateFilters = useCallback((changes) => {
    setFilters((current) => ({ ...current, ...changes }));
  }, []);

  const clearOperationalFilters = useCallback(() => {
    setFilters((current) => ({
      ...current,
      zona: null,
      prioridades: [],
      severidades: [],
      canales: [],
      requiereRevision: null,
      escalada: null,
    }));
  }, []);

  const updateBounds = useCallback((nextBounds) => {
    setBbox((current) => {
      if (
        current?.length === 4 &&
        current.every(
          (value, index) => Math.abs(value - nextBounds[index]) < 0.00005,
        )
      ) {
        return current;
      }
      return nextBounds;
    });
  }, []);

  if (loading && !data) return <LoadingScreen />;
  if (error && !data) return <ErrorScreen error={error} onRetry={retry} />;
  return (
    <Dashboard
      data={data}
      theme={theme}
      source={source}
      refreshing={loading}
      staleError={error}
      analyticsLoading={analyticsLoading}
      analyticsError={analyticsError}
      filters={filters}
      bbox={bbox}
      onRetry={retry}
      onRetryAnalytics={retryAnalytics}
      onFiltersChange={updateFilters}
      onClearOperationalFilters={clearOperationalFilters}
      onBoundsChange={updateBounds}
      onThemeToggle={toggleTheme}
    />
  );
}
