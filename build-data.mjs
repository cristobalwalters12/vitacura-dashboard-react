import { readFileSync, writeFileSync } from "node:fs";
import {
  ALERT_COUNT,
  CATEGORIES,
  PERIOD,
  SCENARIO_SEED,
  SCENARIO_VERSION,
  STORIES,
  STREETS,
  TRANSCRIPTIONS,
  ZONE_PROFILES,
} from "./scripts/scenario.config.mjs";

const outputUrl = new URL("./public/data/dashboard-data.json", import.meta.url);
const currentSnapshot = JSON.parse(readFileSync(outputUrl, "utf8"));

function mulberry32(seed) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const random = mulberry32(SCENARIO_SEED);
const round = (value, digits = 0) => Number(value.toFixed(digits));
const randomBetween = (minimum, maximum) =>
  minimum + random() * (maximum - minimum);

function weightedChoice(entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = random() * total;
  for (const [value, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return value;
  }
  return entries.at(-1)[0];
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function isStoryActive(story, day, zone, hour) {
  if (story.start && day < story.start) return false;
  if (story.end && day > story.end) return false;
  if (story.zones && !story.zones.includes(zone)) return false;
  if (story.hours && !story.hours.includes(hour)) return false;
  return true;
}

function buildDays() {
  const start = new Date(PERIOD.start);
  const end = new Date(PERIOD.end);
  const days = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = dateKey(cursor);
    const weekday = cursor.getUTCDay();
    const seasonal = 1 + 0.08 * Math.sin((days.length / 365) * Math.PI * 4);
    const weekdayFactor = weekday === 0 || weekday === 6 ? 0.91 : 1.04;
    const recentMedicalFactor = day >= "2026-08-01" ? 1.14 : 1;
    days.push({ timestamp: cursor.getTime(), weight: seasonal * weekdayFactor * recentMedicalFactor });
  }
  return days;
}

const dayEntries = buildDays().map((day) => [day, day.weight]);
const hourEntries = Array.from({ length: 24 }, (_, hour) => {
  let weight = 1;
  if (hour >= 7 && hour <= 9) weight = 1.22;
  if (hour >= 12 && hour <= 14) weight = 1.12;
  if (hour >= 18 && hour <= 22) weight = 1.35;
  if (hour >= 1 && hour <= 5) weight = 0.38;
  return [hour, weight];
});

function chooseHour(day, zone) {
  return weightedChoice(
    hourEntries.map(([hour, baseWeight]) => {
      let weight = baseWeight;
      for (const story of STORIES) {
        if (story.hourMultiplier && isStoryActive(story, day, zone, hour)) {
          weight *= story.hourMultiplier;
        }
      }
      return [hour, weight];
    }),
  );
}

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, rings) {
  return pointInRing(point, rings[0]) && !rings.slice(1).some((ring) => pointInRing(point, ring));
}

function geometryPolygons(geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function randomPoint(geometry) {
  const polygons = geometryPolygons(geometry);
  const polygon = weightedChoice(
    polygons.map((candidate) => {
      const longitudes = candidate[0].map(([longitude]) => longitude);
      const latitudes = candidate[0].map(([, latitude]) => latitude);
      const area =
        (Math.max(...longitudes) - Math.min(...longitudes)) *
        (Math.max(...latitudes) - Math.min(...latitudes));
      return [candidate, Math.max(area, Number.EPSILON)];
    }),
  );
  const longitudes = polygon[0].map(([longitude]) => longitude);
  const latitudes = polygon[0].map(([, latitude]) => latitude);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const point = [randomBetween(west, east), randomBetween(south, north)];
    const roundedPoint = point.map((value) => round(value, 6));
    if (pointInPolygon(roundedPoint, polygon)) return roundedPoint;
  }
  throw new Error("No fue posible generar un punto dentro de la zona");
}

const zoneFeatures = currentSnapshot.zonas.features.map((feature) => ({
  ...feature,
  properties: {
    ...feature.properties,
    usuarios: feature.properties.usuarios ?? 0,
  },
}));
const zoneEntries = zoneFeatures.map((feature) => {
  const profile = ZONE_PROFILES[feature.properties.codigo] ?? { volume: 1, response: 1 };
  return [feature, Math.max(feature.properties.usuarios, 1) * profile.volume];
});

function chooseCategory(day, zone, hour) {
  const profile = ZONE_PROFILES[zone] ?? {};
  const weights = Object.entries(CATEGORIES).map(([category, config]) => {
    let weight = config.weight * (profile.category?.[category] ?? 1);
    if (category === "seguridad" && (hour >= 20 || hour <= 3)) weight *= 1.42;
    if (category === "accidente" && ([8, 9, 18, 19].includes(hour))) weight *= 1.5;
    if (category === "asistencia_cuidador" && hour >= 7 && hour <= 18) weight *= 1.28;
    for (const story of STORIES) {
      if (story.category === category && isStoryActive(story, day, zone, hour)) {
        weight *= story.multiplier ?? 1;
      }
    }
    return [category, weight];
  });
  return weightedChoice(weights);
}

