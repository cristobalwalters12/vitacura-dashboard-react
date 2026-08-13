import { useState } from "react";
import {
  operationalFilterCount,
  toggleFilterValue,
} from "../utils/dashboardFilters.js";

const PRIORITIES = ["P1", "P2", "P3", "P4"];
const SEVERITIES = [
  ["critica", "Crítica"],
  ["alta", "Alta"],
  ["media", "Media"],
  ["baja", "Baja"],
];
const CHANNELS = [
  ["reloj_inteligente", "Smartwatch"],
  ["movil", "Aplicación móvil"],
  ["cuidador", "Cuidador"],
];

function FilterGroup({ label, values, options, onToggle }) {
  return (
    <fieldset className="filter-group">
      <legend>{label}</legend>
      <div className="filter-options">
        {options.map(([value, optionLabel]) => (
          <button
            key={value}
            type="button"
            aria-pressed={values.includes(value)}
            className={values.includes(value) ? "active" : ""}
            onClick={() => onToggle(value)}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function OperationalFilters({
  filters,
  zones,
  onChange,
  onClear,
}) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = operationalFilterCount(filters);

  return (
    <section className="operational-filters" aria-label="Filtros operacionales">
      <div className="operational-filter-bar">
        <label className="zone-filter">
          <span>Zona territorial</span>
          <select
            value={filters.zona ?? ""}
            onChange={(event) => onChange({ zona: event.target.value || null })}
          >
            <option value="">Todas las zonas</option>
            {zones.map((zone) => (
              <option key={zone.codigo} value={zone.codigo}>
                {zone.codigo} · {zone.nombre}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`advanced-filter-toggle ${expanded ? "open" : ""}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <span>Filtros operacionales</span>
          {activeCount > 0 && <b>{activeCount}</b>}
          <i aria-hidden="true">⌄</i>
        </button>
        {activeCount > 0 && (
          <button type="button" className="clear-filters" onClick={onClear}>
            Limpiar filtros
          </button>
        )}
      </div>

      {expanded && (
        <div className="advanced-filter-panel">
          <FilterGroup
            label="Prioridad"
            values={filters.prioridades}
            options={PRIORITIES.map((value) => [value, value])}
            onToggle={(value) =>
              onChange({
                prioridades: toggleFilterValue(filters.prioridades, value),
              })
            }
          />
          <FilterGroup
            label="Severidad"
            values={filters.severidades}
            options={SEVERITIES}
            onToggle={(value) =>
              onChange({
                severidades: toggleFilterValue(filters.severidades, value),
              })
            }
          />
          <FilterGroup
            label="Canal de activación"
            values={filters.canales}
            options={CHANNELS}
            onToggle={(value) =>
              onChange({ canales: toggleFilterValue(filters.canales, value) })
            }
          />
          <fieldset className="filter-group filter-switches">
            <legend>Condiciones</legend>
            <button
              type="button"
              aria-pressed={filters.requiereRevision === true}
              className={filters.requiereRevision === true ? "active" : ""}
              onClick={() =>
                onChange({
                  requiereRevision:
                    filters.requiereRevision === true ? null : true,
                })
              }
            >
              Revisión humana
            </button>
            <button
              type="button"
              aria-pressed={filters.escalada === true}
              className={filters.escalada === true ? "active" : ""}
              onClick={() =>
                onChange({ escalada: filters.escalada === true ? null : true })
              }
            >
              Escalada a emergencia
            </button>
          </fieldset>
        </div>
      )}
    </section>
  );
}
