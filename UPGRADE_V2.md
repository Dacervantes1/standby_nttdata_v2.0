# Actualización Standby Control V2

Esta versión agrega cuatro cambios principales:

1. **Consulta pública inicial (sin usuario)** con dashboard, filtros y descarga de reportes sin mostrar horas acumuladas, tarifas ni dinero.
2. **CRUD administrativo** para intervenciones, proyectos, colaboradores, tarifas y planificación de guardias.
3. **Colaborador**: puede crear, ver y editar únicamente sus propias intervenciones mientras estén en BORRADOR, PENDIENTE o RECHAZADO. Los registros APROBADOS quedan bloqueados.
4. **Planificación por rango**: el administrador puede asignar o retirar guardias para un colaborador/proyecto entre dos fechas, con opción de todos los días, solo laborables o solo fines de semana.

## Si ya tienes la aplicación desplegada

### 1. Ejecuta la migración SQL

En Supabase > SQL Editor abre `MIGRACION_V2.sql` y ejecútalo completo.

La migración:

- no borra los datos actuales;
- crea vistas públicas de solo lectura;
- expone solamente columnas controladas;
- mantiene las tablas base protegidas por RLS;
- permite editar al colaborador únicamente sus T2 no aprobados.

### 2. Conserva tu `config.js`

Si tu aplicación actual ya funciona con Supabase, **no pierdas tus valores reales** de:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Al reemplazar los archivos del proyecto, conserva tu `config.js` actual o vuelve a colocar esas dos claves.

### 3. Reemplaza los archivos web

Actualiza en tu repositorio:

- `index.html`
- `styles.css`
- `app.js`
- `schema.sql` (solo como referencia para instalaciones nuevas)
- `MIGRACION_V2.sql`

No es necesario volver a ejecutar `seed.sql` si ya cargaste la base anteriormente.

### 4. Haz push a GitHub

Vercel debería desplegar automáticamente si el repositorio ya está conectado.

## Comportamiento de la vista pública

Cuando no existe una sesión iniciada, la aplicación entra directamente a la **Consulta pública**.

La persona puede:

- cambiar de mes;
- filtrar por persona;
- filtrar por dominio;
- filtrar por proyecto;
- consultar la matriz mensual de standby;
- consultar intervenciones aprobadas/enviadas;
- descargar el reporte de standby a Excel;
- descargar intervenciones a Excel.

No muestra:

- horas acumuladas;
- tarifas;
- importes;
- valores a pagar;
- datos personales como correo, cédula o teléfono.

El reporte público de intervenciones contiene exactamente:

- Fecha
- Colaborador
- HORA INICIO Y FIN
- Ticket
- Actividad

Para iniciar sesión como administrador o colaborador se pulsa **Ingresar** en la barra lateral.

## CRUD del administrador

### Intervenciones

Crear / ver / editar / eliminar, además de aprobar y rechazar.

### Colaboradores

Crear / ver / editar / activar-desactivar / eliminar.

Si un colaborador ya tiene histórico, el sistema lo marca INACTIVO en vez de destruir información histórica.

### Proyectos

Crear / ver / editar / eliminar.

Si ya tiene registros relacionados, se marca INACTIVO.

### Tarifas

Crear / ver / editar / eliminar.

Si una tarifa ya está referenciada por registros históricos, se marca INACTIVA.

### Guardias T1

- crear desde una celda;
- consultar en matriz;
- editar/retirar desde una celda;
- asignar por rango;
- retirar por rango.

## Planificación por rango

En **Planificación** aparecen los botones:

- `Asignar rango`
- `Retirar rango`

Se selecciona:

- colaborador;
- proyecto;
- fecha desde;
- fecha hasta;
- alcance: todos / laborables / fines de semana.

Una guardia ya existente no se duplica. Una guardia cancelada dentro del rango se reactiva al volver a asignarla.

## Edición del colaborador

El colaborador solo trabaja sobre sus propias intervenciones.

Puede:

- crear;
- ver;
- editar si está BORRADOR, PENDIENTE o RECHAZADO.

No puede editar una intervención APROBADA o ENVIADA_A_PEOPLE.
