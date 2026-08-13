const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const dataSource = apiBaseUrl ? "api" : "local";

let localSnapshotPromise;
const summaryCache = new Map();
const mapCache = new Map();
const analyticsCache = new Map();
const alertDetailCache = new Map();
const SUMMARY_CACHE_TTL = 5 * 60_000;
const MAP_CACHE_TTL = 30_000;
const DETAIL_CACHE_TTL = 5 * 60_000;

async function requestJson(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`No fue posible cargar ${url} (${response.status}).`);
  }
  return response.json();
}

export function buildQuery({
  dias,
  categoria,
  zona,
  prioridades = [],
  severidades = [],
  canales = [],
  requiereRevision,
  escalada,
  bbox,
}) {
  const params = new URLSearchParams({ dias: String(dias) });
  if (categoria && categoria !== "todas") {
    params.set("categoria", categoria);
  }
  if (zona) params.set("zona", zona);
  if (prioridades.length) params.set("prioridad", prioridades.join(","));
  if (severidades.length) params.set("severidad", severidades.join(","));
  if (canales.length) params.set("canal", canales.join(","));
  if (typeof requiereRevision === "boolean") {
    params.set("requiere_revision", String(requiereRevision));
  }
  if (typeof escalada === "boolean") {
    params.set("escalada", String(escalada));
  }
  if (bbox?.length === 4) {
    params.set("bbox", bbox.map((value) => Number(value).toFixed(5)).join(","));
  }
  return params.toString();
}

function validateLocalSnapshot(data) {
  if (!data?.metadata || !Array.isArray(data?.alertas)) {
    throw new Error("El snapshot local no contiene alertas válidas.");
  }
  if (data.zonas?.type !== "FeatureCollection") {
    throw new Error("El snapshot local no contiene las zonas.");
  }
  return data;
}

function mapApiAlert(alert) {
  return {
    id: alert.id,
    codigo: alert.codigo,
    coordenadas: alert.coordenadas,
    fecha: alert.fecha,
    categoria: alert.categoria,
    tipo: alert.tipo,
    severidad: alert.severidad,
    confianza: alert.confianza,
    requiereRevision: alert.requiere_revision,
    prioridad: alert.prioridad,
    puntajePrioridad: alert.puntaje_prioridad,
    canal: alert.canal,
    metodo: alert.metodo,
    respuestaSegundos: alert.respuesta_segundos,
    escalada: alert.escalada,
    zona: alert.zona,
    zonaNombre: alert.zona_nombre,
    calle: alert.calle,
    resultado: alert.resultado,
  };
}

function normalizeApiResponse(summary, map) {
  if (!summary?.metadata || !summary?.metricas || !summary?.zonas) {
    throw new Error("La API no entregó un resumen de dashboard válido.");
  }
  return {
    metadata: {
      sintetico: summary.metadata.sintetico,
      actualizadoEn: summary.metadata.actualizado_en,
      fechaCorte: summary.metadata.fecha_corte,
      periodo: summary.metadata.periodo,
      comuna: summary.metadata.comuna,
    },
    resumen: {
      usuarios: summary.resumen_operacional.usuarios,
      usuariosActivos: summary.resumen_operacional.usuarios_activos,
      dispositivos: summary.resumen_operacional.dispositivos,
      dispositivosActivos: summary.resumen_operacional.dispositivos_activos,
      bateriaBaja: summary.resumen_operacional.bateria_baja,
      perfilesCuidado: summary.resumen_operacional.perfiles_cuidado,
      dependenciaSevera: summary.resumen_operacional.dependencia_severa,
    },
    metricasServidor: {
      total: summary.metricas.total_alertas,
      critical: summary.metricas.alertas_criticas,
      medianResponse: summary.metricas.mediana_respuesta_segundos ?? 0,
      p90Response: summary.metricas.p90_respuesta_segundos ?? 0,
      sla: summary.metricas.cumplimiento_sla,
      smartwatch: summary.metricas.porcentaje_reloj,
      escalated: summary.metricas.escaladas_emergencia,
      automatic: summary.metricas.porcentaje_automatico,
    },
    categoriasServidor: summary.categorias.map((item) => ({
      name: item.categoria,
      value: item.total,
    })),
    tendenciaServidor: summary.tendencia.map((item) => ({
      date: item.fecha.slice(0, 10),
      total: item.total,
      critical: item.criticas,
    })),
    comparacionServidor: summary.comparacion
      ? {
          disponible: summary.comparacion.disponible,
          periodoAnterior: summary.comparacion.periodo_anterior,
          tendenciaAnterior: (summary.comparacion.tendencia_anterior ?? []).map(
            (item) => ({
              index: item.indice,
              date: item.fecha.slice(0, 10),
              total: item.total,
              critical: item.criticas,
            }),
          ),
          metricas: {
            total: summary.comparacion.metricas.total_alertas,
            critical: summary.comparacion.metricas.alertas_criticas,
            medianResponse:
              summary.comparacion.metricas.mediana_respuesta_segundos,
            sla: summary.comparacion.metricas.cumplimiento_sla,
            escalated: summary.comparacion.metricas.escaladas_emergencia,
          },
          categorias: summary.comparacion.categorias,
          zonas: summary.comparacion.zonas,
        }
      : null,
    hallazgosServidor: summary.hallazgos ?? [],
    zonas: summary.zonas,
    estadisticasZonas: summary.estadisticas_zonas.map((zone) => ({
      codigo: zone.codigo,
      nombre: zone.nombre,
      usuarios: zone.usuarios,
      alertas: zone.alertas,
      alertasPorMil: zone.alertas_por_mil,
      criticas: zone.criticas,
      respuestaMediana: zone.respuesta_mediana,
      sla: zone.cumplimiento_sla,
    })),
    alertas: map.alertas.map(mapApiAlert),
    mapa: map.metadata,
  };
}

