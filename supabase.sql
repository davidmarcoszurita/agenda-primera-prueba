-- Ejecuta esto en Supabase: Dashboard -> SQL Editor -> New query -> Run

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

-- Cada usuario solo ve, crea, edita y borra SUS propios eventos.
create policy "select_own_events"
  on public.events for select
  using (auth.uid() = user_id);

create policy "insert_own_events"
  on public.events for insert
  with check (auth.uid() = user_id);

create policy "update_own_events"
  on public.events for update
  using (auth.uid() = user_id);

create policy "delete_own_events"
  on public.events for delete
  using (auth.uid() = user_id);

create index if not exists events_user_start_idx
  on public.events (user_id, start_time);
