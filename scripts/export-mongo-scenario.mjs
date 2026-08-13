import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const snapshot = JSON.parse(
  readFileSync(new URL("../public/data/dashboard-data.json", import.meta.url), "utf8"),
);
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
const outputDirectory = resolve(outputArgument?.slice("--output=".length) || "generated-mongo");

const MUNICIPALITY_ID = "64f000000000000000000132";
const ORGANIZATION_ID = "64f000000000000000000001";
const objectId = (value) => ({ $oid: value });
const bsonDate = (value) => ({ $date: value });
const deterministicId = (group, index) =>
  `${group.toString(16).padStart(2, "0")}${index.toString(16).padStart(22, "0")}`;

const zones = snapshot.zonas.features.map((feature, index) => ({
  _id: objectId(deterministicId(1, index + 1)),
  id_organizacion: objectId(ORGANIZATION_ID),
  id_municipalidad: objectId(MUNICIPALITY_ID),
  codigo: feature.properties.codigo,
  nombre: feature.properties.nombre,
  centroide: {
    type: "Point",
    coordinates: feature.geometry.coordinates.flat(3).reduce(
      (center, value, coordinateIndex, coordinates) => {
        if (typeof value !== "number") return center;
        center[coordinateIndex % 2] += value / (coordinates.length / 2);
        return center;
      },
      [0, 0],
    ),
  },
  geometria: feature.geometry,
  fuente_geometria: snapshot.metadata.fuenteCoordenadas,
  nombre_capa_origen: "unidades_vecinales_demo",
  peso_distribucion: 1,
  precision_geometria: "demostrativa",
  sintetico: true,
}));
const zoneIdByCode = new Map(zones.map((zone) => [zone.codigo, zone._id.$oid]));

const users = [];
let userIndex = 0;
for (const feature of snapshot.zonas.features) {
  for (let zoneUserIndex = 0; zoneUserIndex < feature.properties.usuarios; zoneUserIndex += 1) {
    userIndex += 1;
    const careProfile = userIndex <= snapshot.resumen.perfilesCuidado;
    const severe = userIndex <= snapshot.resumen.dependenciaSevera;
    users.push({
      _id: objectId(deterministicId(2, userIndex)),
      id_organizacion: objectId(ORGANIZATION_ID),
      id_municipalidad: objectId(MUNICIPALITY_ID),
      codigo_sintetico: `USR-DEMO-${String(userIndex).padStart(5, "0")}`,
      tipo_perfil: careProfile ? (severe ? "persona_dependiente" : "adulto_mayor") : "estandar",
      anio_nacimiento: careProfile ? (severe ? 1942 : 1954) : 1981,
      rango_edad: careProfile ? (severe ? "80+" : "65-79") : "40-64",
      nivel_vulnerabilidad: severe ? "dependencia_severa" : careProfile ? "media" : "ninguna",
      id_zona_hogar: objectId(zoneIdByCode.get(feature.properties.codigo)),
      consentimiento: {
        compartir_ubicacion: true,
        alertas_comunitarias: true,
        tratamiento_datos_salud: careProfile,
        version: "demo-2.0",
        otorgado_en: bsonDate(snapshot.metadata.periodo.inicio),
      },
      activo: userIndex <= snapshot.resumen.usuariosActivos,
      sintetico: true,
      creado_en: bsonDate(snapshot.metadata.periodo.inicio),
      actualizado_en: bsonDate(snapshot.metadata.actualizadoEn),
    });
  }
}

