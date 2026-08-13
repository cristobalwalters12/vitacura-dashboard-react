import { readFileSync } from "node:fs";
import { ALERT_COUNT, CATEGORIES, PERIOD, SCENARIO_SEED, SCENARIO_VERSION } from "./scripts/scenario.config.mjs";

const data = JSON.parse(
  readFileSync(new URL("./public/data/dashboard-data.json", import.meta.url), "utf8"),
);

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    (rings) => pointInRing(point, rings[0]) && !rings.slice(1).some((ring) => pointInRing(point, ring)),
  );
}

function median(values) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

const zoneByCode = new Map(data.zonas.features.map((feature) => [feature.properties.codigo, feature]));
const validPriorities = new Set(["P1", "P2", "P3", "P4"]);
const validSeverities = new Set(["baja", "media", "alta", "critica"]);
const ids = new Set();
const codes = new Set();
const failures = {
  estructura: [],
  identificadores: [],
  taxonomia: [],
  geografia: [],
  cronologia: [],
  agregados: [],
};

function fail(group, message) {
  if (failures[group].length < 20) failures[group].push(message);
}

if (!data.metadata?.sintetico) fail("estructura", "metadata.sintetico debe ser true");
if (data.metadata?.versionEscenario !== SCENARIO_VERSION) fail("estructura", "La versión del escenario no coincide");
if (data.metadata?.semilla !== SCENARIO_SEED) fail("estructura", "La semilla del escenario no coincide");
if (data.alertas.length !== ALERT_COUNT) fail("estructura", `Se esperaban ${ALERT_COUNT} alertas`);
if (data.zonas.type !== "FeatureCollection" || data.zonas.features.length !== 15) {
  fail("estructura", "Se esperaban 15 zonas GeoJSON");
}

for (const [index, alert] of data.alertas.entries()) {
  const reference = alert.codigo ?? `índice ${index}`;
  if (ids.has(alert.id)) fail("identificadores", `${reference}: id duplicado`);
  if (codes.has(alert.codigo)) fail("identificadores", `${reference}: código duplicado`);
  ids.add(alert.id);
  codes.add(alert.codigo);

  const category = CATEGORIES[alert.categoria];
  if (!category) fail("taxonomia", `${reference}: categoría inválida`);
  if (category && !category.types.includes(alert.tipo)) fail("taxonomia", `${reference}: tipo incompatible`);
  if (!validPriorities.has(alert.prioridad)) fail("taxonomia", `${reference}: prioridad inválida`);
  if (!validSeverities.has(alert.severidad)) fail("taxonomia", `${reference}: severidad inválida`);
  if (typeof alert.confianza !== "number" || alert.confianza < 0 || alert.confianza > 1) {
    fail("taxonomia", `${reference}: confianza fuera de rango`);
  }
  if (!alert.sintetico) fail("estructura", `${reference}: alerta no marcada como sintética`);

  const zone = zoneByCode.get(alert.zona);
  if (!zone) {
    fail("geografia", `${reference}: zona inexistente`);
  } else {
    if (zone.properties.nombre !== alert.zonaNombre) fail("geografia", `${reference}: nombre de zona inconsistente`);
    if (!Array.isArray(alert.coordenadas) || alert.coordenadas.length !== 2 || !alert.coordenadas.every(Number.isFinite)) {
      fail("geografia", `${reference}: coordenadas inválidas`);
    } else if (!pointInGeometry(alert.coordenadas, zone.geometry)) {
      fail("geografia", `${reference}: coordenada fuera de la zona declarada`);
    }
  }

  const chronology = [
    alert.creadoEn,
    alert.clasificadoEn,
    alert.primeraConfirmacionEn,
    alert.despachadoEn,
    alert.llegadoEn,
    alert.resueltoEn,
  ].map((value) => Date.parse(value));
  if (chronology.some((value) => !Number.isFinite(value))) {
    fail("cronologia", `${reference}: fecha inválida`);
  } else if (chronology.some((value, position) => position > 0 && value < chronology[position - 1])) {
    fail("cronologia", `${reference}: secuencia temporal desordenada`);
  }
  if (alert.fecha !== alert.creadoEn) fail("cronologia", `${reference}: fecha y creadoEn difieren`);
  if (Date.parse(alert.creadoEn) < Date.parse(PERIOD.start) || Date.parse(alert.creadoEn) > Date.parse(PERIOD.end)) {
    fail("cronologia", `${reference}: creación fuera del período`);
  }
  const measuredResponse = Math.round((Date.parse(alert.primeraConfirmacionEn) - Date.parse(alert.creadoEn)) / 1_000);
  if (measuredResponse !== alert.respuestaSegundos) fail("cronologia", `${reference}: tiempo de respuesta inconsistente`);
}

const categoryCounts = new Map();
for (const alert of data.alertas) categoryCounts.set(alert.categoria, (categoryCounts.get(alert.categoria) ?? 0) + 1);
for (const item of data.categorias) {
  if (categoryCounts.get(item.categoria) !== item.total) {
    fail("agregados", `Categoría ${item.categoria}: total inconsistente`);
  }
}

for (const stats of data.estadisticasZonas) {
  const alerts = data.alertas.filter((alert) => alert.zona === stats.codigo);
  const responses = alerts.map((alert) => alert.respuestaSegundos).filter(Number.isFinite);
  const expected = {
    alertas: alerts.length,
    criticas: alerts.filter((alert) => alert.prioridad === "P1").length,
    respuestaMediana: Math.round(median(responses)),
    sla: responses.filter((value) => value <= 300).length / responses.length,
  };
  if (stats.alertas !== expected.alertas) fail("agregados", `${stats.codigo}: total de alertas inconsistente`);
  if (stats.criticas !== expected.criticas) fail("agregados", `${stats.codigo}: críticas inconsistentes`);
  if (stats.respuestaMediana !== expected.respuestaMediana) fail("agregados", `${stats.codigo}: mediana inconsistente`);
  if (Math.abs(stats.sla - expected.sla) > 1e-12) fail("agregados", `${stats.codigo}: SLA inconsistente`);
  const feature = zoneByCode.get(stats.codigo);
  if (feature?.properties.alertas !== stats.alertas) fail("agregados", `${stats.codigo}: GeoJSON y tabla difieren`);
}

const failureCount = Object.values(failures).reduce((sum, values) => sum + values.length, 0);
const dates = data.alertas.map((alert) => alert.fecha);
const audit = {
  escenario: data.metadata.versionEscenario,
  semilla: data.metadata.semilla,
  alertas: data.alertas.length,
  zonas: data.zonas.features.length,
  categorias: Object.fromEntries(categoryCounts),
  periodoObservado: [dates[0], dates.at(-1)],
  identificadoresUnicos: ids.size === data.alertas.length && codes.size === data.alertas.length,
  fallas: failureCount,
  detalleFallas: Object.fromEntries(Object.entries(failures).filter(([, values]) => values.length)),
};

console.log(JSON.stringify(audit, null, 2));
if (failureCount > 0) process.exitCode = 1;
