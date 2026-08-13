export const CATEGORY = {
  medica: { label: "Médica", color: "#ef5b67" },
  seguridad: { label: "Seguridad", color: "#ffb84d" },
  incendio: { label: "Incendio", color: "#ff775c" },
  accidente: { label: "Accidente", color: "#9d8cff" },
  asistencia_cuidador: {
    label: "Asistencia cuidador",
    color: "#39d4c5",
  },
  asistencia_comunitaria: {
    label: "Asistencia comunitaria",
    color: "#6fd08c",
  },
  sin_clasificar: { label: "Sin clasificar", color: "#94a3b8" },
};

export const SEVERITY = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
  informativa: "Informativa",
};

export const PERIODS = [
  { value: 7, label: "7 días" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
  { value: 365, label: "12 meses" },
];

export const MAP_MODES = [
  { value: "calor", label: "Calor" },
  { value: "grupos", label: "Grupos" },
  { value: "zonas", label: "Zonas" },
];

export const MAP_STYLE_URL =
  import.meta.env.VITE_MAP_STYLE_URL ||
  "https://tiles.openfreemap.org/styles/liberty";

export const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2, P4: 3 };
