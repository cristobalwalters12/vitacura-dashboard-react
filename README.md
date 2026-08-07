# Vitacura Comunidad Segura — Dashboard React

Aplicación real de React 19 + Vite, MapLibre GL JS y Apache ECharts. El proyecto conserva el diseño del prototipo y separa la interfaz, los componentes geográficos y el acceso a datos.

## Requisitos

- Node.js 22.12 o superior.
- npm.
- Conexión a internet para instalar dependencias y cargar el mapa base.

## Abrir en VS Code

```powershell
cd "C:\Users\crist\Documents\Codex\2026-08-05\te\outputs\vitacura-dashboard-react"
code .
```

## Instalar y ejecutar

```powershell
npm install
npm run dev
```

Vite mostrará una dirección como <http://localhost:5173>.

Si PowerShell bloquea `npm.ps1` por la política de ejecución, utiliza los ejecutables `.cmd`:

```powershell
npm.cmd install
npm.cmd run dev
```

Otros comandos:

```powershell
npm run build       # genera dist/ para producción
npm run preview     # previsualiza dist/
npm run data:build  # reconstruye el snapshot desde los JSONL
npm run data:audit  # valida conteos, categorías y coordenadas
npm run check       # audita la data y compila la aplicación
```

## Fuente de datos actual

La demo usa `public/data/dashboard-data.json`, un snapshot generado automáticamente desde:

```text
../vitacura-mock-data/generated_es/*.jsonl
```

No son valores escritos manualmente dentro de los componentes. Sin embargo, sigue siendo un archivo estático y solamente debe utilizarse para demostraciones o desarrollo local.

## Usar una API real

Copia `.env.example` como `.env.local` y configura:

```dotenv
VITE_API_BASE_URL=http://localhost:3000
```

Si `VITE_API_BASE_URL` está vacío, la aplicación utiliza el snapshot local. Si tiene un valor, `src/services/dashboardApi.js` consulta en paralelo `/api/v1/dashboard/resumen` y `/api/v1/dashboard/mapa`. Los cambios de período y categoría se calculan en MongoDB, no en el navegador.

El endpoint inicial debe responder con la misma estructura de `public/data/dashboard-data.json`. Para una implementación de mayor escala conviene evolucionar hacia endpoints separados:

```text
GET /api/v1/dashboard/resumen?desde=&hasta=&categoria=
GET /api/v1/dashboard/tendencia?desde=&hasta=&granularidad=dia
GET /api/v1/dashboard/zonas?desde=&hasta=&categoria=
GET /api/v1/mapa/alertas?bbox=&zoom=&desde=&hasta=&categoria=
GET /api/v1/alertas/:id
```

Para volúmenes altos, el endpoint del mapa debería entregar clusters o teselas vectoriales según el `bbox` y el nivel de zoom, no todos los eventos de la base.

## Estructura

```text
src/
  components/          mapa, gráficos, indicadores y detalle
  config/              categorías, prioridades y configuración visual
  hooks/               carga y estado de la información
  services/            acceso al snapshot o API
  utils/               formato y cálculos compartidos
  App.jsx               composición y analítica del tablero
  main.jsx              entrada de React
public/data/            snapshot de demostración
build-data.mjs          generación del snapshot
auditar-dashboard.mjs   validación de la data
```

## Arquitectura del dashboard

```text
Dashboard React
    ↓ HTTP
API NestJS
    ↓ aggregation pipelines
MongoDB Atlas
```

El navegador nunca se conecta directamente a MongoDB Atlas. La API aplica validación, filtros, límites de consulta y, en la siguiente etapa, autenticación y permisos por municipalidad. El backend se encuentra en `../vitacura-dashboard-api`.

## Privacidad

Todos los incidentes incluidos son sintéticos. Las coordenadas corresponden a puntos públicos de la red vial de Vitacura y no representan domicilios ni emergencias reales.
