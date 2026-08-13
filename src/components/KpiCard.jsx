export default function KpiCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon,
  comparison,
  inverse = false,
}) {
  const favorable = comparison
    ? comparison.direccion === "estable" ||
      (inverse
        ? comparison.direccion === "baja"
        : comparison.direccion === "sube")
    : false;
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-heading">
        <span>{label}</span>
        <span className="kpi-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <strong>{value}</strong>
      {comparison && (
        <span
          className={`kpi-comparison ${comparison.direccion} ${favorable ? "favorable" : "adverse"}`}
        >
          {comparison.direccion === "sube"
            ? "↑"
            : comparison.direccion === "baja"
              ? "↓"
              : "→"}{" "}
          {Math.abs(comparison.porcentaje).toFixed(1)}% vs. período anterior
        </span>
      )}
      <small>{detail}</small>
    </article>
  );
}
