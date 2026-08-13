# Escenario sintético analítico

## Propósito

Este conjunto de datos existe para demostrar capacidades reales de exploración municipal sin afirmar que corresponde a actividad operacional de Vitacura. Todos los eventos son sintéticos y utilizan coordenadas contenidas en las geometrías territoriales del snapshot.

La versión `3.0.0` contiene 20.000 alertas entre el 16 de agosto de 2025 y el 15 de agosto de 2026. Se genera con la semilla `20260815`, por lo que dos ejecuciones con la misma configuración producen exactamente el mismo archivo. El 15 de agosto de 2026 es la fecha de corte analítica fija de la demostración.

## Historias incorporadas

### 1. Aumento médico reciente

- Zonas: A-7 y A-9.
- Período: 11 al 15 de agosto de 2026.
- Señal esperada: la frecuencia médica diaria debe ser al menos 1,8 veces la línea base de los 28 días anteriores.
- Uso analítico: variación temporal, priorización territorial y hallazgos automáticos.

### 2. Concentración nocturna de seguridad

- Zonas: A-12 y A-13.
- Período: 1 al 10 de agosto de 2026.
- Horario: 20:00 a 03:59.
- Señal esperada: al menos 55% de sus alertas de seguridad debe ocurrir en el horario nocturno.
- Uso analítico: mapa temporal, matriz día/hora y asignación de recursos.

### 3. Presión operacional localizada

- Zona: A-14.
- Período: 1 al 31 de julio de 2026.
- Señal esperada: la mediana de primera respuesta debe superar en al menos 2,2 veces un período comparable sin presión.
- Uso analítico: SLA, mediana contra p90 y detección de degradaciones.

### 4. Uso intensivo de la red de cuidado

- Zonas: A-3 y A-5.
- Señal esperada: la proporción de asistencia a cuidadores debe superar al resto de la comuna por al menos ocho puntos porcentuales.
- Uso analítico: demanda de cuidado, planificación territorial y segmentación por canal.

### 5. Casos que requieren revisión humana

- Categorías: incendio y accidente.
- Señal esperada: su tasa de revisión debe superar a las demás categorías por al menos 20 puntos porcentuales.
- Uso analítico: confianza, revisión humana, desempeño del modelo y trazabilidad.

## Reglas de consistencia

El generador garantiza:

- identificadores y códigos únicos;
- categorías y tipos compatibles;
- coordenadas dentro de la zona declarada;
- secuencia cronológica desde creación hasta resolución;
- tiempos derivados coherentes con sus marcas temporales;
- agregados por categoría y zona recalculados desde las alertas;
- referencias territoriales válidas;
- marca `sintetico: true` en todos los eventos;
- transcripciones genéricas anonimizadas, sin información personal.

## Campos preparados para las siguientes fases

Además del contrato que ya consume el dashboard, cada alerta incluye:

- hitos de clasificación, confirmación, despacho, llegada y resolución;
- razones de prioridad;
- transcripción anonimizada;
- versión y latencia del modelo;
- resumen de notificaciones;
- tipo y tiempos del respondedor.

Estos campos permitirán construir analítica de IA, respuesta, cuidado y un detalle de incidente más profundo sin volver a regenerar el modelo de datos.

## Comandos

```bash
npm run data:build
npm run data:audit
npm run data:verify
npm run data:export-mongo -- --output=generated-mongo
npm run data:verify-mongo -- --input=generated-mongo
npm run check
```

`data:audit` valida integridad. `data:verify` mide las historias. Ambas verificaciones deben aprobar antes de utilizar el snapshot en una demostración.

`data:export-mongo` transforma el mismo escenario a archivos JSONL en Extended JSON para las colecciones `zonas`, `usuarios`, `dispositivos`, `perfiles_cuidado` y `alertas`. `data:verify-mongo` compara sus totales y señales operacionales con el snapshot del frontend. Estos comandos solo preparan y validan el paquete: no conectan, importan ni reemplazan datos en MongoDB.
