import { Suspense, useEffect, useRef, useState } from "react";

function ModulePlaceholder({ id, className, minHeight, label }) {
  return (
    <section
      id={id}
      className={`deferred-module ${className ?? ""}`}
      style={{ minHeight }}
      role="status"
      aria-label={`Preparando ${label}`}
    >
      <div className="deferred-module-heading">
        <span />
        <i />
      </div>
      <div className="deferred-module-body">
        <span />
        <span />
        <span />
      </div>
      <small>Preparando {label}…</small>
    </section>
  );
}

export default function DeferredModule({
  id,
  className,
  minHeight = 320,
  label,
  rootMargin = "400px 0px",
  children,
}) {
  const placeholderRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return undefined;
    if (!("IntersectionObserver" in window)) {
      setReady(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setReady(true);
        observer.disconnect();
      },
      { rootMargin },
    );
    if (placeholderRef.current) observer.observe(placeholderRef.current);
    return () => observer.disconnect();
  }, [ready, rootMargin]);

  if (!ready) {
    return (
      <div ref={placeholderRef}>
        <ModulePlaceholder
          id={id}
          className={className}
          minHeight={minHeight}
          label={label}
        />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <ModulePlaceholder
          id={id}
          className={className}
          minHeight={minHeight}
          label={label}
        />
      }
    >
      {children}
    </Suspense>
  );
}
