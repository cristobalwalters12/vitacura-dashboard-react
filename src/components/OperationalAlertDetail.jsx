import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  CAMERA_STREAM_URL,
  CATEGORY,
  MAP_STYLE_URL,
} from "../config/dashboard.js";
import { LiveCameraPlayer } from "./LiveCameraModal.jsx";

const CRITICALITY = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const WORKFLOW = [
  { estado: "revisando", label: "Revisada" },
  { estado: "atendida", label: "Atendida" },
  { estado: "cerrada", label: "Cerrada" },
];

function interpolateRoute(coordinates, progress) {
  if (coordinates.length < 2 || progress >= 1) return coordinates;
  if (progress <= 0) return [coordinates[0], coordinates[0]];
  const lengths = coordinates.slice(1).map((coordinate, index) => {
    const previous = coordinates[index];
    return Math.hypot(
      coordinate[0] - previous[0],
      coordinate[1] - previous[1],
    );
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const target = total * progress;
  let travelled = 0;
  const result = [coordinates[0]];
  for (let index = 0; index < lengths.length; index += 1) {
    const segment = lengths[index];
    if (travelled + segment <= target) {
      result.push(coordinates[index + 1]);
      travelled += segment;
      continue;
    }
    const ratio = segment ? (target - travelled) / segment : 0;
    const from = coordinates[index];
    const to = coordinates[index + 1];
    result.push([
      from[0] + (to[0] - from[0]) * ratio,
      from[1] + (to[1] - from[1]) * ratio,
    ]);
    break;
  }
  return result.length > 1 ? result : [coordinates[0], coordinates[0]];
}

function lineFeature(coordinates) {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates },
  };
}

function pointFeature(coordinates, properties = {}) {
  return {
    type: "Feature",
    properties,
    geometry: { type: "Point", coordinates },
  };
}

function OperationalRouteMap({ alert, theme }) {
  const elementRef = useRef(null);

  useEffect(() => {
    if (!elementRef.current) return undefined;
    const { origen, destino, geometria } = alert.ruta;
    const routeCoordinates = geometria.coordinates;
    const accent = theme === "dark" ? "#00EEFC" : "#006970";
    const routeBase = theme === "dark" ? "#8DB8FF" : "#315DA8";
    const danger = theme === "dark" ? "#FFB4AB" : "#BA1A1A";
    const marker = theme === "dark" ? "#FFFFFF" : "#191C1E";
    let animationFrame;
    const map = new maplibregl.Map({
      container: elementRef.current,
      style: MAP_STYLE_URL,
      center: origen.coordinates,
      zoom: 13.5,
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
      map.addSource("ruta-operativa-base", {
        type: "geojson",
        data: lineFeature(routeCoordinates),
      });
      map.addSource("ruta-operativa-progreso", {
        type: "geojson",
        data: lineFeature([routeCoordinates[0], routeCoordinates[0]]),
      });
      map.addSource("extremos-operativos", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            pointFeature(origen.coordinates, { tipo: "origen" }),
            pointFeature(destino.coordinates, { tipo: "destino" }),
          ],
        },
      });
      map.addSource("unidad-operativa", {
        type: "geojson",
        data: pointFeature(origen.coordinates),
      });
      map.addLayer({
        id: "ruta-operativa-base-halo",
        type: "line",
        source: "ruta-operativa-base",
        paint: {
          "line-color": routeBase,
          "line-width": 4,
          "line-opacity": 0.3,
          "line-dasharray": [1.4, 1.2],
        },
      });
      map.addLayer({
        id: "ruta-operativa-progreso-halo",
        type: "line",
        source: "ruta-operativa-progreso",
        paint: {
          "line-color": accent,
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });
      map.addLayer({
        id: "extremos-operativos-punto",
        type: "circle",
        source: "extremos-operativos",
        paint: {
          "circle-radius": ["match", ["get", "tipo"], "destino", 10, 8],
          "circle-color": [
            "match",
            ["get", "tipo"],
            "destino",
            danger,
            accent,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "unidad-operativa-punto",
        type: "circle",
        source: "unidad-operativa",
        paint: {
          "circle-radius": 7,
          "circle-color": marker,
          "circle-stroke-color": accent,
          "circle-stroke-width": 4,
        },
      });
      const bounds = new maplibregl.LngLatBounds(
        origen.coordinates,
        origen.coordinates,
      );
      routeCoordinates.forEach((coordinate) => bounds.extend(coordinate));
      map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 650 });

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const duration = reducedMotion ? 1 : 3_200;
      const startedAt = performance.now();
      const animate = (timestamp) => {
        const progress = Math.min(1, (timestamp - startedAt) / duration);
        const visibleCoordinates = interpolateRoute(routeCoordinates, progress);
        map.getSource("ruta-operativa-progreso")?.setData(
          lineFeature(visibleCoordinates),
        );
        map.getSource("unidad-operativa")?.setData(
          pointFeature(visibleCoordinates.at(-1)),
        );
        if (progress < 1) animationFrame = requestAnimationFrame(animate);
      };
      animationFrame = requestAnimationFrame(animate);
    });
    return () => {
      cancelAnimationFrame(animationFrame);
      map.remove();
    };
  }, [alert, theme]);

  return (
    <div
      ref={elementRef}
      className="operational-route-map"
      aria-label="Ruta estimada animada desde la Municipalidad de Vitacura"
    />
  );
}