function chooseSeverity(category) {
  return weightedChoice(Object.entries(CATEGORIES[category].severity));
}

function choosePriority(severity) {
  const weights = {
    critica: { P1: 0.86, P2: 0.14 },
    alta: { P1: 0.2, P2: 0.66, P3: 0.14 },
    media: { P2: 0.13, P3: 0.72, P4: 0.15 },
    baja: { P3: 0.22, P4: 0.78 },
  };
  return weightedChoice(Object.entries(weights[severity]));
}

function chooseChannel(category) {
  if (category === "asistencia_cuidador") {
    return weightedChoice([["cuidador", 0.62], ["reloj_inteligente", 0.23], ["movil", 0.15]]);
  }
  return weightedChoice([["reloj_inteligente", 0.31], ["movil", 0.61], ["cuidador", 0.08]]);
}

function responseSeconds({ day, zone, hour, priority }) {
  const profile = ZONE_PROFILES[zone] ?? { response: 1 };
  let factor = profile.response;
  if (hour >= 22 || hour <= 5) factor *= 1.22;
  if (priority === "P1") factor *= 0.82;
  for (const story of STORIES) {
    if (story.responseMultiplier && isStoryActive(story, day, zone, hour)) {
      factor *= story.responseMultiplier;
    }
  }
  let seconds = (28 + -Math.log(1 - random()) * 48) * factor;
  const slowTailRate = zone === "A-14" ? 0.065 : 0.025;
  if (random() < slowTailRate) seconds *= randomBetween(5, 9);
  return Math.min(Math.round(seconds), 1_800);
}

function modelClassification(category) {
  const base = CATEGORIES[category].confidence;
  const confidence = Math.max(0.51, Math.min(0.99, base + randomBetween(-0.13, 0.08)));
  const requiresReview = confidence < 0.78 || random() < (category === "incendio" ? 0.12 : 0.035);
  return { confidence: round(confidence, 3), requiresReview };
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1_000).toISOString();
}

function createAlert(index) {
  const day = weightedChoice(dayEntries);
  const zoneFeature = weightedChoice(zoneEntries);
  const zone = zoneFeature.properties.codigo;
  const hour = chooseHour(dateKey(day.timestamp), zone);
  const minute = Math.floor(random() * 60);
  const second = Math.floor(random() * 60);
  const createdAt = new Date(day.timestamp);
  createdAt.setUTCHours(hour, minute, second, 0);
  const dayString = dateKey(createdAt);
  const category = chooseCategory(dayString, zone, hour);
  const type = CATEGORIES[category].types[Math.floor(random() * CATEGORIES[category].types.length)];
  const severity = chooseSeverity(category);
  const priority = choosePriority(severity);
  const channel = chooseChannel(category);
  const classification = modelClassification(category);
  const response = responseSeconds({ day: dayString, zone, hour, priority });
  const classifyDelay = Math.round(randomBetween(2, 11));
  const dispatchDelay = response + Math.round(randomBetween(25, 150));
  const arrivalDelay = dispatchDelay + Math.round(randomBetween(160, 720));
  const resolutionDelay = arrivalDelay + Math.round(randomBetween(420, 7_200));
  const escalated = priority === "P1" ? random() < 0.68 : priority === "P2" ? random() < 0.23 : random() < 0.045;
  const result = weightedChoice([
    ["asistencia_realizada", 0.79],
    ["sin_contacto", 0.105],
    ["falsa_alarma", 0.065],
    ["cancelada_por_usuario", 0.04],
  ]);
  const state = result === "falsa_alarma" ? "falsa_alarma" : result === "cancelada_por_usuario" ? "cancelada" : "resuelta";
  const notified = Math.round(randomBetween(priority === "P1" ? 35 : 8, priority === "P1" ? 160 : 75));
  const confirmed = Math.min(notified, Math.round(notified * randomBetween(0.38, 0.82)));
  const priorityBase = { P1: 88, P2: 69, P3: 47, P4: 24 }[priority];
  const identifier = (BigInt(SCENARIO_SEED) * 1_000_000n + BigInt(index + 1)).toString(16).padStart(24, "0").slice(-24);

  return {
    id: identifier,
    codigo: `VIT-DEMO-${String(index + 1).padStart(7, "0")}`,
    coordenadas: randomPoint(zoneFeature.geometry),
    fecha: createdAt.toISOString(),
    creadoEn: createdAt.toISOString(),
    clasificadoEn: addSeconds(createdAt, classifyDelay),
    primeraConfirmacionEn: addSeconds(createdAt, response),
    despachadoEn: addSeconds(createdAt, dispatchDelay),
    llegadoEn: addSeconds(createdAt, arrivalDelay),
    resueltoEn: addSeconds(createdAt, resolutionDelay),
    categoria: category,
    tipo: type,
    severidad: severity,
    confianza: classification.confidence,
    requiereRevision: classification.requiresReview,
    prioridad: priority,
    puntajePrioridad: Math.min(100, Math.max(1, priorityBase + Math.round(randomBetween(-7, 8)))),
    razonesPrioridad: [severity, escalated ? "escalamiento_requerido" : "evaluacion_operacional"],
    canal: channel,
    metodo: channel === "reloj_inteligente" ? weightedChoice([["grabacion_voz", 0.58], ["boton_sos", 0.42]]) : channel === "cuidador" ? "solicitud_cuidador" : "manual",
    respuestaSegundos: response,
    escalada: escalated,
    estado: state,
    zona: zone,
    zonaNombre: zoneFeature.properties.nombre,
    calle: STREETS[Math.floor(random() * STREETS.length)],
    resultado: result,
    transcripcionAnonimizada: TRANSCRIPTIONS[category],
    modelo: {
      nombre: "vita-alert-classifier",
      version: random() < 0.82 ? "2.1.0" : "2.0.3",
      latenciaMs: Math.round(randomBetween(180, 1_250)),
    },
    notificaciones: {
      comunidadNotificada: priority !== "P4",
      usuariosNotificados: notified,
      entregadas: Math.round(notified * randomBetween(0.88, 0.99)),
      confirmadas: confirmed,
    },
    respuesta: {
      tipoRespondedor: category === "medica" ? "centro_salud" : category === "asistencia_cuidador" ? "cuidador" : "seguridad_municipal",
      segundosDespacho: dispatchDelay,
      segundosLlegada: arrivalDelay,
      segundosResolucion: resolutionDelay,
    },
    sintetico: true,
  };
}

