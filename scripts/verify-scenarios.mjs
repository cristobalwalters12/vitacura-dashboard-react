import { readFileSync } from "node:fs";

const data = JSON.parse(
  readFileSync(new URL("../public/data/dashboard-data.json", import.meta.url), "utf8"),
);

const alerts = data.alertas;
const day = (alert) => alert.fecha.slice(0, 10);
const hour = (alert) => new Date(alert.fecha).getUTCHours();
const inRange = (alert, start, end) => day(alert) >= start && day(alert) <= end;
const ratio = (numerator, denominator) => (denominator ? numerator / denominator : 0);

function median(values) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

const medicalRecent = alerts.filter(
  (alert) => ["A-7", "A-9"].includes(alert.zona) && alert.categoria === "medica" && inRange(alert, "2026-08-11", "2026-08-15"),
).length;
const medicalBaseline = alerts.filter(
  (alert) => ["A-7", "A-9"].includes(alert.zona) && alert.categoria === "medica" && inRange(alert, "2026-07-14", "2026-08-10"),
).length;
const medicalDailyRatio = ratio(medicalRecent / 5, medicalBaseline / 28);

const securityCluster = alerts.filter(
  (alert) => ["A-12", "A-13"].includes(alert.zona) && alert.categoria === "seguridad" && inRange(alert, "2026-08-01", "2026-08-10"),
);
const securityNightShare = ratio(
  securityCluster.filter((alert) => hour(alert) >= 20 || hour(alert) <= 3).length,
  securityCluster.length,
);

const pressureResponses = alerts
  .filter((alert) => alert.zona === "A-14" && inRange(alert, "2026-07-01", "2026-07-31"))
  .map((alert) => alert.respuestaSegundos);
const normalResponses = alerts
  .filter((alert) => alert.zona === "A-14" && inRange(alert, "2026-05-01", "2026-05-31"))
  .map((alert) => alert.respuestaSegundos);
const pressureRatio = ratio(median(pressureResponses), median(normalResponses));

const careZones = alerts.filter((alert) => ["A-3", "A-5"].includes(alert.zona));
const otherZones = alerts.filter((alert) => !["A-3", "A-5"].includes(alert.zona));
const careShareTarget = ratio(careZones.filter((alert) => alert.categoria === "asistencia_cuidador").length, careZones.length);
const careShareOthers = ratio(otherZones.filter((alert) => alert.categoria === "asistencia_cuidador").length, otherZones.length);

const difficult = alerts.filter((alert) => ["incendio", "accidente"].includes(alert.categoria));
const regular = alerts.filter((alert) => !["incendio", "accidente"].includes(alert.categoria));
const difficultReviewRate = ratio(difficult.filter((alert) => alert.requiereRevision).length, difficult.length);
const regularReviewRate = ratio(regular.filter((alert) => alert.requiereRevision).length, regular.length);

const checks = [
  {
    id: "medical_surge",
    metric: Number(medicalDailyRatio.toFixed(2)),
    expectation: ">= 1.8x respecto de la línea base diaria",
    pass: medicalDailyRatio >= 1.8,
  },
  {
    id: "night_security_cluster",
    metric: Number((securityNightShare * 100).toFixed(1)),
    expectation: ">= 55% de los casos en horario nocturno",
    pass: securityNightShare >= 0.55,
  },
  {
    id: "response_pressure",
    metric: Number(pressureRatio.toFixed(2)),
    expectation: ">= 2.2x en la mediana de respuesta",
    pass: pressureRatio >= 2.2,
  },
  {
    id: "care_network",
    metric: Number(((careShareTarget - careShareOthers) * 100).toFixed(1)),
    expectation: ">= 8 puntos porcentuales sobre el resto de la comuna",
    pass: careShareTarget - careShareOthers >= 0.08,
  },
  {
    id: "classification_challenge",
    metric: Number(((difficultReviewRate - regularReviewRate) * 100).toFixed(1)),
    expectation: ">= 20 puntos porcentuales adicionales de revisión",
    pass: difficultReviewRate - regularReviewRate >= 0.2,
  },
];

console.log(JSON.stringify({ escenario: data.metadata.versionEscenario, verificaciones: checks }, null, 2));
if (checks.some((check) => !check.pass)) process.exitCode = 1;
