import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./public/data/dashboard-data.json", import.meta.url),
  "utf8",
);
const data = JSON.parse(source);
const invalidAlerts = data.alertas.filter(
  (alert) =>
    !Array.isArray(alert.coordenadas) ||
    alert.coordenadas.length !== 2 ||
    !Date.parse(alert.fecha),
);
const longitudes = data.alertas.map((alert) => alert.coordenadas[0]);
const latitudes = data.alertas.map((alert) => alert.coordenadas[1]);

const audit = {
  alertas: data.alertas.length,
  zonas: data.zonas.features.length,
  usuarios: data.resumen.usuarios,
  categorias: [...new Set(data.alertas.map((alert) => alert.categoria))],
  alertasInvalidas: invalidAlerts.length,
  limitesGeograficos: [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ],
};

console.log(JSON.stringify(audit, null, 2));
if (invalidAlerts.length > 0) process.exitCode = 1;
