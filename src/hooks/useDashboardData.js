import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dataSource,
  getDashboardAnalytics,
  getDashboardFallbackSnapshot,
  getDashboardSnapshot,
} from "../services/dashboardApi.js";

function waitForBrowserIdle(signal) {
  return new Promise((resolve, reject) => {
    let idleId;
    let timeoutId;

    const cleanup = () => {
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abort);
    };
    const complete = () => {
      cleanup();
      resolve();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Solicitud cancelada", "AbortError"));
    };

    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(complete, { timeout: 900 });
    } else {
      timeoutId = window.setTimeout(complete, 180);
    }
  });
}

export function useDashboardData(filters) {
  const queryKey = JSON.stringify(filters);
  const analyticsKey = JSON.stringify({
    ...filters,
    bbox: undefined,
  });
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });
  const [analyticsState, setAnalyticsState] = useState({
    data: null,
    loading: dataSource === "api",
    error: null,
  });

  const load = useCallback(
    async (signal) => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const data = await getDashboardSnapshot({
          ...JSON.parse(queryKey),
          signal,
        });
        const contingencyError = data.metadata?.contingencia
          ? new Error(
              "PostgreSQL está temporalmente fuera de línea; se muestran datos de contingencia.",
            )
          : null;
        setState({ data, loading: false, error: contingencyError });
      } catch (error) {
        if (error.name === "AbortError") return;
        let fallback = null;
        if (dataSource === "api") {
          fallback = await getDashboardFallbackSnapshot().catch(() => null);
        }
        if (signal?.aborted) return;
        setState((current) => ({
          data: current.data ?? fallback,
          loading: false,
          error,
        }));
      }
    },
    [queryKey],
  );

  const loadAnalytics = useCallback(
    async (signal) => {
      if (dataSource !== "api") return;
      setAnalyticsState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));
      try {
        await waitForBrowserIdle(signal);
        const data = await getDashboardAnalytics({
          ...JSON.parse(analyticsKey),
          signal,
        });
        const contingencyError = data?.metadata?.contingencia
          ? new Error("La analítica avanzada se sirve desde la caché de contingencia.")
          : null;
        setAnalyticsState({ data, loading: false, error: contingencyError });
      } catch (error) {
        if (error.name === "AbortError") return;
        setAnalyticsState((current) => ({
          data: current.data,
          loading: false,
          error,
        }));
      }
    },
    [analyticsKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    loadAnalytics(controller.signal);
    return () => controller.abort();
  }, [loadAnalytics]);

  useEffect(() => {
    if (!state.error) return undefined;
    const timer = window.setTimeout(() => load(), 5_000);
    return () => window.clearTimeout(timer);
  }, [load, state.error]);

  useEffect(() => {
    if (!analyticsState.error || dataSource !== "api") return undefined;
    const timer = window.setTimeout(() => loadAnalytics(), 8_000);
    return () => window.clearTimeout(timer);
  }, [analyticsState.error, loadAnalytics]);

  const data = useMemo(
    () =>
      state.data
        ? {
            ...state.data,
            analiticaServidor:
              dataSource === "api"
                ? analyticsState.data ?? state.data.analiticaServidor
                : state.data.analiticaServidor,
          }
        : null,
    [analyticsState.data, state.data],
  );

  return {
    ...state,
    data,
    analyticsLoading: analyticsState.loading,
    analyticsError: analyticsState.error,
    source: dataSource,
    retry: () => load(),
    retryAnalytics: () => loadAnalytics(),
  };
}
