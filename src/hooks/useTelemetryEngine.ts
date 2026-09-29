import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createInitialMetrics,
  tickMetrics,
  generateEvent,
  generateAlerts,
  tickNodes,
  createIncidentAlert,
  type SimulatedIncident,
  type MetricSeries,
  type StreamEvent,
  type AlertItem,
  type NodeInfo,
} from '@/lib/telemetry';

export function useTelemetryEngine(intervalMs = 1500) {
  const [metrics, setMetrics] = useState<MetricSeries[]>(() => {
    const initial = createInitialMetrics();
    return initial.map((m) => ({ ...m, history: [m.value] }));
  });
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [nodes, setNodes] = useState<NodeInfo[]>(() => tickNodes([]));

  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  useEffect(() => {
    const tick = setInterval(() => {
      setMetrics((prev) => tickMetrics(prev));
      const newEvent = generateEvent();
      setEvents((prev) => [newEvent, ...prev].slice(0, 80));
      setNodes((prev) => (prev.length === 0 ? tickNodes(prev) : tickNodes(prev)));

      const newAlerts = generateAlerts(metricsRef.current);
      const activeKeys = new Set(newAlerts.map((a) => a.id));
      setAlerts((prev) => {
        const resolved = prev.filter((a) => activeKeys.has(a.id) || a.acknowledged);
        const existing = new Set(resolved.map((a) => a.id));
        const fresh = newAlerts.filter((a) => !existing.has(a.id));
        return [...fresh, ...resolved].slice(0, 50);
      });
    }, intervalMs);

    return () => clearInterval(tick);
  }, [intervalMs]);

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  }, []);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  const injectIncident = useCallback((incident: SimulatedIncident) => {
    const alert = createIncidentAlert(incident);
    setAlerts((prev) => [alert, ...prev].slice(0, 50));

    if (incident.type === 'broker_failure') {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === 'n3' ? { ...n, status: 'down', cpu: 0, memory: 0, connections: 0 } : n
        )
      );
    } else if (incident.type === 'consumer_lag') {
      setMetrics((prev) =>
        prev.map((m) =>
          m.key === 'ingestRate' ? { ...m, value: 565000 } : m
        )
      );
    } else if (incident.type === 'latency_spike') {
      setMetrics((prev) =>
        prev.map((m) =>
          m.key === 'latency' ? { ...m, value: 178 } : m
        )
      );
    } else if (incident.type === 'error_burst') {
      setMetrics((prev) =>
        prev.map((m) =>
          m.key === 'errorRate' ? { ...m, value: 3.4 } : m
        )
      );
    }
  }, []);

  return { metrics, events, alerts, nodes, acknowledgeAlert, clearAlerts, injectIncident };
}
