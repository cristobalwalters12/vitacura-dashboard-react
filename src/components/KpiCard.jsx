export default function KpiCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon,
}) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-heading">
        <span>{label}</span>
        <span className="kpi-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
