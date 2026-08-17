# Lyngus Halo — Dashboard React

Aplicación real de React 19 + Vite, MapLibre GL JS y Apache ECharts. Lyngus Halo presenta inteligencia territorial y operación de alertas para la Municipalidad de Vitacura, separando la interfaz, los componentes geográficos y el acceso a datos.

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
npm run performance:verify # comprueba el presupuesto del bundle ya compilado
npm run check       # audita la data, compila y verifica rendimiento
```

## Fuente de datos actual

La demo usa un escenario sintético y reproducible de 20.000 alertas con fecha de corte fija al 15 de agosto de 2026. La API puede utilizar MongoDB Atlas o PostgreSQL/PostGIS sin cambiar el contrato del frontend; `public/data/dashboard-data.json` conserva el mismo escenario como respaldo local. `build-data.mjs` regenera las alertas con una semilla fija y reglas declaradas en `scripts/scenario.config.mjs`.

El escenario contiene cinco historias analíticas verificables: aumento médico reciente, concentración nocturna de seguridad, presión operacional localizada, uso intensivo de la red de cuidado y casos de IA que requieren revisión humana. No son valores escritos manualmente dentro de los componentes ni representan hechos reales de Vitacura.

```powershell
npm run data:build   # regenera siempre el mismo escenario
npm run data:audit   # valida estructura, taxonomía, geografía, cronología y agregados
npm run data:verify  # comprueba que las cinco historias sean estadísticamente visibles
npm run data:export-mongo -- --output=generated-mongo
npm run data:verify-mongo -- --input=generated-mongo
```

La definición completa está en `docs/ESCENARIO-SINTETICO.md`.

La exportación Mongo genera Extended JSON para `zonas`, `usuarios`, `dispositivos`, `perfiles_cuidado` y `alertas`. No importa ni elimina datos: deja un paquete listo para revisar y cargar en una base de demostración separada.

## Usar una API real

Copia `.env.example` como `.env.local` y configura:

```dotenv
VITE_API_BASE_URL=http://localhost:3000
```

Si `VITE_API_BASE_URL` está vacío, la aplicación utiliza el snapshot local. Si tiene un valor, `src/services/dashboardApi.js` carga primero `/api/v1/dashboard/resumen` y `/api/v1/dashboard/mapa`; `/api/v1/dashboard/analitica` se resuelve de forma progresiva sin bloquear la vista principal. Los cambios de período, filtros operacionales, comparaciones y hallazgos se calculan en el backend seleccionado, no en el navegador. Resumen, mapa, analítica y detalle mantienen cachés con duraciones distintas; mover el mapa no repite la consulta de analítica.

Para pruebas locales donde el navegador bloquee el puerto de la API, Vite admite un proxy opcional sin afectar producción:

```bash
VITE_API_BASE_URL=http://localhost:5173 \
VITE_API_PROXY_TARGET=http://127.0.0.1:3001 \
npm run dev
```

El centro de hallazgos combina señales territoriales, operacionales, de IA y de cuidado. Cada tarjeta puede aplicar su categoría o zona al resto del tablero. Los KPIs, la tendencia y la tabla territorial muestran la variación contra un período anterior de la misma duración.

La analítica avanzada se presenta en tres módulos:

- recorrido operacional desde clasificación hasta resolución, con mediana, P90, zonas y red de respuesta;
- observabilidad de IA con índice de salud, confianza, latencia y carga de revisión humana;
- cuidado focalizado con dependencia, riesgos, dispositivos y demanda por hora.

Mapa, gráficos, analítica avanzada y detalle se entregan como módulos diferidos. La carga inicial sólo incluye React y la interfaz esencial; MapLibre, ECharts y sus estilos se descargan cuando la sección está próxima al viewport. La compilación de producción no publica sourcemaps y `npm run performance:verify` falla si el JavaScript inicial supera 100 KiB gzip, el CSS inicial supera 20 KiB gzip o un módulo pesado vuelve a cargarse de forma anticipada.

Al seleccionar una alerta desde el mapa o la lista prioritaria, el frontend solicita `GET /api/v1/alertas/:id` y abre un panel de trazabilidad. El panel incluye línea de tiempo, explicación del modelo, evidencia anonimizada, prioridad, respuesta, notificaciones, dispositivo, cuidado y resolución. También permite aplicar la zona del caso al resto del dashboard. Si la API no está configurada, el snapshot local construye una versión equivalente con los campos disponibles.

## Cámara en vivo

La cámara pertenece a cada alerta, no a la plataforma completa. Cuando un documento operacional contiene `camara: true`, la cola muestra un indicador rojo y el detalle ofrece **Ver cámara en vivo** en el mismo contenedor del mapa. Con `camara: false` el control no se renderiza. El detalle permite volver al mapa, reintentar la señal, cerrar por fondo o Escape y desconecta automáticamente el reproductor al salir.

Los navegadores no reproducen RTMP directamente. El proyecto incluye un gateway MediaMTX con FFmpeg que toma exclusivamente la cámara IP remota `rtmp://146.181.37.100:1935/live/stream2`, normaliza la señal H.264 sin B-frames y publica HLS para el reproductor web. No solicita ni utiliza la cámara o el micrófono del computador.

