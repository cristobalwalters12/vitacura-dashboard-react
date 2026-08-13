import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dataSource,
  getDashboardAnalytics,
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
        setState({ data, loading: false, error: null });
      } catch (error) {
        if (error.name === "AbortError") return;
        setState((current) => ({
          data: current.data,
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
      setAnalyticsState({ data: null, loading: true, error: null });
      try {
        await waitForBrowserIdle(signal);
        const data = await getDashboardAnalytics({
          ...JSON.parse(analyticsKey),
          signal,
        });
        setAnalyticsState({ data, loading: false, error: null });
      } catch (error) {
        if (error.name === "AbortError") return;
        setAnalyticsState({ data: null, loading: false, error });
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

  const data = useMemo(
    () =>
      state.data
        ? {
            ...state.data,
            analiticaServidor:
              dataSource === "api"
                ? analyticsState.data
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
