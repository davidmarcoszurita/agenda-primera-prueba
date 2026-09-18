# Agenda (Supabase + Railway)

Agenda funcional multiusuario: cada persona crea su cuenta, inicia sesión y ve
únicamente sus propios eventos. La base de datos y la autenticación corren en
Supabase; el servidor (Node/Express) sirve la app y se despliega en Railway.

## 1. Configurar Supabase

1. Crea un proyecto en https://supabase.com (o usa uno existente).
2. Ve a **SQL Editor** y ejecuta el contenido del archivo `supabase.sql`
   incluido aquí. Esto crea la tabla `events` con seguridad a nivel de fila
   (RLS), de modo que cada usuario solo accede a sus propios datos.
3. Ve a **Authentication → Providers** y confirma que "Email" esté habilitado
   (viene activado por defecto). Si quieres que los usuarios entren sin
   confirmar su correo, desactiva "Confirm email" en
   **Authentication → Settings**.
4. Ve a **Project Settings → API** y copia:
   - `Project URL` → será `SUPABASE_URL`
   - `anon public` key → será `SUPABASE_ANON_KEY`
   (la clave `anon` está diseñada para exponerse en el frontend; la seguridad
   real la da RLS, no el secreto de esta clave).

## 2. Probar en local (opcional)

```bash
npm install
cp .env.example .env
# Edita .env con tus valores de Supabase
npm start
```

Abre http://localhost:3000

## 3. Desplegar en Railway

1. Sube esta carpeta a un repositorio de GitHub (o usa Railway CLI para subir
   directamente).
2. En https://railway.app crea un **New Project → Deploy from GitHub repo** y
   selecciona el repositorio.
3. Railway detecta `package.json` y `Procfile` automáticamente y usa
   `node server.js` como comando de arranque.
4. En el servicio, ve a **Variables** y añade:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. Railway asigna el puerto automáticamente mediante la variable `PORT`, que
   el servidor ya usa (`server.js`). No necesitas configurarla.
6. Cuando termine el deploy, Railway te da una URL pública (algo como
   `tuapp.up.railway.app`). Esa es la agenda ya lista para que cualquier
   usuario cree su cuenta y la use.

### Con Claude Code

Si prefieres hacerlo con Claude Code en tu propia máquina:

```bash
cd agenda-app
claude
```

Y pídele por ejemplo: *"inicializa un repo git, haz el primer commit y
conéctalo a Railway con railway CLI"* — Claude Code puede ejecutar
`git init`, `railway login`, `railway up`, etc. directamente en tu terminal.
Este proyecto ya está listo para que lo tome como punto de partida: puedes
pedirle que añada recordatorios, vista semanal/mensual completa, invitar a
otros usuarios a un mismo evento, etc.

## Estructura del proyecto

```
agenda-app/
├── server.js          # Servidor Express (sirve el frontend + config pública)
├── package.json
├── Procfile            # Comando de arranque para Railway
├── .env.example
├── supabase.sql         # Tabla `events` + políticas RLS
└── public/
    ├── index.html
    ├── styles.css
    └── app.js           # Auth + CRUD de eventos contra Supabase
```

## Cómo funciona el multiusuario

- El frontend usa `supabase-js` directamente (cargado desde CDN) para
  registro, login y consultas.
- Cada fila de `events` tiene un `user_id`. Las políticas RLS de Supabase
  impiden que un usuario lea o modifique eventos de otro, sin necesidad de
  lógica adicional en el servidor.
- El servidor Node solo sirve archivos estáticos y expone `SUPABASE_URL` /
  `SUPABASE_ANON_KEY` en `/config.js`, para no tener que hardcodear esos
  valores en el HTML.

## Próximos pasos sugeridos

- Vista semanal o mensual completa (hoy es agenda por día).
- Recordatorios por correo (se pueden disparar con Supabase Edge Functions).
- Compartir eventos entre usuarios (tabla intermedia `event_invites`).
