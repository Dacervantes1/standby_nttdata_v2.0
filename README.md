# Standby Control V2

Aplicación web para gestionar T1 (standby) y T2 (intervenciones remotas) con Supabase y Vercel.

## Vistas

### Consulta pública (sin login)

Es la vista inicial. Permite consultar y descargar reportes con filtros por mes, persona, dominio y proyecto.

La vista pública no muestra horas acumuladas, tarifas ni dinero. Las intervenciones públicas muestran únicamente:

`Fecha | Colaborador | HORA INICIO Y FIN | Ticket | Actividad`

Solo se publican intervenciones `APROBADO` o `ENVIADO_PEOPLE`.

### Administrador

CRUD completo para:

- colaboradores;
- proyectos;
- tarifas;
- intervenciones;
- planificación de guardias T1.

También incluye aprobación/rechazo de T2, reportes económicos y exportación Excel.

La planificación permite asignación individual y **por rango de fechas**.

### Colaborador

Puede:

- consultar sus standby;
- consultar su calendario;
- crear intervenciones;
- ver sus intervenciones;
- editar únicamente sus intervenciones no aprobadas.

## Seguridad

- Las tablas base siguen protegidas por Supabase RLS.
- El acceso público se realiza mediante vistas que exponen solamente columnas autorizadas.
- La vista pública no expone correo, cédula, teléfono, tarifas o importes.
- Un colaborador no puede acceder a CRUD administrativo.

## Actualización desde la versión anterior

Consulta `UPGRADE_V2.md`.

Ejecuta `MIGRACION_V2.sql` en Supabase antes de desplegar los nuevos archivos web.

## Instalación nueva

1. Crear proyecto Supabase.
2. Ejecutar `schema.sql`.
3. Ejecutar `seed.sql`.
4. Configurar `config.js`.
5. Publicar en Vercel.

> `schema.sql` ya incorpora la actualización V2 al final, por lo que en una instalación nueva no es necesario ejecutar además `MIGRACION_V2.sql`.
