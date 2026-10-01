-- Standby Control V2 - migracion incremental
-- Ejecutar UNA VEZ en el SQL Editor de Supabase antes de desplegar la V2.
-- No borra ni reemplaza los datos existentes.

-- Vistas de solo lectura para la consulta publica.
-- Exponen un subconjunto deliberado de columnas y NO abren acceso anonimo
-- a las tablas base protegidas por RLS.

create or replace view public.v_public_proyectos
with (security_invoker=false, security_barrier=true) as
select id, codigo_proyecto, nombre, estado
from public.proyectos;

create or replace view public.v_public_dominios
with (security_invoker=false, security_barrier=true) as
select id, nombre, estado
from public.dominios;

create or replace view public.v_public_colaboradores
with (security_invoker=false, security_barrier=true) as
select id, codigo_empleado, nombres, apellidos, dominio_id, estado
from public.colaboradores;

create or replace view public.v_public_colaborador_proyecto
with (security_invoker=false, security_barrier=true) as
select colaborador_id, proyecto_id, estado, fecha_inicio, fecha_fin
from public.colaborador_proyecto;

create or replace view public.v_public_calendario_especial
with (security_invoker=false, security_barrier=true) as
select fecha, tipo_dia, estado
from public.calendario_especial;

create or replace view public.v_public_guardias
with (security_invoker=false, security_barrier=true) as
select id, colaborador_id, proyecto_id, fecha_guardia,
       case when estado in ('ASIGNADA','CERRADA') then 'ASIGNADA' else estado end as estado
from public.guardias
where estado in ('ASIGNADA','CERRADA');

create or replace view public.v_public_intervenciones
with (security_invoker=false, security_barrier=true) as
select id, colaborador_id, proyecto_id, fecha_intervencion,
       inicio, fin, ticket, actividad
from public.intervenciones
where estado in ('APROBADO','ENVIADO_PEOPLE');

-- La cuenta anon solo recibe SELECT sobre estas vistas controladas.
grant select on public.v_public_proyectos to anon, authenticated;
grant select on public.v_public_dominios to anon, authenticated;
grant select on public.v_public_colaboradores to anon, authenticated;
grant select on public.v_public_colaborador_proyecto to anon, authenticated;
grant select on public.v_public_calendario_especial to anon, authenticated;
grant select on public.v_public_guardias to anon, authenticated;
grant select on public.v_public_intervenciones to anon, authenticated;

-- Mantiene la politica de colaborador: puede editar solo sus T2 no aprobados.
-- La politica ya existe en instalaciones anteriores; se recrea de forma idempotente.
drop policy if exists intervenciones_collab_update on public.intervenciones;
create policy intervenciones_collab_update on public.intervenciones
for update to authenticated
using (
  colaborador_id = public.mi_colaborador_id()
  and estado in ('BORRADOR','PENDIENTE','RECHAZADO')
)
with check (
  colaborador_id = public.mi_colaborador_id()
  and estado in ('BORRADOR','PENDIENTE')
);

-- Fuerza refresco del esquema de PostgREST/Supabase.
notify pgrst, 'reload schema';
