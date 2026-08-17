import { useEffect, useMemo, useState } from "react";

const COLORS = [
  {
    token: "--c-secondary",
    name: "Cyan eléctrico / Radar",
    usage: "Navegación, rutas, foco y estados activos",
    light: "#006970",
    dark: "#00EEFC",
  },
  {
    token: "--c-primary",
    name: "Primario / Zen",
    usage: "Texto de máximo contraste y acciones principales",
    light: "#000000",
    dark: "#FFFFFF",
  },
  {
    token: "--c-secondary-fixed",
    name: "Cyan suave",
    usage: "Fondos de énfasis, nunca texto sobre blanco",
    light: "#7DF4FF",
    dark: "#00383B",
  },
  {
    token: "--c-primary-container",
    name: "Deep Navy Container",
    usage: "Contenedores de marca y visualizaciones inmersivas",
    light: "#131B2E",
    dark: "#1B2847",
  },
  {
    token: "--c-background",
    name: "Fondo base",
    usage: "Lienzo principal de la experiencia",
    light: "#FFFFFF",
    dark: "#0A0C0F",
  },
  {
    token: "--c-surface-container",
    name: "Superficie de tarjeta",
    usage: "Tarjetas, paneles y agrupaciones",
    light: "#E6E8EA",
    dark: "#151A1D",
  },
  {
    token: "--c-on-surface",
    name: "Texto principal",
    usage: "Títulos, datos y contenido prioritario",
    light: "#191C1E",
    dark: "#E1E3E5",
  },
  {
    token: "--c-on-surface-variant",
    name: "Texto secundario",
    usage: "Metadatos, ayuda y subtítulos",
    light: "#45464D",
    dark: "#C0C4CC",
  },
  {
    token: "--c-outline-variant",
    name: "Borde y divisor",
    usage: "Separadores y contornos de baja jerarquía",
    light: "#C6C6CD",
    dark: "#45494D",
  },
  {
    token: "--c-error",
    name: "SOS / Crítico",
    usage: "Emergencias, fallos y transmisión activa",
    light: "#BA1A1A",
    dark: "#FFB4AB",
  },
  {
    token: "--c-success",
    name: "Online / Disponible",
    usage: "Conexión y operación saludable",
    light: "#10B981",
    dark: "#34D399",
  },
  {
    token: "--c-warning",
    name: "Advertencia",
    usage: "Riesgo medio, privacidad y atención preventiva",
    light: "#F59E0B",
    dark: "#FBBF24",
  },
];

const TYPE_SCALE = [
  ["headline-lg", "36 px", "300", "+0.04em", "Panorama comunitario"],
  ["headline-md", "24 px", "300", "+0.03em", "Respuesta territorial"],
  ["body-lg", "16 px", "400", "normal", "Analítica clara para decisiones humanas."],
  ["body-md", "14 px", "400", "normal", "Contexto operacional y trazabilidad de cada alerta."],
  ["label-caps", "10 px", "500", "+0.15em", "ESTADO OPERACIONAL"],
];

function Brand() {
  return (
    <div className="brand design-brand">
      <div className="brand-mark" aria-hidden="true"><i /></div>
      <div>
        <strong>Lyngus Halo</strong>
        <span>Inteligencia que cuida</span>
      </div>
    </div>
  );
}

function ThemeControl({ theme, onThemeChange, compact = false }) {
  return (
    <div className={`theme-control ${compact ? "compact" : ""}`} aria-label="Tema visual">
      <button
        type="button"
        className={theme === "light" ? "selected" : ""}
        onClick={() => onThemeChange("light")}
        aria-pressed={theme === "light"}
      >
        <span aria-hidden="true">☼</span>{!compact && "Claro"}
      </button>
      <button
        type="button"
        className={theme === "dark" ? "selected" : ""}
        onClick={() => onThemeChange("dark")}
        aria-pressed={theme === "dark"}
      >
        <span aria-hidden="true">◐</span>{!compact && "Oscuro"}
      </button>
    </div>
  );
}

