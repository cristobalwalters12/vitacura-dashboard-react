export const SCENARIO_VERSION = "3.0.0";
export const SCENARIO_SEED = 20260815;
export const ALERT_COUNT = 20_000;

export const PERIOD = {
  start: "2025-08-16T00:00:00.000Z",
  end: "2026-08-15T23:59:59.000Z",
};

export const CATEGORIES = {
  medica: {
    weight: 0.29,
    types: [
      "caida",
      "dolor_pecho",
      "dificultad_respiratoria",
      "desorientacion",
      "atencion_medica_general",
    ],
    severity: { baja: 0.08, media: 0.42, alta: 0.35, critica: 0.15 },
    confidence: 0.91,
  },
  seguridad: {
    weight: 0.25,
    types: [
      "actividad_sospechosa",
      "robo",
      "riesgo_domestico",
      "persona_seguida",
    ],
    severity: { baja: 0.12, media: 0.46, alta: 0.31, critica: 0.11 },
    confidence: 0.86,
  },
  incendio: {
    weight: 0.035,
    types: ["humo", "incendio_estructural", "incendio_vegetacion"],
    severity: { baja: 0.08, media: 0.34, alta: 0.37, critica: 0.21 },
    confidence: 0.74,
  },
  accidente: {
    weight: 0.08,
    types: [
      "accidente_transito",
      "accidente_peatonal",
      "accidente_domestico",
    ],
    severity: { baja: 0.09, media: 0.44, alta: 0.34, critica: 0.13 },
    confidence: 0.76,
  },
  asistencia_cuidador: {
    weight: 0.205,
    types: ["apoyo_cuidador", "control_omitido", "asistencia_movilidad"],
    severity: { baja: 0.22, media: 0.5, alta: 0.23, critica: 0.05 },
    confidence: 0.92,
  },
  asistencia_comunitaria: {
    weight: 0.14,
    types: [
      "persona_extraviada",
      "mascota_extraviada",
      "riesgo_espacio_publico",
      "asistencia_general",
    ],
    severity: { baja: 0.31, media: 0.48, alta: 0.17, critica: 0.04 },
    confidence: 0.85,
  },
};

export const ZONE_PROFILES = {
  "A-1": { volume: 0.94, response: 0.91 },
  "A-2": { volume: 1.02, response: 0.98 },
  "A-3": {
    volume: 0.97,
    response: 0.9,
    category: { asistencia_cuidador: 1.75 },
  },
  "A-4": { volume: 1.08, response: 1.05 },
  "A-5": {
    volume: 0.98,
    response: 0.96,
    category: { asistencia_cuidador: 1.6 },
  },
  "A-6": { volume: 1.06, response: 1.08 },
  "A-7": { volume: 1.18, response: 1.02, category: { medica: 1.35 } },
  "A-8": { volume: 0.93, response: 0.89 },
  "A-9": { volume: 1.13, response: 1.04, category: { medica: 1.18 } },
  "A-10": { volume: 1.05, response: 0.95 },
  "A-11": { volume: 0.99, response: 1.12 },
  "A-12": {
    volume: 0.9,
    response: 0.92,
    category: { seguridad: 1.75 },
  },
  "A-13": {
    volume: 0.92,
    response: 0.94,
    category: { seguridad: 1.55 },
  },
  "A-14": { volume: 1.14, response: 1.18, category: { accidente: 1.5 } },
  "A-15": { volume: 1.04, response: 1.06 },
};

export const STORIES = [
  {
    id: "medical_surge",
    title: "Aumento médico reciente",
    description:
      "A-7 y A-9 concentran un aumento de alertas médicas durante los últimos cinco días del período.",
    start: "2026-08-11",
    end: "2026-08-15",
    zones: ["A-7", "A-9"],
    category: "medica",
    multiplier: 9,
  },
  {
    id: "night_security_cluster",
    title: "Concentración nocturna de seguridad",
    description:
      "A-12 y A-13 presentan una concentración de incidentes de seguridad entre las 20:00 y las 03:59.",
    start: "2026-08-01",
    end: "2026-08-10",
    zones: ["A-12", "A-13"],
    category: "seguridad",
    hours: [20, 21, 22, 23, 0, 1, 2, 3],
    multiplier: 9,
    hourMultiplier: 3.2,
  },
  {
    id: "response_pressure",
    title: "Presión operacional localizada",
    description:
      "A-14 experimenta una degradación temporal de respuesta durante julio de 2026.",
    start: "2026-07-01",
    end: "2026-07-31",
    zones: ["A-14"],
    responseMultiplier: 4.8,
  },
  {
    id: "care_network",
    title: "Uso intensivo de la red de cuidado",
    description:
      "A-3 y A-5 muestran una mayor proporción de solicitudes de cuidadores, especialmente en horario diurno.",
    zones: ["A-3", "A-5"],
    category: "asistencia_cuidador",
    hours: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    multiplier: 1.7,
  },
  {
    id: "classification_challenge",
    title: "Casos que requieren revisión humana",
    description:
      "Incendios y accidentes concentran menor confianza del modelo y una mayor tasa de revisión humana.",
    categories: ["incendio", "accidente"],
  },
];

export const STREETS = [
  "Avenida Vitacura",
  "Avenida Kennedy",
  "Avenida Las Condes",
  "Avenida Santa María",
  "Las Hualtatas",
  "Luis Pasteur",
  "Gerónimo de Alderete",
  "Padre Hurtado Norte",
  "Tabancura",
  "Manquehue Norte",
  "Lo Beltrán",
  "Candelaria Goyenechea",
  "Camino El Alba",
  "Camino La Fuente",
  "Escrivá de Balaguer",
  "Nueva Costanera",
  "El Coihue",
  "Los Acantos",
];

export const TRANSCRIPTIONS = {
  medica: "Necesito asistencia médica en un punto público de la comuna.",
  seguridad: "Se observa una situación de seguridad que requiere verificación.",
  incendio: "Hay indicios de humo o fuego y se solicita evaluación inmediata.",
  accidente: "Se reporta un accidente y se requiere apoyo en el lugar.",
  asistencia_cuidador: "El cuidador solicita apoyo para asistir a la persona a su cargo.",
  asistencia_comunitaria: "Se solicita colaboración de la comunidad en el sector.",
};
