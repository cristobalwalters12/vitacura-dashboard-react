import { CATEGORY } from "../config/dashboard.js";

export const formatNumber = new Intl.NumberFormat("es-CL");

export const formatCompact = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatDate = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function categoryInfo(category, theme = "light") {
  const item = CATEGORY[category] ?? {
    label: category.replaceAll("_", " "),
    color: "#45464D",
    darkColor: "#C0C4CC",
  };
  return {
    ...item,
    color: theme === "dark" ? item.darkColor : item.color,
  };
}

export function humanize(value, fallback = "Sin registro") {
  return value ? value.replaceAll("_", " ") : fallback;
}
