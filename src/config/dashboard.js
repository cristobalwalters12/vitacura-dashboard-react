export const CATEGORY = {
  medica: { label: "Médica", color: "#BA1A1A", darkColor: "#FFB4AB" },
  seguridad: { label: "Seguridad", color: "#F59E0B", darkColor: "#FBBF24" },
  incendio: { label: "Incendio", color: "#C2410C", darkColor: "#FF9D66" },
  accidente: { label: "Accidente", color: "#6750A4", darkColor: "#C4B5FD" },
  asistencia_cuidador: {
    label: "Asistencia cuidador",
    color: "#006970",
    darkColor: "#00EEFC",
  },
  asistencia_comunitaria: {
    label: "Asistencia comunitaria",
    color: "#10B981",
    darkColor: "#34D399",
  },
  sin_clasificar: {
    label: "Sin clasificar",
    color: "#45464D",
    darkColor: "#C0C4CC",
  },
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
