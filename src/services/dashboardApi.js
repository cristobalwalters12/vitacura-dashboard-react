const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const dataSource = apiBaseUrl ? "api" : "local";

let localSnapshotPromise;

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

function buildQuery({ dias, categoria }) {
  const params = new URLSearchParams({ dias: String(dias) });
  if (categoria && categoria !== "todas") {
    params.set("categoria", categoria);
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
      periodo: summary.metadata.periodo,
      comuna: summary.metadata.comuna,
    },
    resumen: {
      usuarios: summary.resumen_operacional.usuarios,
      usuariosActivos: summary.resumen_operacional.usuarios_activos,
      dispositivos: summary.resumen_operacional.dispositivos,
      dispositivosActivos:
        summary.resumen_operacional.dispositivos_activos,
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

async function getLocalSnapshot() {
  if (!localSnapshotPromise) {
    const url = `${import.meta.env.BASE_URL}data/dashboard-data.json`;
    localSnapshotPromise = requestJson(url).then(validateLocalSnapshot);
  }
  return localSnapshotPromise;
}

export async function getDashboardSnapshot({
  dias = 90,
  categoria = "todas",
  signal,
} = {}) {
  if (!apiBaseUrl) return getLocalSnapshot();

  const query = buildQuery({ dias, categoria });
  const [summary, map] = await Promise.all([
    requestJson(`${apiBaseUrl}/api/v1/dashboard/resumen?${query}`, signal),
    requestJson(
      `${apiBaseUrl}/api/v1/dashboard/mapa?${query}&limite=5000`,
      signal,
    ),
  ]);
  return normalizeApiResponse(summary, map);
}