const devices = Array.from({ length: snapshot.resumen.dispositivos }, (_, index) => {
  const position = index + 1;
  const active = position <= snapshot.resumen.dispositivosActivos;
  const lowBattery = position <= snapshot.resumen.bateriaBaja;
  const user = users[index];
  const zone = zones.find((item) => item._id.$oid === user.id_zona_hogar.$oid);
  return {
    _id: objectId(deterministicId(3, position)),
    id_organizacion: objectId(ORGANIZATION_ID),
    id_municipalidad: objectId(MUNICIPALITY_ID),
    numero_serie: `VITA-DEMO-${String(position).padStart(6, "0")}`,
    tipo: "reloj_inteligente",
    fabricante: "Vita Demo",
    modelo: "Care Watch 2",
    version_firmware: "2.4.0-demo",
    id_usuario_asignado: user._id,
    estado: active ? "activo" : "sin_conexion",
    capacidades: {
      gps: true,
      grabacion_audio: true,
      vibracion: true,
      frecuencia_cardiaca: true,
      acelerometro: true,
      deteccion_caidas: true,
      celular: true,
    },
    ultimo_estado_conocido: {
      porcentaje_bateria: lowBattery ? 14 : 72,
      conectividad: active ? "lte" : "ninguna",
      intensidad_senal: active ? 78 : 0,
      visto_por_ultima_vez_en: bsonDate(snapshot.metadata.actualizadoEn),
      ubicacion: {
        type: "Point",
        coordinates: zone.centroide.coordinates,
        precision_metros: 20,
        origen: "gps_reloj",
        capturado_en: bsonDate(snapshot.metadata.actualizadoEn),
      },
    },
    activado_en: bsonDate(snapshot.metadata.periodo.inicio),
    sintetico: true,
    creado_en: bsonDate(snapshot.metadata.periodo.inicio),
    actualizado_en: bsonDate(snapshot.metadata.actualizadoEn),
  };
});
const deviceByUserId = new Map(
  devices.map((device) => [device.id_usuario_asignado.$oid, device]),
);
const careUsers = users.slice(0, snapshot.resumen.perfilesCuidado);

const careProfiles = Array.from({ length: snapshot.resumen.perfilesCuidado }, (_, index) => {
  const position = index + 1;
  const severe = position <= snapshot.resumen.dependenciaSevera;
  const primaryCaregiver = users[(position + snapshot.resumen.perfilesCuidado) % users.length];
  return {
    _id: objectId(deterministicId(4, position)),
    version_esquema: 1,
    id_organizacion: objectId(ORGANIZATION_ID),
    id_municipalidad: objectId(MUNICIPALITY_ID),
    id_usuario: users[index]._id,
    perfil_cuidado: {
      nivel_dependencia: severe ? "severa" : position % 2 ? "moderada" : "leve",
      movilidad: severe ? "asistida" : "independiente",
      vive_solo: position % 4 === 0,
      limitaciones_comunicacion: severe ? ["audicion"] : [],
      factores_riesgo: severe ? ["riesgo_caida", "desorientacion"] : ["riesgo_caida"],
    },
    plan_emergencia: {
      id_cuidador_principal: primaryCaregiver._id,
      ids_cuidadores_respaldo: [],
      orden_escalamiento: ["cuidador", "centro_salud", "seguridad_municipal"],
    },
    consentimiento: users[index].consentimiento,
    activo: true,
    sintetico: true,
    creado_en: bsonDate(snapshot.metadata.periodo.inicio),
    actualizado_en: bsonDate(snapshot.metadata.actualizadoEn),
  };
});

