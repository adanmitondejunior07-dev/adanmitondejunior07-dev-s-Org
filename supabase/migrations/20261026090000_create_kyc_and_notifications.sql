-- ==============================================================================
-- ARTISANPRO AFRIQUE — MIGRATION KYC ET NOTIFICATIONS SÉCURISÉES
-- ==============================================================================

-- 1. Table des notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  message text not null,
  type text not null default 'system',
  target_page text,
  target_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Index pour requêtes rapides par destinataire et date
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

-- Activer RLS sur les notifications
alter table public.notifications enable row level security;

-- Lecture : utilisateur lit ses notifications ou diffusions générales ('all') ou admin
create policy "Users can read own notifications" on public.notifications
  for select
  using (
    auth.uid()::text = user_id or 
    user_id = 'all' or 
    auth.jwt()->>'email' = 'adanmitondejunior07@gmail.com'
  );

-- Insertion de notification
create policy "Users and system can insert notifications" on public.notifications
  for insert
  with check (true);

-- Mise à jour (marquer comme lu)
create policy "Users can update own notifications" on public.notifications
  for update
  using (
    auth.uid()::text = user_id or 
    auth.jwt()->>'email' = 'adanmitondejunior07@gmail.com'
  );

-- 2. Table des demandes de vérification KYC (4 pièces justificatives)
create table if not exists public.verification_requests (
  id text primary key,
  artisan_id text not null,
  artisan_name text not null,
  artisan_email text,
  metier text,
  ville text,
  pays text default 'Côte d''Ivoire',
  cni_url text not null,
  selfie_url text not null,
  atelier_url text not null,
  diplome_url text not null,
  cni_number text,
  notes text,
  status text not null default 'pending', -- 'pending', 'in_review', 'verified', 'rejected'
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  history jsonb default '[]'::jsonb
);

create index if not exists idx_verification_requests_artisan_id on public.verification_requests(artisan_id);
create index if not exists idx_verification_requests_status on public.verification_requests(status);

alter table public.verification_requests enable row level security;

-- L'artisan peut lire son propre dossier, l'admin peut tout lire
create policy "Artisans read own verification request" on public.verification_requests
  for select
  using (
    auth.uid()::text = artisan_id or
    auth.jwt()->>'email' = 'adanmitondejunior07@gmail.com' or
    auth.uid()::text = '29a23578-640c-434c-bb7c-5b1cb7a30a91'
  );

-- L'artisan peut soumettre une demande
create policy "Artisans insert verification request" on public.verification_requests
  for insert
  with check (
    auth.uid()::text = artisan_id or
    auth.jwt()->>'email' = 'adanmitondejunior07@gmail.com' or
    auth.uid()::text = '29a23578-640c-434c-bb7c-5b1cb7a30a91'
  );

-- Seul l'administrateur peut mettre à jour le statut, approuver ou refuser
create policy "Admin review verification request" on public.verification_requests
  for update
  using (
    auth.jwt()->>'email' = 'adanmitondejunior07@gmail.com' or
    auth.uid()::text = '29a23578-640c-434c-bb7c-5b1cb7a30a91'
  );
