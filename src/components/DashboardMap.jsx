import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MAP_MODES, MAP_STYLE_URL } from "../config/dashboard.js";
import {
  categoryInfo,
  formatCompact,
  formatNumber,
} from "../utils/formatters.js";

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

  map.addSource("zonas-vitacura", { type: "geojson", data: zones });
  map.addSource("alertas-calor", { type: "geojson", data: geoJson });
  map.addSource("alertas-grupos", {
    type: "geojson",
    data: geoJson,
    cluster: true,
    clusterMaxZoom: 15,
    clusterRadius: 48,
  });

  map.addLayer({
    id: "zonas-relleno",
    type: "fill",
    source: "zonas-vitacura",
    paint: {
      "fill-color": [
        "interpolate",
        ["linear"],
        ["get", "alertasPorMil"],
        0,
        "#dfe9f3",
        300,
        "#9bdacb",
        800,
        "#25a99a",
        1600,
        "#0d5966",
      ],
      "fill-opacity": 0.64,
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
      "line-opacity": 0.7,
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
        0.15,
        100,
        1,
      ],
      "heatmap-intensity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        0.55,
        15,
        1.7,
      ],
      "heatmap-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        16,
        15,
        34,
      ],
      "heatmap-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        0.86,
        16,
        0.18,
      ],
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(24, 182, 173, 0)",
        0.2,
        "#41d3bd",
        0.45,
        "#f8d35d",
        0.7,
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
}

export default function DashboardMap({
  alerts,
  zones,
  mapInfo,
  mode,
  onModeChange,
  onSelectAlert,
}) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const loadedRef = useRef(false);
  const alertsRef = useRef(alerts);
  const zonesRef = useRef(zones);
  const modeRef = useRef(mode);

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

    map.on("load", () => {
      loadedRef.current = true;
      addDashboardLayers(map, alertsRef.current, zonesRef.current);
      setModeVisibility(map, modeRef.current);

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
        if (selected) onSelectAlert(selected);
      });

      map.on("click", "zonas-relleno", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        new maplibregl.Popup({ closeButton: false, offset: 8 })
          .setLngLat(event.lngLat)
          .setHTML(
            `<strong>${feature.properties.nombre}</strong><br>` +
              `${formatNumber.format(feature.properties.alertas)} alertas · ` +
              `${formatNumber.format(feature.properties.alertasPorMil)} por mil usuarios`,
          )
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

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, [onSelectAlert]);

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
  }, [zones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    setModeVisibility(map, mode);
  }, [mode]);

  return (
    <section className="map-card" id="mapa">
      <div className="section-heading map-heading">
        <div>
          <span className="eyebrow">Inteligencia territorial</span>
          <h2>Mapa de alertas</h2>
        </div>
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
            <span>Baja</span>
            <span>Alta</span>
          </div>
        </div>
        <div className="map-counter">
          <strong>{formatCompact.format(alerts.length)}</strong>
          <span>
            {mapInfo?.truncado
              ? `de ${formatCompact.format(mapInfo.total)} eventos`
              : "eventos visibles"}
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
