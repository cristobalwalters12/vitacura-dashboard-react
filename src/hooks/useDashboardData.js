import { useCallback, useEffect, useState } from "react";
import {
  dataSource,
  getDashboardSnapshot,
} from "../services/dashboardApi.js";

export function useDashboardData({ dias, categoria }) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(
    async (signal) => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const data = await getDashboardSnapshot({ dias, categoria, signal });
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
    [categoria, dias],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return {
    ...state,
    source: dataSource,
    retry: () => load(),
  };
}
