import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const inputArgument = process.argv.find((argument) => argument.startsWith("--input="));
const inputDirectory = resolve(inputArgument?.slice("--input=".length) || "generated-mongo");
const snapshot = JSON.parse(
  readFileSync(new URL("../public/data/dashboard-data.json", import.meta.url), "utf8"),
);

function readJsonLines(name) {
  return readFileSync(resolve(inputDirectory, `${name}.jsonl`), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function countBy(values, selector) {
  const counts = new Map();
  for (const value of values) {
    const key = selector(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const collections = {
  zonas: readJsonLines("zonas"),
  usuarios: readJsonLines("usuarios"),
  dispositivos: readJsonLines("dispositivos"),
  perfiles_cuidado: readJsonLines("perfiles_cuidado"),
  alertas: readJsonLines("alertas"),
};
const failures = [];
const expectEqual = (label, actual, expected) => {
  if (actual !== expected) failures.push(`${label}: ${actual} !== ${expected}`);
};

expectEqual("zonas", collections.zonas.length, snapshot.zonas.features.length);
expectEqual("usuarios", collections.usuarios.length, snapshot.resumen.usuarios);
expectEqual("usuarios activos", collections.usuarios.filter((item) => item.activo).length, snapshot.resumen.usuariosActivos);
expectEqual("dispositivos", collections.dispositivos.length, snapshot.resumen.dispositivos);
expectEqual("dispositivos activos", collections.dispositivos.filter((item) => item.estado === "activo").length, snapshot.resumen.dispositivosActivos);
expectEqual(
  "batería baja",
  collections.dispositivos.filter((item) => item.ultimo_estado_conocido.porcentaje_bateria <= 20).length,
  snapshot.resumen.bateriaBaja,
);
expectEqual("perfiles activos", collections.perfiles_cuidado.filter((item) => item.activo).length, snapshot.resumen.perfilesCuidado);
expectEqual(
  "dependencia severa",
  collections.perfiles_cuidado.filter((item) => item.perfil_cuidado.nivel_dependencia === "severa").length,
  snapshot.resumen.dependenciaSevera,
);
expectEqual("alertas", collections.alertas.length, snapshot.alertas.length);
expectEqual(
  "hitos operacionales completos",
  collections.alertas.filter(
    (item) =>
      item.resumen_respuesta?.despachado_en?.$date &&
      item.resumen_respuesta?.llegado_en?.$date &&
      item.resumen_respuesta?.resuelto_en?.$date &&
      Number.isFinite(item.resumen_respuesta?.segundos_clasificacion) &&
      Number.isFinite(item.resumen_respuesta?.segundos_despacho) &&
      Number.isFinite(item.resumen_respuesta?.segundos_llegada) &&
      Number.isFinite(item.resumen_respuesta?.segundos_resolucion),
  ).length,
  snapshot.alertas.length,
);
expectEqual(
  "latencia de clasificación",
  collections.alertas.filter((item) =>
    Number.isFinite(item.clasificacion?.latencia_ms),
  ).length,
  snapshot.alertas.length,
);
const careUserIds = new Set(
  collections.perfiles_cuidado.map((profile) => profile.id_usuario.$oid),
);
const deviceIds = new Set(
  collections.dispositivos.map((device) => device._id.$oid),
);
const careAlerts = collections.alertas.filter(
  (alert) => alert.clasificacion.categoria === "asistencia_cuidador",
);
expectEqual(
  "alertas de cuidado contextualizadas",
  careAlerts.filter((alert) =>
    careUserIds.has(alert.persona_afectada?.id_usuario?.$oid),
  ).length,
  careAlerts.length,
);
const watchAlerts = collections.alertas.filter(
  (alert) => alert.origen.canal === "reloj_inteligente",
);
expectEqual(
  "alertas smartwatch con dispositivo",
  watchAlerts.filter((alert) =>
    deviceIds.has(alert.origen.id_dispositivo?.$oid),
  ).length,
  watchAlerts.length,
);

const snapshotCategories = countBy(snapshot.alertas, (alert) => alert.categoria);
const mongoCategories = countBy(collections.alertas, (alert) => alert.clasificacion.categoria);
for (const [category, total] of snapshotCategories) {
  expectEqual(`categoría ${category}`, mongoCategories.get(category) ?? 0, total);
}

const snapshotZones = countBy(snapshot.alertas, (alert) => alert.zona);
const mongoZones = countBy(
  collections.alertas,
  (alert) => alert.ubicacion.referencia_ubicacion.codigo_zona,
);
for (const [zone, total] of snapshotZones) {
  expectEqual(`zona ${zone}`, mongoZones.get(zone) ?? 0, total);
}

const snapshotCritical = snapshot.alertas.filter((alert) => alert.prioridad === "P1").length;
const mongoCritical = collections.alertas.filter((alert) => alert.prioridad.nivel === "P1").length;
expectEqual("alertas críticas", mongoCritical, snapshotCritical);
const snapshotEscalated = snapshot.alertas.filter((alert) => alert.escalada).length;
const mongoEscalated = collections.alertas.filter(
  (alert) => alert.resumen_respuesta.escalada_centro_emergencia,
).length;
expectEqual("escaladas", mongoEscalated, snapshotEscalated);

console.log(
  JSON.stringify(
    {
      directorio: inputDirectory,
      escenario: snapshot.metadata.versionEscenario,
      documentos: Object.fromEntries(
        Object.entries(collections).map(([name, documents]) => [name, documents.length]),
      ),
      equivalencia: failures.length === 0,
      fallas: failures,
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
