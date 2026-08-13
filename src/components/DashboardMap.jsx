import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_MODES, MAP_STYLE_URL } from "../config/dashboard.js";
import {
  categoryInfo,
  formatCompact,
  formatNumber,
} from "../utils/formatters.js";

const EMPTY_FEATURE_COLLECTION = { type: "FeatureCollection", features: [] };
const ZONE_COLORS = ["#dfe9f3", "#a9ded3", "#63c8ba", "#25a99a", "#0d5966"];

function alertGeoJson(alerts) {
  return {
    type: "FeatureCollection",
    features: alerts.map((alert) => ({
      type: "Feature",
      id: alert.id,
      geometry: { type: "Point", coordinates: alert.coordenadas },
      properties: {
        id: alert.id,
        codigo: alert.codigo,
        categoria: alert.categoria,
        categoriaLabel: categoryInfo(alert.categoria).label,
        color: categoryInfo(alert.categoria).color,
        severidad: alert.severidad,
        prioridad: alert.prioridad,
        puntaje: alert.puntajePrioridad,
        fecha: alert.fecha,
        zona: alert.zona,
        calle: alert.calle,
      },
    })),
  };
}

function selectedAlertGeoJson(alert) {
  if (!alert) return EMPTY_FEATURE_COLLECTION;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: alert.coordenadas },
        properties: { color: categoryInfo(alert.categoria).color },
      },
    ],
  };
}

function quantile(values, percentile) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * percentile))];
}

function buildZoneScale(zones) {
  const values = zones.features
    .map((feature) => Number(feature.properties.alertasPorMil) || 0)
    .sort((a, b) => a - b);
  const thresholds = [0.2, 0.4, 0.6, 0.8].map((percentile) =>
    quantile(values, percentile),
  );
  const expression = [
    "step",
    ["coalesce", ["get", "alertasPorMil"], 0],
    ZONE_COLORS[0],
  ];
  let previous = -Infinity;
  thresholds.forEach((threshold, index) => {
    if (threshold > previous) {
      expression.push(threshold, ZONE_COLORS[index + 1]);
      previous = threshold;
    }
  });
  return {
    expression,
    minimum: values[0] ?? 0,
    maximum: values.at(-1) ?? 0,
  };
}

function applyZoneScale(map, zones) {
  if (!map.getLayer("zonas-relleno")) return;
  map.setPaintProperty(
    "zonas-relleno",
    "fill-color",
    buildZoneScale(zones).expression,
  );
}

function setModeVisibility(map, mode) {
  const visibility = (target) => (mode === target ? "visible" : "none");
  map.setLayoutProperty("calor-alertas", "visibility", visibility("calor"));
  map.setLayoutProperty("grupos-circulo", "visibility", visibility("grupos"));
  map.setLayoutProperty("grupos-texto", "visibility", visibility("grupos"));
  map.setLayoutProperty("alertas-punto", "visibility", visibility("grupos"));
  map.setLayoutProperty("zonas-relleno", "visibility", visibility("zonas"));
}

function addDashboardLayers(map, alerts, zones) {
  const geoJson = alertGeoJson(alerts);
  const zoneScale = buildZoneScale(zones);

  map.addSource("zonas-vitacura", { type: "geojson", data: zones });
  map.addSource("alertas-calor", { type: "geojson", data: geoJson });
  map.addSource("alertas-grupos", {
    type: "geojson",
    data: geoJson,
    cluster: true,
    clusterMaxZoom: 15,
    clusterRadius: 48,
  });
  map.addSource("alerta-seleccion", {
    type: "geojson",
    data: EMPTY_FEATURE_COLLECTION,
  });

  map.addLayer({
    id: "zonas-relleno",
    type: "fill",
    source: "zonas-vitacura",
    paint: {
      "fill-color": zoneScale.expression,
      "fill-opacity": 0.68,
    },
    layout: { visibility: "none" },
  });

  map.addLayer({
    id: "zonas-borde",
    type: "line",
    source: "zonas-vitacura",
    paint: {
      "line-color": "#0b5260",
      "line-width": 1.5,
      "line-opacity": 0.72,
    },
  });

  map.addLayer({
    id: "zona-seleccion-relleno",
    type: "fill",
    source: "zonas-vitacura",
    filter: ["==", ["get", "codigo"], "__sin_seleccion__"],
    paint: {
      "fill-color": "#39d4c5",
      "fill-opacity": 0.2,
    },
  });

  map.addLayer({
    id: "zona-seleccion-borde",
    type: "line",
    source: "zonas-vitacura",
    filter: ["==", ["get", "codigo"], "__sin_seleccion__"],
    paint: {
      "line-color": "#39d4c5",
      "line-width": 4,
      "line-opacity": 0.95,
    },
  });

  map.addLayer({
    id: "calor-alertas",
    type: "heatmap",
    source: "alertas-calor",
    maxzoom: 16,
    paint: {
      "heatmap-weight": [
        "interpolate",
        ["linear"],
        ["get", "puntaje"],
        0,
        0.08,
        100,
        1,
      ],
      "heatmap-intensity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        0.42,
        15,
        1.45,
      ],
      "heatmap-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        13,
        15,
        29,
      ],
      "heatmap-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        0.8,
        16,
        0.15,
      ],
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(24, 182, 173, 0)",
        0.22,
        "#41d3bd",
        0.5,
        "#f8d35d",
        0.75,
        "#ff8a4c",
        1,
        "#ed3459",
      ],
    },
  });

  map.addLayer({
    id: "grupos-circulo",
    type: "circle",
    source: "alertas-grupos",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": [
        "step",
        ["get", "point_count"],
        "#39d4c5",
        30,
        "#ffb84d",
        100,
        "#ef5b67",
      ],
      "circle-radius": [
        "step",
        ["get", "point_count"],
        17,
        30,
        23,
        100,
        31,
      ],
      "circle-stroke-width": 3,
      "circle-stroke-color": "rgba(255,255,255,.8)",
    },
    layout: { visibility: "none" },
  });

  map.addLayer({
    id: "grupos-texto",
    type: "symbol",
    source: "alertas-grupos",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": 12,
      visibility: "none",
    },
    paint: { "text-color": "#08111f" },
  });

  map.addLayer({
    id: "alertas-punto",
    type: "circle",
    source: "alertas-grupos",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["get", "puntaje"],
        0,
        4,
        100,
        9,
      ],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
    },
    layout: { visibility: "none" },
  });

  map.addLayer({
    id: "alerta-seleccion-halo",
    type: "circle",
    source: "alerta-seleccion",
    paint: {
      "circle-radius": 16,
      "circle-color": "rgba(255,255,255,.2)",
      "circle-stroke-color": ["get", "color"],
      "circle-stroke-width": 4,
    },
  });
}