function cachedRequest(cache, url, ttl) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.createdAt < ttl) return cached.promise;
  const entry = {
    createdAt: Date.now(),
    promise: requestJson(url).catch((error) => {
      cache.delete(url);
      throw error;
    }),
  };
  cache.set(url, entry);
  return entry.promise;
}

function withAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException("Solicitud cancelada", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Solicitud cancelada", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}

async function getLocalSnapshot() {
  if (!localSnapshotPromise) {
    const url = `${import.meta.env.BASE_URL}data/dashboard-data.json`;
    localSnapshotPromise = requestJson(url).then(validateLocalSnapshot);
  }
  return localSnapshotPromise;
}

function buildLocalAlertDetail(alert) {
  const createdAt = alert.creadoEn ?? alert.fecha;
  const response = alert.respuesta ?? {};
  const notifications = alert.notificaciones ?? {};
  const delivered = notifications.entregadas ?? 0;
  const notified = notifications.usuariosNotificados ?? 0;
  const confirmed = notifications.confirmadas ?? 0;
  const timeline = [
    ["activacion", "Activación", createdAt, 0],
    [
      "clasificacion",
      "Clasificación IA",
      alert.clasificadoEn,
      createdAt && alert.clasificadoEn
        ? Math.round(
            (Date.parse(alert.clasificadoEn) - Date.parse(createdAt)) / 1000,
          )
        : null,
    ],
    [
      "confirmacion",
      "Primera confirmación",
      alert.primeraConfirmacionEn,
      alert.respuestaSegundos,
    ],
    ["despacho", "Despacho", alert.despachadoEn, response.segundosDespacho],
    ["llegada", "Llegada", alert.llegadoEn, response.segundosLlegada],
    [
      "resolucion",
      "Resolución",
      alert.resueltoEn,
      response.segundosResolucion,
    ],
  ].map(([id, nombre, fecha, segundos_acumulados]) => ({
    id,
    nombre,
    fecha,
    segundos_acumulados,
    estado: fecha ? "completada" : "sin_registro",
  }));

  return {
    metadata: {
      sintetico: true,
      version_detalle: "local-1.0",
      privacidad:
        "Evento sintético sin datos personales; ubicación referida a la red vial pública.",
    },
    identificacion: {
      id: alert.id,
      codigo: alert.codigo,
      estado: alert.estado,
      creado_en: createdAt,
      actualizado_en: alert.resueltoEn,
    },
    ubicacion: {
      coordenadas: alert.coordenadas,
      precision_metros: 18,
      origen: alert.canal === "reloj_inteligente" ? "gps_reloj" : "gps_telefono",
      calle: alert.calle,
      zona: alert.zona,
      zona_nombre: alert.zonaNombre,
      fuente: "OpenStreetMap",
    },
    activacion: {
      canal: alert.canal,
      metodo: alert.metodo,
      version_aplicacion: "2.0.0-demo",
      dispositivo:
        alert.canal === "reloj_inteligente"
          ? {
              tipo: "reloj_inteligente",
              estado: "activo",
              fabricante: "Vita Demo",
              modelo: "Care Watch 2",
              version_firmware: "2.4.0-demo",
            }
          : null,
      evidencia: {
        audio_simulado: alert.metodo === "grabacion_voz",
        duracion_segundos: alert.metodo === "grabacion_voz" ? 12 : null,
        tipo_mime: alert.metodo === "grabacion_voz" ? "audio/ogg" : null,
        cifrado: true,
        solo_simulado: true,
      },
    },
    clasificacion: {
      categoria: alert.categoria,
      tipo: alert.tipo,
      severidad: alert.severidad,
      confianza: alert.confianza,
      nivel_confianza:
        alert.confianza >= 0.9 ? "alta" : alert.confianza >= 0.78 ? "media" : "baja",
      requiere_revision: alert.requiereRevision,
      modo_decision: alert.requiereRevision ? "revision_humana" : "automatica",
      modelo: {
        nombre: alert.modelo?.nombre,
        version: alert.modelo?.version,
        latencia_ms: alert.modelo?.latenciaMs,
      },
      clasificado_en: alert.clasificadoEn,
      transcripcion: {
        texto_anonimizado:
          alert.transcripcionAnonimizada ?? "Sin transcripción",
        idioma: "es-CL",
        confianza: alert.confianza,
        contiene_datos_sensibles: false,
        generado_en: alert.clasificadoEn,
      },
    },
    prioridad: {
      nivel: alert.prioridad,
      puntaje: alert.puntajePrioridad,
      razones: alert.razonesPrioridad ?? [],
    },
    persona_afectada: {
      tipo_perfil: "estandar",
      nivel_vulnerabilidad: "ninguna",
      cuidado: null,
    },
    operacion: {
      tipo_respondedor: response.tipoRespondedor,
      escalada_centro_emergencia: alert.escalada,
      etapas: timeline,
      segmentos: {
        confirmacion_a_despacho:
          Number.isFinite(response.segundosDespacho) &&
          Number.isFinite(alert.respuestaSegundos)
            ? response.segundosDespacho - alert.respuestaSegundos
            : null,
        despacho_a_llegada:
          Number.isFinite(response.segundosLlegada) &&
          Number.isFinite(response.segundosDespacho)
            ? response.segundosLlegada - response.segundosDespacho
            : null,
        llegada_a_resolucion:
          Number.isFinite(response.segundosResolucion) &&
          Number.isFinite(response.segundosLlegada)
            ? response.segundosResolucion - response.segundosLlegada
            : null,
      },
    },
    notificaciones: {
      comunidad_notificada: notifications.comunidadNotificada ?? false,
      usuarios_notificados: notified,
      entregadas: delivered,
      confirmadas: confirmed,
      tasa_entrega: notified ? delivered / notified : 0,
      tasa_confirmacion: delivered ? confirmed / delivered : 0,
    },
    resolucion: {
      resultado: alert.resultado,
      resuelto_en: alert.resueltoEn,
      codigo_notas: "DEMO_SIN_DATOS_PERSONALES",
    },
  };
}

export function getAlertDetail(alert, { signal } = {}) {
  if (!alert?.id) {
    return Promise.reject(new Error("La alerta seleccionada no tiene identificador."));
  }
  if (!apiBaseUrl) return Promise.resolve(buildLocalAlertDetail(alert));
  const url = `${apiBaseUrl}/api/v1/alertas/${encodeURIComponent(alert.id)}`;
  return withAbort(cachedRequest(alertDetailCache, url, DETAIL_CACHE_TTL), signal);
}

export async function getDashboardSnapshot({
  dias = 90,
  categoria = "todas",
  zona = null,
  prioridades = [],
  severidades = [],
  canales = [],
  requiereRevision = null,
  escalada = null,
  bbox = null,
  signal,
} = {}) {
  if (!apiBaseUrl) return getLocalSnapshot();

  const filters = {
    dias,
    categoria,
    zona,
    prioridades,
    severidades,
    canales,
    requiereRevision,
    escalada,
  };
  const summaryQuery = buildQuery(filters);
  const mapQuery = buildQuery({ ...filters, bbox });
  const summaryUrl = `${apiBaseUrl}/api/v1/dashboard/resumen?${summaryQuery}`;
  const mapUrl = `${apiBaseUrl}/api/v1/dashboard/mapa?${mapQuery}&limite=5000`;
  const [summary, map] = await Promise.all([
    withAbort(cachedRequest(summaryCache, summaryUrl, SUMMARY_CACHE_TTL), signal),
    withAbort(cachedRequest(mapCache, mapUrl, MAP_CACHE_TTL), signal),
  ]);
  return normalizeApiResponse(summary, map);
}

export function getDashboardAnalytics({
  dias = 90,
  categoria = "todas",
  zona = null,
  prioridades = [],
  severidades = [],
  canales = [],
  requiereRevision = null,
  escalada = null,
  signal,
} = {}) {
  if (!apiBaseUrl) return Promise.resolve(null);

  const query = buildQuery({
    dias,
    categoria,
    zona,
    prioridades,
    severidades,
    canales,
    requiereRevision,
    escalada,
  });
  const url = `${apiBaseUrl}/api/v1/dashboard/analitica?${query}`;
  return withAbort(
    cachedRequest(analyticsCache, url, SUMMARY_CACHE_TTL),
    signal,
  );
}