function DesignPageShell({
  active,
  title,
  eyebrow,
  description,
  theme,
  onThemeChange,
  onNavigate,
  children,
}) {
  return (
    <div className="app-shell design-app-shell">
      <a className="skip-link" href="#design-content">Saltar al contenido</a>
      <aside className="sidebar design-sidebar">
        <Brand />
        <nav aria-label="Navegación de diseño">
          <a href="/" onClick={(event) => { event.preventDefault(); onNavigate("/"); }}>
            <span>⌂</span>Dashboard
          </a>
          <a
            className={active === "styleguide" ? "active" : ""}
            href="/styleguide"
            onClick={(event) => { event.preventDefault(); onNavigate("/styleguide"); }}
          >
            <span>◈</span>Paleta & Tipografía
          </a>
          <a
            className={active === "settings" ? "active" : ""}
            href="/settings"
            onClick={(event) => { event.preventDefault(); onNavigate("/settings"); }}
          >
            <span>⚙</span>Configuración
          </a>
        </nav>
        <div className="design-sidebar-theme">
          <span className="label-caps">Apariencia</span>
          <ThemeControl theme={theme} onThemeChange={onThemeChange} />
        </div>
        <div className="sidebar-status">
          <span className="status-dot" />
          <div><strong>Sistema visual activo</strong><small>Lyngus Halo · v1.0</small></div>
        </div>
      </aside>
      <main id="design-content" className="design-main" tabIndex="-1">
        <header className="design-page-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <ThemeControl theme={theme} onThemeChange={onThemeChange} compact />
        </header>
        {children}
        <footer className="design-footer">
          <span>Lyngus Halo · Design System</span>
          <span>Accesible · Semántico · Operacional</span>
        </footer>
      </main>
    </div>
  );
}