function geometryBounds(geometry) {
  const bounds = new maplibregl.LngLatBounds();
  const visit = (coordinates) => {
    if (
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      Number.isFinite(coordinates[0]) &&
      Number.isFinite(coordinates[1])
    ) {
      bounds.extend(coordinates);
      return;
    }
    coordinates.forEach(visit);
  };
  visit(geometry.coordinates);
  return bounds;
}

function featureCollectionBounds(collection) {
  const bounds = new maplibregl.LngLatBounds();
  collection.features.forEach((feature) => {
    const featureBounds = geometryBounds(feature.geometry);
    bounds.extend(featureBounds.getSouthWest());
    bounds.extend(featureBounds.getNorthEast());
  });
  return bounds;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function zonePopupHtml(properties) {
  const dominant = properties.categoriaDominante
    ? categoryInfo(properties.categoriaDominante).label
    : "Sin actividad";
  return `
    <div class="zone-popup">
      <span>${escapeHtml(properties.codigo)}</span>
      <strong>${escapeHtml(properties.nombre)}</strong>
      <dl>
        <div><dt>Alertas</dt><dd>${formatNumber.format(Number(properties.alertas) || 0)}</dd></div>
        <div><dt>Por 1.000</dt><dd>${formatNumber.format(Number(properties.alertasPorMil) || 0)}</dd></div>
        <div><dt>Críticas</dt><dd>${formatNumber.format(Number(properties.criticas) || 0)}</dd></div>
        <div><dt>Respuesta</dt><dd>${Math.round(Number(properties.respuestaMediana) || 0)} s</dd></div>
        <div><dt>SLA</dt><dd>${Math.round(Number(properties.sla) || 0)}%</dd></div>
        <div><dt>Predomina</dt><dd>${escapeHtml(dominant)}</dd></div>
      </dl>
      <small>Selecciona la zona para analizarla</small>
    </div>`;
}

export default function DashboardMap({
  alerts,
  zones,
  mapInfo,
  mode,
  selectedAlert,
  selectedZone,
  onModeChange,
  onSelectAlert,
  onSelectZone,
  onBoundsChange,
}) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const loadedRef = useRef(false);
  const alertsRef = useRef(alerts);
  const zonesRef = useRef(zones);
  const modeRef = useRef(mode);
  const selectAlertRef = useRef(onSelectAlert);
  const selectZoneRef = useRef(onSelectZone);
  const boundsChangeRef = useRef(onBoundsChange);
  const boundsTimerRef = useRef(null);
  const lastSelectedAlertRef = useRef(null);
  const lastFittedZoneRef = useRef(null);
  const zoneScale = useMemo(() => buildZoneScale(zones), [zones]);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    selectAlertRef.current = onSelectAlert;
  }, [onSelectAlert]);

  useEffect(() => {
    selectZoneRef.current = onSelectZone;
  }, [onSelectZone]);

  useEffect(() => {
    boundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: mapElementRef.current,
      style: MAP_STYLE_URL,
      center: [-70.5795, -33.3908],
      zoom: 12.35,
      minZoom: 11,
      maxZoom: 18,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );

    const notifyBounds = () => {
      clearTimeout(boundsTimerRef.current);
      boundsTimerRef.current = setTimeout(() => {
        const bounds = map.getBounds();
        boundsChangeRef.current?.([
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ]);
      }, 450);
    };

    map.on("load", () => {
      loadedRef.current = true;
      addDashboardLayers(map, alertsRef.current, zonesRef.current);
      setModeVisibility(map, modeRef.current);
      notifyBounds();

      map.on("click", "grupos-circulo", async (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const source = map.getSource("alertas-grupos");
        const zoom = await source.getClusterExpansionZoom(
          feature.properties.cluster_id,
        );
        map.easeTo({ center: feature.geometry.coordinates, zoom });
      });

      map.on("click", "alertas-punto", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const selected = alertsRef.current.find(
          (alert) => alert.id === feature.properties.id,
        );
        if (selected) selectAlertRef.current?.(selected);
      });

      map.on("click", "zonas-relleno", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        selectZoneRef.current?.(feature.properties.codigo);
        new maplibregl.Popup({ closeButton: true, offset: 8 })
          .setLngLat(event.lngLat)
          .setHTML(zonePopupHtml(feature.properties))
          .addTo(map);
      });

      ["grupos-circulo", "alertas-punto", "zonas-relleno"].forEach(
        (layer) => {
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        },
      );
    });
    map.on("moveend", notifyBounds);

    mapRef.current = map;
    return () => {
      clearTimeout(boundsTimerRef.current);
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const geoJson = alertGeoJson(alerts);
    map.getSource("alertas-calor")?.setData(geoJson);
    map.getSource("alertas-grupos")?.setData(geoJson);
  }, [alerts]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.getSource("zonas-vitacura")?.setData(zones);
    applyZoneScale(map, zones);
  }, [zones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    setModeVisibility(map, mode);
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const filter = [
      "==",
      ["get", "codigo"],
      selectedZone ?? "__sin_seleccion__",
    ];
    map.setFilter("zona-seleccion-relleno", filter);
    map.setFilter("zona-seleccion-borde", filter);
    if (selectedZone && lastFittedZoneRef.current !== selectedZone) {
      const feature = zones.features.find(
        (item) => item.properties.codigo === selectedZone,
      );
      if (feature) {
        map.fitBounds(geometryBounds(feature.geometry), {
          padding: 58,
          maxZoom: 14.2,
          duration: 700,
        });
      }
    } else if (!selectedZone && lastFittedZoneRef.current) {
      map.fitBounds(featureCollectionBounds(zones), {
        padding: 42,
        maxZoom: 13,
        duration: 700,
      });
    }
    lastFittedZoneRef.current = selectedZone;
  }, [selectedZone, zones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.getSource("alerta-seleccion")?.setData(
      selectedAlertGeoJson(selectedAlert),
    );
    if (
      selectedAlert &&
      lastSelectedAlertRef.current !== selectedAlert.id
    ) {
      map.easeTo({
        center: selectedAlert.coordenadas,
        zoom: Math.max(map.getZoom(), 15.3),
        duration: 650,
      });
    }
    lastSelectedAlertRef.current = selectedAlert?.id ?? null;
  }, [selectedAlert]);

  return (
    <section className="map-card" id="mapa">
      <div className="section-heading map-heading">
        <div>
          <span className="eyebrow">Inteligencia territorial</span>
          <h2>Mapa de alertas</h2>
        </div>
        <div className="map-heading-actions">
          {selectedZone && (
            <button
              type="button"
              className="selected-zone-chip"
              onClick={() => onSelectZone(selectedZone)}
            >
              Zona {selectedZone} <span>×</span>
            </button>
          )}
          <div className="segmented" aria-label="Visualización del mapa">
            {MAP_MODES.map((item) => (
              <button
                key={item.value}
                className={mode === item.value ? "selected" : ""}
                onClick={() => onModeChange(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="map-wrap">
        <div
          ref={mapElementRef}
          className="map-canvas"
          aria-label="Mapa interactivo de Vitacura"
        />
        <div className="map-legend">
          <strong>
            {mode === "zonas"
              ? "Alertas por 1.000 usuarios"
              : "Intensidad de alertas"}
          </strong>
          <div
            className={
              mode === "zonas" ? "legend-gradient zones" : "legend-gradient"
            }
          />
          <div className="legend-scale">
            <span>
              {mode === "zonas"
                ? formatCompact.format(zoneScale.minimum)
                : "Baja"}
            </span>
            <span>
              {mode === "zonas"
                ? formatCompact.format(zoneScale.maximum)
                : "Alta"}
            </span>
          </div>
        </div>
        <div className="map-counter">
          <strong>{formatCompact.format(alerts.length)}</strong>
          <span>
            {mapInfo?.truncado
              ? `de ${formatCompact.format(mapInfo.total)} eventos`
              : "eventos en el área visible"}
          </span>
        </div>
        {mapInfo?.truncado && (
          <div className="map-sample-note">
            Vista limitada a {formatNumber.format(mapInfo.entregadas)} puntos.
            Ajusta los filtros para mayor precisión.
          </div>
        )}
      </div>
    </section>
  );
}