En macOS, instala una sola vez las dependencias nativas:

```bash
brew install mediamtx ffmpeg
```

Después inicia el gateway sin Docker:

```bash
npm run camera:up
```

Configura el frontend con la URL HLS publicada:

```dotenv
VITE_CAMERA_STREAM_URL=http://localhost:8888/stream2/index.m3u8
```

Luego inicia Vite normalmente. `hls.js` se descarga de forma diferida solamente al abrir la cámara; Safari utiliza su soporte HLS nativo cuando está disponible.

La transcodificación se inicia bajo demanda cuando alguien abre el popup y se detiene 30 segundos después de que se desconecta el último visor. El video se normaliza a H.264. El audio AAC se copia solamente si la fuente lo entrega; `-map 0:a:0?` hace que su ausencia sea válida y evita intentar procesarlo.

Para revisar o detener el gateway:

```bash
npm run camera:logs
npm run camera:status
npm run camera:down
```

Docker queda como alternativa opcional mediante `npm run camera:docker:up` y `npm run camera:docker:down`. La imagen está fijada en `bluenviron/mediamtx:1.18.2-ffmpeg`.

En un despliegue remoto, `localhost` debe reemplazarse por la URL HTTPS pública del gateway o por una ruta publicada mediante el mismo reverse proxy del frontend. No se debe entregar el RTMP directamente al elemento `<video>`.

## Diseño e identidad visual

El dashboard implementa el sistema visual semántico de Lyngus Halo con temas claro y oscuro persistidos en el navegador. Usa Space Grotesk para la comunicación y JetBrains Mono para códigos, coordenadas, distancias y telemetría. Los estados críticos, de advertencia, conexión y selección mantienen roles cromáticos independientes y no dependen solamente del color.

Rutas disponibles:

- `/styleguide` y `/estilo`: guía interactiva, copia de códigos HEX y laboratorio tipográfico;
- `/settings`: configuración de apariencia y acceso a la guía;
- `/`: dashboard territorial y centro operacional.

La guía también está disponible desde el sidebar y el menú de perfil. En producción, el servidor web debe redirigir rutas desconocidas a `index.html` para conservar la navegación directa del SPA.

El endpoint inicial debe responder con la misma estructura de `public/data/dashboard-data.json`. Para una implementación de mayor escala conviene evolucionar hacia endpoints separados:

```text
GET /api/v1/dashboard/resumen?desde=&hasta=&categoria=
GET /api/v1/dashboard/analitica?desde=&hasta=&categoria=&zona=
GET /api/v1/mapa/alertas?bbox=&zoom=&desde=&hasta=&categoria=
GET /api/v1/alertas/:id
```

Para volúmenes altos, el endpoint del mapa debería entregar clusters o teselas vectoriales según el `bbox` y el nivel de zoom, no todos los eventos de la base.

## Estructura

```text
src/
  components/          mapa, gráficos, alertas, guía visual e indicadores
  config/              categorías, prioridades y configuración visual
  hooks/               carga, alertas operacionales y tema visual
  services/            acceso al snapshot o API
  utils/               formato y cálculos compartidos
  App.jsx               composición y analítica del tablero
  main.jsx              entrada de React
public/data/            snapshot de demostración
scripts/                configuración y verificación de historias
docs/                   definición del escenario analítico
build-data.mjs          generación determinística del snapshot
auditar-dashboard.mjs   validación integral de la data
```

## Arquitectura del dashboard

```text
Dashboard React
    ↓ HTTP
API NestJS
    ↓ aggregation pipelines
Backend de datos
```

El navegador nunca se conecta directamente a MongoDB Atlas ni a PostgreSQL. La API aplica validación, filtros y límites de consulta, y selecciona el motor mediante `DATA_BACKEND`. El backend se encuentra en `../vitacura-dashboard-api`.

## Privacidad

Todos los incidentes incluidos son sintéticos. Las coordenadas corresponden a puntos públicos de la red vial de Vitacura y no representan domicilios ni emergencias reales.
