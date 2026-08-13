import { useEffect, useState } from "react";
import { getAlertDetail } from "../services/dashboardApi.js";

export function useAlertDetail(alert) {
  const [retryVersion, setRetryVersion] = useState(0);
  const [state, setState] = useState({
    detail: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!alert?.id) {
      setState({ detail: null, loading: false, error: null });
      return undefined;
    }

    const controller = new AbortController();
    setState({ detail: null, loading: true, error: null });
    getAlertDetail(alert, { signal: controller.signal })
      .then((detail) => {
        setState({ detail, loading: false, error: null });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setState({ detail: null, loading: false, error });
      });

    return () => controller.abort();
  }, [alert?.id, retryVersion]);

  return {
    ...state,
    retry: () => setRetryVersion((current) => current + 1),
  };
}