export function StyleGuide({ theme, onThemeChange, onNavigate }) {
  const [copied, setCopied] = useState(null);
  const [sample, setSample] = useState("La tecnología se vuelve humana cuando llega a tiempo.");
  const [sampleSize, setSampleSize] = useState(36);
  const [sampleFont, setSampleFont] = useState("space");

  useEffect(() => {
    document.title = "Paleta & Tipografía · Lyngus Halo";
  }, []);

  const copyColor = async (color, token) => {
    try {
      await navigator.clipboard.writeText(color);
      setCopied(token);
      window.setTimeout(() => setCopied(null), 1_600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <DesignPageShell
      active="styleguide"
      title="Paleta & Tipografía"
      eyebrow="Diseño & identidad visual"
      description="El lenguaje visual compartido que hace reconocible, legible y confiable cada decisión de Lyngus Halo."
      theme={theme}
      onThemeChange={onThemeChange}
      onNavigate={onNavigate}
    >
      <section className="design-hero-card">
        <div>
          <span className="label-caps">PRINCIPIO RECTOR</span>
          <h2>Calma para comprender.<br /><em>Precisión para actuar.</em></h2>
        </div>
        <div className="halo-orbit" aria-hidden="true"><i /><i /><i /><span>LH</span></div>
      </section>

      <section className="style-section" aria-labelledby="colors-title">
        <div className="style-section-heading">
          <div><span className="section-index">01</span><h2 id="colors-title">Colores semánticos</h2></div>
          <p>Selecciona cualquier muestra para copiar el valor activo en modo {theme === "dark" ? "oscuro" : "claro"}.</p>
        </div>
        <div className="color-grid">
          {COLORS.map((color) => {
            const activeColor = color[theme];
            return (
              <button
                className="color-card"
                key={color.token}
                type="button"
                onClick={() => copyColor(activeColor, color.token)}
                style={{ "--swatch": activeColor }}
                aria-label={`Copiar ${activeColor}, ${color.name}`}
              >
                <span className="color-swatch"><i /></span>
                <span className="color-card-copy">
                  <small>{color.token}</small>
                  <strong>{color.name}</strong>
                  <em>{color.usage}</em>
                  <b>{copied === color.token ? "Copiado ✓" : activeColor}</b>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="style-section" aria-labelledby="type-title">
        <div className="style-section-heading">
          <div><span className="section-index">02</span><h2 id="type-title">Tipografía & jerarquía</h2></div>
          <p>Space Grotesk comunica; JetBrains Mono entrega precisión técnica.</p>
        </div>
        <div className="type-family-grid">
          <article><span className="label-caps">TIPOGRAFÍA PRINCIPAL</span><strong className="type-space">Space Grotesk</strong><p>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br />0123456789</p></article>
          <article><span className="label-caps">TELEMETRÍA & CÓDIGO</span><strong className="type-mono">JetBrains Mono</strong><p className="type-mono">-33.391234, -70.575123<br />HALO-20260815-000001<br />04:32 MIN · 2.184 M</p></article>
        </div>
        <div className="type-scale-table" role="table" aria-label="Escala tipográfica">
          {TYPE_SCALE.map(([name, size, weight, spacing, example]) => (
            <div key={name} role="row">
              <span role="cell"><b>{name}</b><small>{size} · {weight} · {spacing}</small></span>
              <strong role="cell" className={name}>{example}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="style-section typography-lab" aria-labelledby="lab-title">
        <div className="style-section-heading">
          <div><span className="section-index">03</span><h2 id="lab-title">Laboratorio tipográfico</h2></div>
          <p>Prueba contenido real antes de incorporarlo al producto.</p>
        </div>
        <div className="typography-controls">
          <label><span>Texto</span><input value={sample} onChange={(event) => setSample(event.target.value)} /></label>
          <label><span>Tamaño · {sampleSize}px</span><input type="range" min="14" max="64" value={sampleSize} onChange={(event) => setSampleSize(Number(event.target.value))} /></label>
          <label><span>Familia</span><select value={sampleFont} onChange={(event) => setSampleFont(event.target.value)}><option value="space">Space Grotesk</option><option value="mono">JetBrains Mono</option></select></label>
        </div>
        <div className={`typography-preview ${sampleFont === "mono" ? "type-mono" : "type-space"}`} style={{ fontSize: sampleSize }}>{sample || "Escribe para probar la tipografía"}</div>
      </section>

      <section className="style-section" aria-labelledby="components-title">
        <div className="style-section-heading">
          <div><span className="section-index">04</span><h2 id="components-title">Estados operacionales</h2></div>
          <p>Color, texto y forma trabajan juntos para no depender únicamente del color.</p>
        </div>
        <div className="component-showcase">
          <article><span className="label-caps">CRITICIDAD</span><div className="badge-row"><span className="ds-badge critical">! Crítica</span><span className="ds-badge warning">△ Advertencia</span><span className="ds-badge success">✓ Operativo</span><span className="ds-badge active">◎ En revisión</span></div></article>
          <article><span className="label-caps">ACCIONES</span><div className="button-row"><button type="button" className="ds-button primary">Revisar alerta</button><button type="button" className="ds-button secondary">Ver ubicación</button><button type="button" className="ds-button ghost">Cerrar</button></div></article>
          <article className="showcase-alert"><span className="alert-live-dot" /><div><small className="type-mono">HALO-20260815-000001</small><strong>Nueva alerta médica</strong><p>María González · Av. Vitacura 3400</p></div><span className="ds-badge critical">! Crítica</span></article>
        </div>
      </section>

      <section className="accessibility-note">
        <span aria-hidden="true">A</span>
        <div><strong>Accesibilidad incorporada</strong><p>Contraste, foco visible, reducción de movimiento y etiquetas redundantes forman parte del sistema, no de una revisión posterior.</p></div>
      </section>
    </DesignPageShell>
  );
}

export function SettingsPage({ theme, onThemeChange, onNavigate }) {
  const selectedLabel = useMemo(() => theme === "dark" ? "Oscuro" : "Claro", [theme]);

  useEffect(() => {
    document.title = "Configuración · Lyngus Halo";
  }, []);

  return (
    <DesignPageShell
      active="settings"
      title="Configuración"
      eyebrow="Preferencias del entorno"
      description="Personaliza la experiencia local del dashboard sin alterar la información operacional."
      theme={theme}
      onThemeChange={onThemeChange}
      onNavigate={onNavigate}
    >
      <section className="settings-layout">
        <article className="settings-card settings-card-featured">
          <div className="settings-icon">◈</div>
          <div>
            <span className="label-caps">DISEÑO & IDENTIDAD VISUAL</span>
            <h2>Sistema visual Lyngus Halo</h2>
            <p>Explora colores semánticos, tipografías, estados y componentes que construyen la identidad de la plataforma.</p>
            <button type="button" className="ds-button primary" onClick={() => onNavigate("/styleguide")}>Ver Guía de Estilo <span>→</span></button>
          </div>
          <div className="settings-halo" aria-hidden="true"><i /></div>
        </article>
        <article className="settings-card">
          <div className="settings-card-heading"><div><span className="label-caps">APARIENCIA</span><h2>Tema de interfaz</h2></div><span className="current-value">{selectedLabel}</span></div>
          <p>El tema se guarda en este navegador y se aplica al dashboard, las alertas, el mapa y la cámara.</p>
          <ThemeControl theme={theme} onThemeChange={onThemeChange} />
        </article>
        <article className="settings-card">
          <div className="settings-card-heading"><div><span className="label-caps">ACCESIBILIDAD</span><h2>Movimiento responsable</h2></div><span className="ds-badge success">✓ Automático</span></div>
          <p>Las animaciones de rutas, halos y transiciones respetan la preferencia “reducir movimiento” del sistema operativo.</p>
        </article>
        <article className="settings-card">
          <div className="settings-card-heading"><div><span className="label-caps">TIPOGRAFÍA</span><h2>Fuentes del producto</h2></div><span className="current-value type-mono">Aa</span></div>
          <p>Space Grotesk para comunicación y JetBrains Mono para códigos, coordenadas y telemetría.</p>
        </article>
      </section>
    </DesignPageShell>
  );
}

export { ThemeControl };