const alerts = Array.from({ length: ALERT_COUNT }, (_, index) => createAlert(index)).sort((a, b) => a.fecha.localeCompare(b.fecha));

function median(values) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

const zoneStats = zoneFeatures.map((feature) => {
  const zoneAlerts = alerts.filter((alert) => alert.zona === feature.properties.codigo);
  const responses = zoneAlerts.map((alert) => alert.respuestaSegundos).filter(Number.isFinite);
  const users = feature.properties.usuarios;
  return {
    codigo: feature.properties.codigo,
    nombre: feature.properties.nombre,
    usuarios: users,
    alertas: zoneAlerts.length,
    alertasPorMil: users ? round((zoneAlerts.length / users) * 1_000, 1) : 0,
    criticas: zoneAlerts.filter((alert) => alert.prioridad === "P1").length,
    respuestaMediana: round(median(responses)),
    sla: responses.length ? responses.filter((value) => value <= 300).length / responses.length : 0,
  };
});

const categories = Object.keys(CATEGORIES)
  .map((category) => ({
    categoria: category,
    total: alerts.filter((alert) => alert.categoria === category).length,
  }))
  .sort((a, b) => b.total - a.total);

const output = {
  metadata: {
    nombre: "Escenario analítico sintético de Vitacura",
    sintetico: true,
    versionEscenario: SCENARIO_VERSION,
    semilla: SCENARIO_SEED,
    actualizadoEn: PERIOD.end,
    periodo: { inicio: PERIOD.start, fin: PERIOD.end },
    fuenteCoordenadas: currentSnapshot.metadata.fuenteCoordenadas ?? "OpenStreetMap",
    comuna: currentSnapshot.metadata.comuna ?? "Vitacura",
    region: currentSnapshot.metadata.region ?? "Región Metropolitana",
    historias: STORIES.map(({ id, title, description }) => ({ id, titulo: title, descripcion: description })),
  },
  resumen: currentSnapshot.resumen,
  categorias: categories,
  zonas: {
    type: "FeatureCollection",
    features: zoneFeatures.map((feature) => {
      const stats = zoneStats.find((item) => item.codigo === feature.properties.codigo);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          alertas: stats.alertas,
          criticas: stats.criticas,
          alertasPorMil: stats.alertasPorMil,
          sla: round(stats.sla * 100, 1),
        },
      };
    }),
  },
  estadisticasZonas: zoneStats,
  alertas: alerts,
};

writeFileSync(outputUrl, `${JSON.stringify(output)}\n`, "utf8");
console.log(
  `Escenario ${SCENARIO_VERSION} generado con semilla ${SCENARIO_SEED}: ` +
    `${alerts.length.toLocaleString("es-CL")} alertas, ${zoneFeatures.length} zonas y ${STORIES.length} historias.`,
);
