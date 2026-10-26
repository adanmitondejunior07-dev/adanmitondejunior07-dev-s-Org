-- =========================================================================
-- ARTISANPRO AFRIQUE — MIGRATION OFFICIELLE VÉRIFICATION ET NOTIFICATIONS
-- Tables Supabase, Index, RLS Strictes et Storage Privé
-- =========================================================================

-- 1. Table des demandes de vérification (KYC)
CREATE TABLE IF NOT EXISTS public.demandes_verification (
  id TEXT PRIMARY KEY,
  artisan_id TEXT NOT NULL,
  artisan_name TEXT NOT NULL,
  artisan_email TEXT NOT NULL,
  metier TEXT NOT NULL,
  ville TEXT NOT NULL,
  pays TEXT DEFAULT 'Côte d''Ivoire',
  cni_url TEXT NOT NULL,
  selfie_url TEXT NOT NULL,
  atelier_url TEXT NOT NULL,
  diplome_url TEXT NOT NULL,
  cni_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('unverified', 'pending', 'in_review', 'verified', 'rejected')),
  rejection_reason TEXT,
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_demandes_artisan_id ON public.demandes_verification(artisan_id);
CREATE INDEX IF NOT EXISTS idx_demandes_status ON public.demandes_verification(status);

-- Activation de RLS
ALTER TABLE public.demandes_verification ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour demandes_verification
DROP POLICY IF EXISTS "Les membres consultent leur propre dossier" ON public.demandes_verification;
CREATE POLICY "Les membres consultent leur propre dossier"
ON public.demandes_verification FOR SELECT
USING (
  artisan_id = auth.uid()::text OR
  auth.jwt()->>'email' = 'adanmitondejunior07@gmail.com' OR
  auth.uid() = '29a23578-640c-434c-bb7c-5b1cb7a30a91'::uuid
);

DROP POLICY IF EXISTS "Les membres soumettent leur propre dossier" ON public.demandes_verification;
CREATE POLICY "Les membres soumettent leur propre dossier"
ON public.demandes_verification FOR INSERT
WITH CHECK (
  artisan_id = auth.uid()::text OR
  auth.jwt()->>'email' = 'adanmitondejunior07@gmail.com'
);

DROP POLICY IF EXISTS "L'administrateur prend une décision sur les dossiers" ON public.demandes_verification;
CREATE POLICY "L'administrateur prend une décision sur les dossiers"
ON public.demandes_verification FOR UPDATE
USING (
  auth.jwt()->>'email' = 'adanmitondejunior07@gmail.com' OR
  auth.uid() = '29a23578-640c-434c-bb7c-5b1cb7a30a91'::uuid
);

-- 2. Table des notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  target_page TEXT,
  target_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifs_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_is_read ON public.notifications(is_read);

-- Activation RLS pour notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les utilisateurs consultent leurs propres notifications" ON public.notifications;
CREATE POLICY "Les utilisateurs consultent leurs propres notifications"
ON public.notifications FOR SELECT
USING (
  user_id = auth.uid()::text OR 
  user_id = 'all' OR
  auth.jwt()->>'email' = 'adanmitondejunior07@gmail.com' OR
  auth.uid() = '29a23578-640c-434c-bb7c-5b1cb7a30a91'::uuid
);

DROP POLICY IF EXISTS "Les utilisateurs peuvent marquer leurs notifications comme lues" ON public.notifications;
CREATE POLICY "Les utilisateurs peuvent marquer leurs notifications comme lues"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid()::text OR auth.jwt()->>'email' = 'adanmitondejunior07@gmail.com')
WITH CHECK (user_id = auth.uid()::text OR auth.jwt()->>'email' = 'adanmitondejunior07@gmail.com');

DROP POLICY IF EXISTS "Insertion de notifications" ON public.notifications;
CREATE POLICY "Insertion de notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- 3. Bucket de stockage privé pour les documents d'identité
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS sur le bucket de stockage
DROP POLICY IF EXISTS "Dépôt privé de documents de vérification" ON storage.objects;
CREATE POLICY "Dépôt privé de documents de vérification"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Consultation privée de ses propres documents" ON storage.objects;
CREATE POLICY "Consultation privée de ses propres documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-docs' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    auth.jwt()->>'email' = 'adanmitondejunior07@gmail.com' OR
    auth.uid() = '29a23578-640c-434c-bb7c-5b1cb7a30a91'::uuid
  )
);
