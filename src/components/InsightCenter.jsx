const TYPE_ICONS = {
  variacion: "↗",
  territorial: "⌖",
  respuesta: "◷",
  patron: "◐",
  modelo: "◇",
  cuidado: "♡",
};

export default function InsightCenter({ insights, comparison, onApply }) {
  if (!insights?.length && !comparison) return null;
  const previousLabel = comparison?.disponible && comparison?.periodoAnterior
    ? new Intl.DateTimeFormat("es-CL", {
        day: "2-digit",
        month: "short",
      }).formatRange(
        new Date(comparison.periodoAnterior.inicio),
        new Date(comparison.periodoAnterior.fin),
      )
    : null;

  return (
    <section className="insight-center" aria-labelledby="insight-title">
      <div className="insight-heading">
        <div>
          <span className="eyebrow">Lectura automática del período</span>
          <h2 id="insight-title">Hallazgos que requieren atención</h2>
        </div>
        {previousLabel && (
          <span className="comparison-period">
            Comparado con {previousLabel}
          </span>
        )}
        {comparison && !comparison.disponible && (
          <span className="comparison-period">Sin histórico equivalente</span>
        )}
      </div>
      <div className="insight-grid">
        {insights.map((insight) => (
          <article
            key={insight.id}
            className={`insight-card insight-${insight.nivel}`}
          >
            <span className="insight-icon" aria-hidden="true">
              {TYPE_ICONS[insight.tipo] ?? "◆"}
            </span>
            <div>
              <span className="insight-level">
                {insight.nivel === "alto"
                  ? "Atención prioritaria"
                  : insight.nivel === "positivo"
                    ? "Evolución favorable"
                    : "Señal relevante"}
              </span>
              <strong>{insight.titulo}</strong>
              <p>{insight.descripcion}</p>
              <button
                type="button"
                onClick={() => onApply(insight.filtros ?? {})}
              >
                Explorar evidencia <span>→</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