function AlertWorkflow({ alert, busy, onAdvance }) {
  const currentIndex = WORKFLOW.findIndex(
    (step) => step.estado === alert.estado,
  );
  return (
    <section className="operational-workflow" aria-label="Estado de la alerta">
      <div>
        <span className="eyebrow">Gestión del caso</span>
        <h3>Flujo de atención</h3>
        <small>Estado actual: {alert.estado}</small>
      </div>
      <div className="operational-workflow-actions">
        {WORKFLOW.map((step, index) => {
          const completed = currentIndex >= index;
          const enabled = !busy && currentIndex + 1 === index;
          return (
            <button
              key={step.estado}
              type="button"
              className={completed ? "completed" : ""}
              disabled={!enabled}
              onClick={() => onAdvance(step.estado)}
            >
              <i>{completed ? "✓" : index + 1}</i>
              {step.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function OperationalAlertDetail({
  alert,
  theme,
  onClose,
  onStatusChange,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const [view, setView] = useState("map");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const category = CATEGORY[alert.categoria] ?? CATEGORY.sin_clasificar;
  const minutes = Math.max(
    1,
    Math.ceil(alert.ruta.duracion_estimada_segundos / 60),
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll(
          'button:not([disabled]), video[controls], [href], [tabindex]:not([tabindex="-1"])',
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
    document.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [onClose]);

  const advanceStatus = async (status) => {
    setUpdatingStatus(true);
    setStatusError(null);
    try {
      await onStatusChange(status);
    } catch (error) {
      setStatusError(error.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="operational-detail-backdrop" onMouseDown={onClose}>
      <article
        ref={dialogRef}
        className="operational-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operational-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">Alerta operacional · {alert.codigo}</span>
            <h2 id="operational-detail-title">{category.label}</h2>
            <p>{alert.ubicacion.direccion_referencia}</p>
          </div>
          <span
            className={`operational-criticality criticality-${alert.criticidad}`}
          >
            {CRITICALITY[alert.criticidad] ?? alert.criticidad}
          </span>
          {alert.camara && (
            <button
              className="operational-camera-button"
              type="button"
              onClick={() => setView((current) =>
                current === "map" ? "camera" : "map"
              )}
            >
              <i /> {view === "map" ? "Ver cámara en vivo" : "Volver al mapa"}
            </button>
          )}
          <button
            ref={closeRef}
            className="operational-detail-close"
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            ×
          </button>
        </header>
        {view === "map" ? (
          <OperationalRouteMap alert={alert} theme={theme} />
        ) : (
          <div className="operational-inline-camera">
            <LiveCameraPlayer streamUrl={CAMERA_STREAM_URL} />
          </div>
        )}
        <section className="operational-route-summary">
          <div>
            <span>Distancia por red vial</span>
            <strong>
              {alert.ruta.distancia_estimada_metros.toLocaleString("es-CL")} m
            </strong>
            <small>
              {alert.ruta.segmentos.toLocaleString("es-CL")} segmentos viales
            </small>
          </div>
          <div>
            <span>ETA vial</span>
            <strong>{minutes} min</strong>
            <small>Optimizado por tiempo de recorrido</small>
          </div>
          <div>
            <span>Origen</span>
            <strong>Municipalidad</strong>
            <small>Av. Bicentenario 3800</small>
          </div>
        </section>
        <section className="operational-alert-description">
          <div className="operational-person">
            <span>Persona que solicita ayuda</span>
            <strong>{alert.persona.nombre}</strong>
            <small>{alert.persona.id} · {alert.origen.canal}</small>
          </div>
          <div className="operational-transcription">
            <span>Descripción y transcripción</span>
            <blockquote>“{alert.transcripcion.texto}”</blockquote>
            <small>
              Idioma {alert.transcripcion.idioma} · recibido {new Date(alert.recibida_en).toLocaleString("es-CL")}
            </small>
          </div>
        </section>
        <AlertWorkflow
          alert={alert}
          busy={updatingStatus}
          onAdvance={advanceStatus}
        />
        {statusError && <p className="operational-status-error" role="alert">{statusError}</p>}
        <footer>
          <span>pgRouting · PostGIS · Dijkstra</span>
          <small>
            Ruta calle a calle calculada sobre vita_routing.ways con velocidades OSM.
          </small>
        </footer>
      </article>
    </div>
  );
}
