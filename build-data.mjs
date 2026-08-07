import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = resolve(
  projectDirectory,
  "../vitacura-mock-data/generated_es",
);

async function readJsonLines(fileName) {
  const values = [];
  const stream = createReadStream(join(sourceDirectory, fileName), {
    encoding: "utf8",
  });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of lines) {
    if (line.trim()) values.push(JSON.parse(line));
  }

  return values;
}

const objectId = (value) => value?.$oid ?? value ?? null;
const dateValue = (value) => value?.$date ?? value ?? null;
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const [
  manifest,
  zones,
  rawAlerts,
  users,
  devices,
  careProfiles,
] = await Promise.all([
  Promise.resolve(
    JSON.parse(readFileSync(join(sourceDirectory, "manifest.json"), "utf8")),
  ),
  readJsonLines("zonas.jsonl"),
  readJsonLines("alertas.jsonl"),
  readJsonLines("usuarios.jsonl"),
  readJsonLines("dispositivos.jsonl"),
  readJsonLines("perfiles_cuidado.jsonl"),
]);

const zoneById = new Map(
  zones.map((zone) => [objectId(zone._id), { code: zone.codigo, name: zone.nombre }]),
);

const alerts = rawAlerts
  .map((alert) => {
    const coordinates = alert.ubicacion?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;

    const zone = zoneById.get(objectId(alert.id_zona));
    return {
      id: objectId(alert._id),
      codigo: alert.codigo_alerta,
      coordenadas: coordinates.map((value) => Number(value.toFixed(6))),
      fecha: dateValue(alert.creado_en),
      categoria: alert.clasificacion?.categoria ?? "sin_clasificar",
      tipo: alert.clasificacion?.tipo ?? "sin_clasificar",
      severidad: alert.clasificacion?.severidad ?? "sin_clasificar",
      confianza: alert.clasificacion?.confianza ?? null,
      requiereRevision: Boolean(alert.clasificacion?.requiere_revision_humana),
      prioridad: alert.prioridad?.nivel ?? "P4",
      puntajePrioridad: alert.prioridad?.puntaje ?? 0,
      canal: alert.origen?.canal ?? "desconocido",
      metodo: alert.origen?.metodo_activacion ?? "desconocido",
      respuestaSegundos:
        alert.resumen_respuesta?.segundos_primera_respuesta ?? null,
      escalada: Boolean(alert.resumen_respuesta?.escalada_centro_emergencia),
      zona: zone?.code ?? alert.ubicacion?.referencia_ubicacion?.codigo_zona,
      zonaNombre: zone?.name ?? "Zona sin identificar",
      calle: alert.ubicacion?.referencia_ubicacion?.nombre_calle ?? "Sin referencia",
      resultado: alert.resolucion?.resultado ?? null,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.fecha.localeCompare(b.fecha));

const userCountByZone = new Map();
for (const user of users) {
  const zoneId = objectId(user.id_zona_hogar);
  userCountByZone.set(zoneId, (userCountByZone.get(zoneId) ?? 0) + 1);
}

const zoneStats = zones.map((zone) => {
  const zoneId = objectId(zone._id);
  const zoneAlerts = alerts.filter((alert) => alert.zona === zone.codigo);
  const responses = zoneAlerts
    .map((alert) => alert.respuestaSegundos)
    .filter(Number.isFinite);
  const registeredUsers = userCountByZone.get(zoneId) ?? 0;

  return {
    codigo: zone.codigo,
    nombre: zone.nombre,
    usuarios: registeredUsers,
    alertas: zoneAlerts.length,
    alertasPorMil:
      registeredUsers > 0
        ? Number(((zoneAlerts.length / registeredUsers) * 1000).toFixed(1))
        : 0,
    criticas: zoneAlerts.filter((alert) => alert.prioridad === "P1").length,
    respuestaMediana: median(responses),
    sla:
      responses.length > 0
        ? responses.filter((value) => value <= 300).length / responses.length
        : 0,
  };
});

const zoneFeatures = zones.map((zone) => {
  const stats = zoneStats.find((item) => item.codigo === zone.codigo);
  return {
    type: "Feature",
    properties: {
      codigo: zone.codigo,
      nombre: zone.nombre,
      alertas: stats.alertas,
      usuarios: stats.usuarios,
      alertasPorMil: stats.alertasPorMil,
      sla: Number((stats.sla * 100).toFixed(1)),
    },
    geometry: zone.geometria,
  };
});

const categorySummary = Object.entries(
  alerts.reduce((accumulator, alert) => {
    accumulator[alert.categoria] = (accumulator[alert.categoria] ?? 0) + 1;
    return accumulator;
  }, {}),
)
  .map(([categoria, total]) => ({ categoria, total }))
  .sort((a, b) => b.total - a.total);

const output = {
  metadata: {
    nombre: manifest.conjunto_datos,
    sintetico: manifest.sintetico,
    actualizadoEn: manifest.periodo.fin,
    periodo: manifest.periodo,
    fuenteCoordenadas: "OpenStreetMap",
    comuna: "Vitacura",
    region: "Región Metropolitana",
  },
  resumen: {
    usuarios: users.length,
    usuariosActivos: users.filter((user) => user.activo).length,
    dispositivos: devices.length,
    dispositivosActivos: devices.filter((device) => device.estado === "activo").length,
    bateriaBaja: devices.filter(
      (device) => (device.ultimo_estado_conocido?.porcentaje_bateria ?? 100) <= 20,
    ).length,
    perfilesCuidado: careProfiles.filter((profile) => profile.activo).length,
    dependenciaSevera: careProfiles.filter(
      (profile) => profile.perfil_cuidado?.nivel_dependencia === "severa",
    ).length,
  },
  categorias: categorySummary,
  zonas: {
    type: "FeatureCollection",
    features: zoneFeatures,
  },
  estadisticasZonas: zoneStats,
  alertas: alerts,
};

const dataDirectory = join(projectDirectory, "public", "data");
mkdirSync(dataDirectory, { recursive: true });
const serialized = JSON.stringify(output);
writeFileSync(
  join(dataDirectory, "dashboard-data.json"),
  `${serialized}\n`,
  "utf8",
);

console.log(
  `Dashboard preparado: ${alerts.length.toLocaleString("es-CL")} alertas, ` +
    `${zones.length} zonas y ${users.length.toLocaleString("es-CL")} usuarios.`,
);
