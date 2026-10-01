# Deploy: Supabase + Vercel

## 1. Crear proyecto en Supabase

1. Entra a Supabase y crea un proyecto nuevo.
2. Espera a que la base PostgreSQL esté lista.
3. Ve a **SQL Editor**.
4. Ejecuta primero `schema.sql` completo.
5. Después ejecuta `seed.sql` completo.

## 2. Crear el primer usuario administrador

Hazlo después de ejecutar `seed.sql`.

1. En Supabase abre **Authentication → Users → Add user**.
2. Crea un usuario con tu correo y una contraseña segura.
3. Copia el UUID del usuario creado.
4. En SQL Editor ejecuta:

```sql
update public.perfiles_usuario
set rol = 'ADMIN', estado = 'ACTIVO'
where user_id = 'PEGA_AQUI_EL_UUID_DEL_USUARIO';
```

No hace falta que el administrador esté asociado a un colaborador para administrar el sistema.

## 3. Crear acceso para colaboradores

Para cada colaborador que deba ingresar:

1. Ve a **Authentication → Users → Add user**.
2. Usa exactamente el mismo correo que aparece en `colaboradores.correo`.
3. Asigna una contraseña temporal o envía invitación, según tu configuración de Supabase.

El trigger `handle_new_user` enlazará automáticamente ese usuario con el colaborador por correo y le asignará el rol `COLABORADOR`.

Si un colaborador se marca como `INACTIVO`, el sistema también inactiva su perfil de acceso.

## 4. Obtener las claves del proyecto

En Supabase ve a **Project Settings → API** y copia:

- Project URL
- anon / public key

Abre `config.js` y reemplaza:

```js
SUPABASE_URL: 'REEMPLAZAR_CON_TU_SUPABASE_URL',
SUPABASE_ANON_KEY: 'REEMPLAZAR_CON_TU_SUPABASE_ANON_KEY'
```

La anon key puede estar en el navegador; las políticas RLS son las que protegen la información. **Nunca pongas la service_role key en `config.js`.**

## 5. Probar localmente

Desde la carpeta del proyecto:

```bash
python -m http.server 8080
```

Abre:

```text
http://localhost:8080
```

Prueba primero con el usuario ADMIN y luego con un usuario COLABORADOR.

## 6. Publicar en GitHub

Crea un repositorio y sube la carpeta del proyecto.

Como mínimo deben estar:

```text
index.html
styles.css
app.js
config.js
schema.sql
seed.sql
README.md
DEPLOY.md
```

## 7. Deploy en Vercel

1. Entra a Vercel.
2. **Add New → Project**.
3. Importa el repositorio de GitHub.
4. Framework Preset: **Other**.
5. No necesitas Build Command.
6. No necesitas Output Directory personalizada.
7. Pulsa **Deploy**.

Vercel entregará una URL similar a:

```text
https://standby-control.vercel.app
```

## 8. Comprobaciones después del deploy

### Como ADMIN

- Dashboard muestra el mes seleccionado.
- Filtros por persona, dominio y proyecto funcionan.
- Puedes cambiar de mes.
- Puedes marcar/desmarcar G en Planificación.
- Varias personas del mismo dominio pueden tener G el mismo día.
- Puedes agregar/editar/desactivar colaboradores.
- Puedes aprobar/rechazar T2.
- Reportes muestran horas e importes.
- Exportación Excel descarga tres hojas.

### Como COLABORADOR

- No aparecen módulos administrativos.
- Si intenta operar sobre tablas administrativas, RLS lo bloquea igualmente.
- Ve su calendario mensual de standby.
- Ve listado de sus días de guardia.
- Puede registrar T2 únicamente utilizando una guardia propia existente.
- Ve sus horas, estados y estimado mensual.

## 9. Nota sobre el primer período cargado

La carga inicial incluida contiene el conjunto de datos ya procesado durante el MVP, principalmente junio de 2026. El selector de mes funciona para cualquier período; los meses sin datos se mostrarán vacíos y podrán planificarse directamente desde la aplicación.


---

# Actualización V2 para un proyecto ya desplegado

Si ya tienes Standby Control funcionando en Supabase/Vercel, **no vuelvas a ejecutar `seed.sql`**.

1. En Supabase > SQL Editor ejecuta `MIGRACION_V2.sql`.
2. Conserva tu `config.js` actual con la URL y anon key reales.
3. Reemplaza `index.html`, `styles.css` y `app.js` por los de esta versión.
4. Haz commit/push al repositorio conectado a Vercel.
5. Verifica primero la Consulta pública y luego ingresa con ADMIN y COLABORADOR.

La página sin sesión abre ahora la Consulta pública. Desde la barra lateral se pulsa **Ingresar** para abrir el login administrativo/colaborador.
