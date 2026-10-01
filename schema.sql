-- Standby Control - esquema productivo para Supabase/PostgreSQL
-- Ejecutar completo en Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists proyectos (
  id uuid primary key default gen_random_uuid(),
  codigo_proyecto text not null unique,
  nombre text not null,
  cliente text,
  project_manager text,
  responsable_directo text,
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','INACTIVO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dominios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','INACTIVO')),
  created_at timestamptz not null default now()
);

create table if not exists colaboradores (
  id uuid primary key default gen_random_uuid(),
  codigo_empleado text not null unique,
  nombres text not null,
  apellidos text not null,
  cedula text,
  dominio_id uuid references dominios(id),
  correo text unique,
  usuario_ntt text,
  telefono text,
  pais text not null default 'Ecuador',
  sociedad text default 'NECU',
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','INACTIVO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists colaborador_proyecto (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  fecha_inicio date not null default current_date,
  fecha_fin date,
  es_principal boolean not null default false,
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','INACTIVO')),
  created_at timestamptz not null default now(),
  unique(colaborador_id, proyecto_id, fecha_inicio)
);

create table if not exists tarifas_guardia (
  id uuid primary key default gen_random_uuid(),
  pais text not null default 'Ecuador',
  tipo_guardia text not null check (tipo_guardia in ('T1','T2')),
  tipo_dia text not null check (tipo_dia in ('LABORABLE','FDS','NAVIDAD','AN','FP')),
  valor numeric(10,2) not null check (valor >= 0),
  moneda text not null default 'USD',
  fecha_inicio_vigencia date not null,
  fecha_fin_vigencia date,
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','INACTIVO')),
  created_at timestamptz not null default now(),
  check (fecha_fin_vigencia is null or fecha_fin_vigencia >= fecha_inicio_vigencia)
);

create table if not exists calendario_especial (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  pais text not null default 'Ecuador',
  tipo_dia text not null check (tipo_dia in ('FDS','NAVIDAD','AN','FP')),
  descripcion text,
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','INACTIVO')),
  created_at timestamptz not null default now(),
  unique(fecha,pais)
);

create table if not exists guardias (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores(id),
  proyecto_id uuid not null references proyectos(id),
  fecha_guardia date not null,
  estado text not null default 'ASIGNADA' check (estado in ('ASIGNADA','CANCELADA','CERRADA')),
  asignado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(colaborador_id, proyecto_id, fecha_guardia)
);

create table if not exists intervenciones (
  id uuid primary key default gen_random_uuid(),
  guardia_id uuid not null references guardias(id),
  colaborador_id uuid not null references colaboradores(id),
  proyecto_id uuid not null references proyectos(id),
  fecha_intervencion date not null,
  inicio timestamptz,
  fin timestamptz,
  horas numeric(8,2) not null check (horas > 0),
  ticket text,
  actividad text not null,
  estado text not null default 'PENDIENTE' check (estado in ('BORRADOR','PENDIENTE','APROBADO','RECHAZADO','ENVIADO_PEOPLE')),
  tarifa_id uuid references tarifas_guardia(id),
  tarifa_aplicada numeric(10,2),
  valor_calculado numeric(10,2),
  origen text not null default 'PORTAL' check (origen in ('PORTAL','IMPORTADO_EXCEL')),
  creado_por uuid references auth.users(id),
  aprobado_por uuid references auth.users(id),
  aprobado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inicio is null or fin is null or fin > inicio)
);

create table if not exists cierres_mensuales (
  id uuid primary key default gen_random_uuid(),
  periodo text not null,
  proyecto_id uuid references proyectos(id),
  estado text not null default 'ABIERTO' check (estado in ('ABIERTO','CERRADO','ENVIADO_PEOPLE')),
  cerrado_por uuid references auth.users(id),
  cerrado_at timestamptz,
  enviado_people_por uuid references auth.users(id),
  enviado_people_at timestamptz,
  created_at timestamptz not null default now(),
  unique(periodo, proyecto_id)
);

