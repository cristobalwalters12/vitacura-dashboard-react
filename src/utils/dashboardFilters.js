export function alertMatchesFilters(alert, filters, maximumDate) {
  const cutoff = new Date(maximumDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - filters.dias);
  if (new Date(alert.fecha) < cutoff) return false;
  if (filters.categoria !== "todas" && alert.categoria !== filters.categoria) return false;
  if (filters.zona && alert.zona !== filters.zona) return false;
  if (filters.prioridades.length && !filters.prioridades.includes(alert.prioridad)) return false;
  if (filters.severidades.length && !filters.severidades.includes(alert.severidad)) return false;
  if (filters.canales.length && !filters.canales.includes(alert.canal)) return false;
  if (
    typeof filters.requiereRevision === "boolean" &&
    alert.requiereRevision !== filters.requiereRevision
  ) {
    return false;
  }
  if (typeof filters.escalada === "boolean" && alert.escalada !== filters.escalada) return false;
  return true;
}

export function alertInBounds(alert, bbox) {
  if (!bbox?.length) return true;
  const [west, south, east, north] = bbox;
  const [longitude, latitude] = alert.coordenadas;
  return longitude >= west && longitude <= east && latitude >= south && latitude <= north;
}

export function toggleFilterValue(values, value) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function operationalFilterCount(filters) {
  return (
    Number(Boolean(filters.zona)) +
    filters.prioridades.length +
    filters.severidades.length +
    filters.canales.length +
    Number(typeof filters.requiereRevision === "boolean") +
    Number(typeof filters.escalada === "boolean")
  );
}
