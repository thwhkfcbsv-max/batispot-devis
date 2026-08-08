-- Instrumentation d'usage de l'app Devis (funnel + blocages). Insert anon, lecture admin only.
create table if not exists public.devis_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  session_id  text,
  event_type  text not null,      -- app_open | wizard_skip | devis_genere | dictee | signature_ok | export_pdf | share | blocage ...
  user_id     uuid,
  meta        jsonb,
  page        text,
  ua          text
);
alter table public.devis_events enable row level security;
drop policy if exists anon_insert_devis_event on public.devis_events;
create policy anon_insert_devis_event on public.devis_events
  for insert to anon, authenticated with check (true);
-- pas de SELECT anon : lecture réservée à l'admin (PAT / service role)
create index if not exists idx_devis_events_created on public.devis_events (created_at desc);
create index if not exists idx_devis_events_type on public.devis_events (event_type, created_at desc);