const alerts = snapshot.alertas.map((alert, index) => {
  const affectedUser =
    alert.categoria === "asistencia_cuidador"
      ? careUsers[index % careUsers.length]
      : users[index % users.length];
  const device =
    alert.canal === "reloj_inteligente"
      ? deviceByUserId.get(affectedUser._id.$oid) ?? devices[index % devices.length]
      : null;
  return {
    _id: objectId(alert.id),
    version_esquema: 2,
    id_organizacion: objectId(ORGANIZATION_ID),
    id_municipalidad: objectId(MUNICIPALITY_ID),
    id_comunidad: objectId(deterministicId(5, 1)),
    codigo_alerta: alert.codigo,
    origen: {
      canal: alert.canal,
      id_dispositivo: device?._id ?? null,
      version_aplicacion: "2.0.0-demo",
      metodo_activacion: alert.metodo,
    },
    persona_afectada: {
      id_usuario: affectedUser._id,
      tipo_perfil: affectedUser.tipo_perfil,
      nivel_vulnerabilidad: affectedUser.nivel_vulnerabilidad,
    },
    reportante: {
      id_usuario: affectedUser._id,
      relacion: alert.canal === "cuidador" ? "cuidador" : "titular",
    },
    ubicacion: {
      type: "Point",
      coordinates: alert.coordenadas,
      precision_metros: 18,
      origen: alert.canal === "reloj_inteligente" ? "gps_reloj" : "gps_telefono",
      capturado_en: bsonDate(alert.creadoEn),
      referencia_ubicacion: {
        id: `OSM-DEMO-${index + 1}`,
        coordinates: alert.coordenadas,
        codigo_zona: alert.zona,
        nombre_zona: alert.zonaNombre,
        nombre_calle: alert.calle,
        tipo_via: "via_publica",
        id_via_osm: index + 1,
        origen: "OpenStreetMap",
      },
    },
    id_zona: objectId(zoneIdByCode.get(alert.zona)),
    codigo_comuna: "13132",
    multimedia: {
      clave_objeto_audio: alert.metodo === "grabacion_voz" ? `demo/${alert.id}.enc` : null,
      duracion_segundos: alert.metodo === "grabacion_voz" ? 12 : null,
      tipo_mime: alert.metodo === "grabacion_voz" ? "audio/ogg" : null,
      cifrado: true,
      solo_simulado: true,
    },
    transcripcion: {
      texto_anonimizado: alert.transcripcionAnonimizada,
      idioma: "es-CL",
      confianza: alert.confianza,
      contiene_datos_sensibles: false,
      generado_en: bsonDate(alert.clasificadoEn),
    },
    clasificacion: {
      categoria: alert.categoria,
      tipo: alert.tipo,
      severidad: alert.severidad,
      confianza: alert.confianza,
      nombre_modelo: alert.modelo.nombre,
      version_modelo: alert.modelo.version,
      latencia_ms: alert.modelo.latenciaMs,
      clasificado_en: bsonDate(alert.clasificadoEn),
      requiere_revision_humana: alert.requiereRevision,
    },
    estado: alert.estado,
    prioridad: {
      puntaje: alert.puntajePrioridad,
      nivel: alert.prioridad,
      razones: alert.razonesPrioridad,
    },
    resumen_notificaciones: {
      comunidad_notificada: alert.notificaciones.comunidadNotificada,
      usuarios_notificados: alert.notificaciones.usuariosNotificados,
      entregadas: alert.notificaciones.entregadas,
      confirmadas: alert.notificaciones.confirmadas,
    },
    resumen_respuesta: {
      primera_confirmacion_en: bsonDate(alert.primeraConfirmacionEn),
      segundos_primera_respuesta: alert.respuestaSegundos,
      despachado_en: bsonDate(alert.despachadoEn),
      llegado_en: bsonDate(alert.llegadoEn),
      resuelto_en: bsonDate(alert.resueltoEn),
      segundos_clasificacion: Math.round(
        (Date.parse(alert.clasificadoEn) - Date.parse(alert.creadoEn)) / 1_000,
      ),
      segundos_despacho: alert.respuesta.segundosDespacho,
      segundos_llegada: alert.respuesta.segundosLlegada,
      segundos_resolucion: alert.respuesta.segundosResolucion,
      segundos_confirmacion_a_despacho:
        alert.respuesta.segundosDespacho - alert.respuestaSegundos,
      segundos_despacho_a_llegada:
        alert.respuesta.segundosLlegada - alert.respuesta.segundosDespacho,
      segundos_llegada_a_resolucion:
        alert.respuesta.segundosResolucion - alert.respuesta.segundosLlegada,
      tipo_respondedor: alert.respuesta.tipoRespondedor,
      id_equipo_asignado: objectId(deterministicId(6, (index % 18) + 1)),
      escalada_centro_emergencia: alert.escalada,
    },
    resolucion: {
      resultado: alert.resultado,
      resuelto_en: bsonDate(alert.resueltoEn),
      resuelto_por: objectId(deterministicId(7, (index % 36) + 1)),
      codigo_notas: "DEMO_SIN_DATOS_PERSONALES",
    },
    sintetico: true,
    creado_en: bsonDate(alert.creadoEn),
    actualizado_en: bsonDate(alert.resueltoEn),
  };
});

const collections = {
  zonas: zones,
  usuarios: users,
  dispositivos: devices,
  perfiles_cuidado: careProfiles,
  alertas: alerts,
};

mkdirSync(outputDirectory, { recursive: true });
for (const [name, documents] of Object.entries(collections)) {
  writeFileSync(
    resolve(outputDirectory, `${name}.jsonl`),
    `${documents.map((document) => JSON.stringify(document)).join("\n")}\n`,
    "utf8",
  );
}

const manifest = {
  escenario: snapshot.metadata.versionEscenario,
  semilla: snapshot.metadata.semilla,
  id_municipalidad: MUNICIPALITY_ID,
  base_sugerida: "community_sos_demo_v3",
  colecciones: Object.fromEntries(
    Object.entries(collections).map(([name, documents]) => [name, documents.length]),
  ),
  nota: "Exportación Extended JSON sintética. No importar sobre datos existentes sin revisar el destino.",
};
writeFileSync(resolve(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ directorio: outputDirectory, ...manifest }, null, 2));
