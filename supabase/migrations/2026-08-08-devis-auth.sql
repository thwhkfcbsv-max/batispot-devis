-- =====================================================================
-- BatiSpot Devis — schéma cloud pour l'app devis.batispot.pro
-- Login magic-link (Supabase Auth) → bibliothèque cloud par artisan.
-- Idempotent : ré-exécutable sans casse. Isolé du site batispot.pro (RLS owner-only).
-- =====================================================================

-- ---- Trigger updated_at (partagé) -----------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---- Profil de l'artisan (1 ligne par compte authentifié) -----------
create table if not exists public.profils_artisan (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  nom         text,
  contact     text,
  tel         text,
  email       text,
  siret       text,
  adresse     text,
  forme       text,
  tva_intra   text,
  decennale   text,
  mediateur   text,
  couleur     text,
  logo        text,          -- data URL (base64) du logo, optionnel
  compteur    int  not null default 0,  -- numérotation devis côté serveur
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_profils_artisan_touch on public.profils_artisan;
create trigger trg_profils_artisan_touch before update on public.profils_artisan
  for each row execute function public.touch_updated_at();

-- ---- Documents : devis & factures ----------------------------------
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  numero      int  not null,
  type        text not null default 'devis',       -- devis | facture
  statut      text not null default 'brouillon',    -- brouillon | envoyé | signé | facturé
  client_nom  text,
  total_ttc   numeric,
  piece       text,
  data        jsonb not null,                        -- snapshot complet (lignes, tva, echeancier, signature, client)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
  -- NB : PAS de unique(user_id,type,numero). L'identité = id (uuid client, PK).
  -- Le numéro d'affichage peut être ré-attribué et n'est pas une clé d'unicité
  -- (deux appareils hors-ligne peuvent produire le même numéro sur des devis distincts).
);
-- Au cas où une ancienne version aurait posé la contrainte :
alter table public.documents drop constraint if exists documents_user_id_type_numero_key;

create index if not exists idx_documents_user_created
  on public.documents (user_id, created_at desc);
create index if not exists idx_documents_user_type_numero
  on public.documents (user_id, type, numero);

drop trigger if exists trg_documents_touch on public.documents;
create trigger trg_documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

-- ---- RLS : chaque artisan ne voit et n'écrit QUE ses données --------
alter table public.profils_artisan enable row level security;
alter table public.documents       enable row level security;

drop policy if exists own_profil_all on public.profils_artisan;
create policy own_profil_all on public.profils_artisan
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists own_documents_all on public.documents;
create policy own_documents_all on public.documents
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