-- Vincula usuarios autenticados con colaboradores y controla el rol.
create table if not exists perfiles_usuario (
  user_id uuid primary key references auth.users(id) on delete cascade,
  colaborador_id uuid unique references colaboradores(id) on delete set null,
  rol text not null default 'COLABORADOR' check (rol in ('ADMIN','COLABORADOR')),
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','INACTIVO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auditoria (
  id bigserial primary key,
  entidad text not null,
  entidad_id text not null,
  accion text not null,
  usuario_id uuid references auth.users(id),
  antes jsonb,
  despues jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_guardias_fecha on guardias(fecha_guardia);
create index if not exists idx_guardias_colaborador_fecha on guardias(colaborador_id,fecha_guardia);
create index if not exists idx_intervenciones_fecha on intervenciones(fecha_intervencion);
create index if not exists idx_intervenciones_colaborador_fecha on intervenciones(colaborador_id,fecha_intervencion);
create index if not exists idx_cp_colaborador on colaborador_proyecto(colaborador_id);
create index if not exists idx_cp_proyecto on colaborador_proyecto(proyecto_id);

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_proyectos_updated on proyectos;
create trigger trg_proyectos_updated before update on proyectos for each row execute function set_updated_at();
drop trigger if exists trg_colaboradores_updated on colaboradores;
create trigger trg_colaboradores_updated before update on colaboradores for each row execute function set_updated_at();
drop trigger if exists trg_guardias_updated on guardias;
create trigger trg_guardias_updated before update on guardias for each row execute function set_updated_at();
drop trigger if exists trg_intervenciones_updated on intervenciones;
create trigger trg_intervenciones_updated before update on intervenciones for each row execute function set_updated_at();
drop trigger if exists trg_perfiles_updated on perfiles_usuario;
create trigger trg_perfiles_updated before update on perfiles_usuario for each row execute function set_updated_at();

-- Helper para políticas RLS.
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles_usuario p
    where p.user_id = auth.uid() and p.rol = 'ADMIN' and p.estado = 'ACTIVO'
  );
$$;

create or replace function public.mi_colaborador_id() returns uuid
language sql stable security definer set search_path = public as $$
  select p.colaborador_id from perfiles_usuario p
  where p.user_id = auth.uid() and p.estado = 'ACTIVO' limit 1;
$$;

-- Auto-vincula un usuario nuevo con el colaborador cuyo correo coincida.
-- Por seguridad, todos nacen como COLABORADOR. El primer ADMIN se asigna manualmente.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_colaborador uuid;
begin
  select id into v_colaborador from colaboradores where lower(correo)=lower(new.email) limit 1;
  insert into perfiles_usuario(user_id,colaborador_id,rol,estado)
  values(new.id,v_colaborador,'COLABORADOR','ACTIVO')
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Validación crítica: un T2 solo puede pertenecer al mismo colaborador/proyecto de una guardia asignada.
create or replace function public.validar_intervencion_guardia() returns trigger
language plpgsql as $$
declare g guardias%rowtype;
begin
  select * into g from guardias where id = new.guardia_id;
  if not found then raise exception 'La guardia indicada no existe'; end if;
  if g.estado <> 'ASIGNADA' then raise exception 'La guardia no está activa'; end if;
  if g.colaborador_id <> new.colaborador_id then raise exception 'El colaborador no corresponde a la guardia'; end if;
  if g.proyecto_id <> new.proyecto_id then raise exception 'El proyecto no corresponde a la guardia'; end if;

  -- Para registros creados desde el portal, valida además que la hora esté dentro
  -- del período de standby descrito por el negocio. Los agregados históricos
  -- importados de Excel no tienen hora exacta y conservan solo la validación T1.
  if new.inicio is not null and new.origen = 'PORTAL' then
    if extract(isodow from g.fecha_guardia) between 1 and 5 then
      if not (
        ((new.inicio at time zone 'America/Guayaquil')::date = g.fecha_guardia
          and (new.inicio at time zone 'America/Guayaquil')::time >= time '18:00')
        or
        ((new.inicio at time zone 'America/Guayaquil')::date = g.fecha_guardia + 1
          and (new.inicio at time zone 'America/Guayaquil')::time <= time '08:59:59')
      ) then raise exception 'La intervención está fuera del horario de standby de la guardia seleccionada'; end if;
    else
      if (new.inicio at time zone 'America/Guayaquil')::date <> g.fecha_guardia then
        raise exception 'La intervención no corresponde a la fecha de standby seleccionada';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_validar_intervencion_guardia on intervenciones;
create trigger trg_validar_intervencion_guardia before insert or update on intervenciones
for each row execute function public.validar_intervencion_guardia();

-- Auditoría básica de cambios sensibles.
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into auditoria(entidad,entidad_id,accion,usuario_id,antes,despues)
  values(TG_TABLE_NAME,coalesce(new.id,old.id)::text,TG_OP,auth.uid(),
         case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
         case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  return coalesce(new,old);
end $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['colaboradores','proyectos','tarifas_guardia','guardias','intervenciones','cierres_mensuales']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON %I', t, t);
    EXECUTE format('CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION public.audit_row()', t, t);
  END LOOP;
END $$;

-- RLS
alter table proyectos enable row level security;
alter table dominios enable row level security;
alter table colaboradores enable row level security;
alter table colaborador_proyecto enable row level security;
alter table tarifas_guardia enable row level security;
alter table calendario_especial enable row level security;
alter table guardias enable row level security;
alter table intervenciones enable row level security;
alter table cierres_mensuales enable row level security;
alter table perfiles_usuario enable row level security;
alter table auditoria enable row level security;

-- Limpia políticas para poder re-ejecutar este script.
do $$ declare r record; begin
  for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in
  ('proyectos','dominios','colaboradores','colaborador_proyecto','tarifas_guardia','calendario_especial','guardias','intervenciones','cierres_mensuales','perfiles_usuario','auditoria')
  loop execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename); end loop;
end $$;

create policy proyectos_read on proyectos for select to authenticated using (true);
create policy proyectos_admin_write on proyectos for all to authenticated using (es_admin()) with check (es_admin());
create policy dominios_read on dominios for select to authenticated using (true);
create policy dominios_admin_write on dominios for all to authenticated using (es_admin()) with check (es_admin());
create policy tarifas_read on tarifas_guardia for select to authenticated using (true);
create policy tarifas_admin_write on tarifas_guardia for all to authenticated using (es_admin()) with check (es_admin());
create policy calendario_read on calendario_especial for select to authenticated using (true);
create policy calendario_admin_write on calendario_especial for all to authenticated using (es_admin()) with check (es_admin());

create policy colaboradores_read on colaboradores for select to authenticated
using (es_admin() or id = mi_colaborador_id());
create policy colaboradores_admin_write on colaboradores for all to authenticated
using (es_admin()) with check (es_admin());

create policy cp_read on colaborador_proyecto for select to authenticated
using (es_admin() or colaborador_id = mi_colaborador_id());
create policy cp_admin_write on colaborador_proyecto for all to authenticated
using (es_admin()) with check (es_admin());

create policy guardias_read on guardias for select to authenticated
using (es_admin() or colaborador_id = mi_colaborador_id());
create policy guardias_admin_write on guardias for all to authenticated
using (es_admin()) with check (es_admin());

create policy intervenciones_read on intervenciones for select to authenticated
using (es_admin() or colaborador_id = mi_colaborador_id());
create policy intervenciones_collab_insert on intervenciones for insert to authenticated
with check (colaborador_id = mi_colaborador_id() and estado in ('BORRADOR','PENDIENTE'));
create policy intervenciones_collab_update on intervenciones for update to authenticated
using (colaborador_id = mi_colaborador_id() and estado in ('BORRADOR','PENDIENTE','RECHAZADO'))
with check (colaborador_id = mi_colaborador_id() and estado in ('BORRADOR','PENDIENTE'));
create policy intervenciones_admin_write on intervenciones for all to authenticated
using (es_admin()) with check (es_admin());

create policy cierres_admin on cierres_mensuales for all to authenticated
using (es_admin()) with check (es_admin());

create policy perfiles_self_read on perfiles_usuario for select to authenticated using (user_id=auth.uid() or es_admin());
create policy perfiles_admin_write on perfiles_usuario for all to authenticated using (es_admin()) with check (es_admin());
create policy auditoria_admin_read on auditoria for select to authenticated using (es_admin());

-- Vista auxiliar. La app también puede calcular en cliente para explicar cada línea.
create or replace view v_guardias_detalle with (security_invoker=true) as
select g.id,g.fecha_guardia,g.estado,c.id colaborador_id,c.codigo_empleado,
       trim(c.nombres||' '||c.apellidos) empleado,c.sociedad,d.nombre dominio,
       p.id proyecto_id,p.codigo_proyecto,p.nombre proyecto
from guardias g join colaboradores c on c.id=g.colaborador_id
join proyectos p on p.id=g.proyecto_id
left join dominios d on d.id=c.dominio_id;

-- Si un colaborador se desactiva, su acceso también queda desactivado.
create or replace function public.sincronizar_estado_colaborador_usuario() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.estado is distinct from old.estado then
    update perfiles_usuario set estado=new.estado where colaborador_id=new.id;
  end if;
  return new;
end $$;
drop trigger if exists trg_sync_colaborador_estado on colaboradores;
create trigger trg_sync_colaborador_estado after update of estado on colaboradores
for each row execute function public.sincronizar_estado_colaborador_usuario();
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
