import { useCallback, useEffect, useRef, useState } from "react";
import {
  getOperationalAlert,
  getOperationalAlerts,
  operationalAlertsEventUrl,
  updateOperationalAlertStatus,
} from "../services/dashboardApi.js";

function prependUnique(alerts, incoming) {
  return [incoming, ...alerts.filter((alert) => alert.id !== incoming.id)];
}

function replaceOrPrepend(alerts, incoming) {
  const index = alerts.findIndex((alert) => alert.id === incoming.id);
  if (index < 0) return [incoming, ...alerts];
  return alerts.map((alert) => (alert.id === incoming.id ? incoming : alert));
}

export function useOperationalAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [incoming, setIncoming] = useState(null);
  const notificationTimer = useRef(null);

  const load = useCallback(async (signal) => {
    setLoading(true);
    try {
      const result = await getOperationalAlerts({ limite: 100, signal });
      setAlerts(result.alertas ?? []);
      setError(null);
    } catch (loadError) {
      if (loadError.name !== "AbortError") setError(loadError);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  const dismissIncoming = useCallback(() => {
    window.clearTimeout(notificationTimer.current);
    setIncoming(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const source = new EventSource(operationalAlertsEventUrl());
    const onConnected = () => setConnected(true);
    const onAlert = (event) => {
      let alert;
      try {
        alert = JSON.parse(event.data);
      } catch {
        return;
      }
      setConnected(true);
      setAlerts((current) => prependUnique(current, alert));
      setIncoming(alert);
      window.clearTimeout(notificationTimer.current);
      notificationTimer.current = window.setTimeout(
        () => setIncoming(null),
        15_000,
      );
    };
    const onUpdatedAlert = (event) => {
      try {
        const alert = JSON.parse(event.data);
        setConnected(true);
        setAlerts((current) => replaceOrPrepend(current, alert));
      } catch {
        // Ignora eventos incompletos y conserva la última lectura válida.
      }
    };
    source.addEventListener("conectado", onConnected);
    source.addEventListener("alerta_nueva", onAlert);
    source.addEventListener("alerta_actualizada", onUpdatedAlert);
    source.onerror = () => setConnected(false);
    return () => {
      window.clearTimeout(notificationTimer.current);
      source.removeEventListener("conectado", onConnected);
      source.removeEventListener("alerta_nueva", onAlert);
      source.removeEventListener("alerta_actualizada", onUpdatedAlert);
      source.close();
    };
  }, []);

  const updateStatus = useCallback(async (alert, estado) => {
    const updated = await updateOperationalAlertStatus(alert.id, estado);
    setAlerts((current) => replaceOrPrepend(current, updated));
    return updated;
  }, []);

  const loadDetail = useCallback(
    (alert, options) => getOperationalAlert(alert.id, options),
    [],
  );

  return {
    alerts,
    loading,
    error,
    connected,
    incoming,
    dismissIncoming,
    loadDetail,
    updateStatus,
    retry: () => load(),
  };
}
