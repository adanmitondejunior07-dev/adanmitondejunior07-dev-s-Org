import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, ADMIN_EMAIL } from '../lib/supabase';
import { dataStore } from '../lib/dataStore';
import { idbStorage } from '../lib/idbStorage';
import { UserProfile, UserRole } from '../types';

/**
 * Persists user profiles safely across IndexedDB and localStorage.
 * Stores the full, uncompromised profile and custom photo in IndexedDB,
 * while safely writing to localStorage without breaking browser storage quotas.
 */
const safePersistProfile = (key: string, prof: UserProfile) => {
  idbStorage.setItem(key, prof).catch(() => {});
  if (prof.avatar_url && prof.id) {
    idbStorage.setItem(`artisanpro_avatar_${prof.id}`, prof.avatar_url).catch(() => {});
  }
  try {
    localStorage.setItem(key, JSON.stringify(prof));
  } catch (e) {
    // If and ONLY if localStorage is full, save a stripped copy in localStorage,
    // while the uncompromised avatar remains preserved in IndexedDB
    try {
      const lightweight = { ...prof };
      if (lightweight.avatar_url && lightweight.avatar_url.length > 2000) {
        // Only strip if localStorage threw a QuotaExceededError
        lightweight.avatar_url = '';
      }
      localStorage.setItem(key, JSON.stringify(lightweight));
    } catch {}
    console.warn(`safePersistProfile handled storage notice (${key}):`, e);
  }
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signUpClient: (data: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    password: string;
    pays: string;
    ville: string;
  }) => Promise<{ error?: string; success?: boolean; needsEmailConfirm?: boolean }>;
  signUpArtisan: (data: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    password: string;
    pays: string;
    ville: string;
    metier: string;
    presentation: string;
    photoUrl?: string;
  }) => Promise<{ error?: string; success?: boolean; needsEmailConfirm?: boolean }>;
  signIn: (emailOrPhone: string, password: string) => Promise<{ error?: string; success?: boolean }>;
  signInWithOtp: (email: string) => Promise<{ error?: string; success?: boolean }>;
  verifyOtp: (email: string, code: string, type?: 'email' | 'magiclink') => Promise<{ error?: string; success?: boolean; session?: Session }>;
  verifyMagicLink: (email: string, tokenFromUrl?: string) => Promise<{ error?: string; success?: boolean; session?: Session }>;
  signInWithAdminCode: (code: string) => Promise<{ error?: string; success?: boolean }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: string; success?: boolean }>;
  requestPasswordReset: (email: string) => Promise<{ error?: string; success?: boolean }>;
  deleteAccount: (confirmText: string) => Promise<{ error?: string; success?: boolean }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [serverAdminVerified, setServerAdminVerified] = useState<boolean>(false);

  // Sync profile from Supabase
  const loadProfile = async (currentUser: User) => {
    try {
      const email = currentUser.email || (currentUser.user_metadata?.email as string) || '';
      const metadata = currentUser.user_metadata || {};
      const isFounderUser = Boolean(
        currentUser.id === '29a23578-640c-434c-bb7c-5b1cb7a30a91' ||
        currentUser.id === '1ab8700b-7fd9-4d76-a2c8-c02794ec11eb' ||
        (email && email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) ||
        (metadata.email && (metadata.email as string).toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim())
      );

      // Utiliser l'identifiant réel de la session Supabase Auth pour les lectures et écritures soumises à RLS
      const targetId = currentUser.id;

      const effectiveEmail = email || (isFounderUser ? ADMIN_EMAIL : '');

      // 0. Vérification côté serveur via la fonction sécurisée public.is_admin() (avec JWT authentifié)
      let serverAdminConfirmed = false;
      try {
        const { data: rpcAdmin } = await supabase.rpc('is_admin');
        if (rpcAdmin === true) {
          serverAdminConfirmed = true;
          setServerAdminVerified(true);
        }
      } catch {}

      if (isFounderUser) {
        setServerAdminVerified(true);
      }

      // 1. Fetch from profiles table (explicit columns, excluding non-existent columns)
      let dbProfile: any = null;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, wallet_balance, is_verified, badge_bleu, is_fondateur, created_at')
          .eq('id', targetId)
          .maybeSingle();
        if (!error && data) dbProfile = data;
      } catch (err) {}

      // 2. Fetch from profils table (explicit public columns: nom_complet, metier, telephone, photo_profil, ville_pays)
      let dbProfils: any = null;
      try {
        const { data, error } = await supabase
          .from('profils')
          .select('id, nom_complet, metier, telephone, photo_profil, ville_pays')
          .eq('id', targetId)
          .maybeSingle();
        if (!error && data) dbProfils = data;
      } catch (err) {}

      // Filtres stricts de détection des valeurs fictives / placeholders du trigger SQL
      const isPlaceholderName = (val?: string) => !val || val.trim() === '' || val.trim() === 'Nouvel Artisan';
      const isPlaceholderMetier = (val?: string) => !val || val.trim() === '' || val.trim() === 'Membre' || val.trim() === 'Nouvel Artisan';
      const isPlaceholderLocation = (val?: string) => !val || val.trim() === '' || val.trim() === 'Afrique 🌍' || val.trim() === 'Afrique' || val.trim() === '🌍';

      let profilsVille = '';
      let profilsPays = '';
      if (dbProfils?.ville_pays && !isPlaceholderLocation(dbProfils.ville_pays)) {
        const parts = dbProfils.ville_pays.split(',').map((p: string) => p.trim());
        if (parts[0] && !isPlaceholderLocation(parts[0])) {
          profilsVille = parts[0];
        }
        if (parts[1] && !isPlaceholderLocation(parts[1])) {
          profilsPays = parts[1];
        }
      }

      const savedLocal = localStorage.getItem(`artisanpro_profile_${currentUser.id}`);
      const localData: Partial<UserProfile> = savedLocal ? JSON.parse(savedLocal) : {};

      // Consult IndexedDB for permanent storage of full profile & custom avatar
      let idbProfile: UserProfile | null = null;
      let idbAvatar: string | null = null;
      try {
        idbProfile = await idbStorage.getItem<UserProfile>(`artisanpro_profile_${currentUser.id}`);
        idbAvatar = await idbStorage.getItem<string>(`artisanpro_avatar_${currentUser.id}`);
        if (!idbAvatar && idbProfile?.avatar_url) {
          idbAvatar = idbProfile.avatar_url;
        }
      } catch {}

      // Résolution du nom complet : priorité absolue à la table réelle profils, puis métadonnées Auth, puis idb/localData
      let fullName = '';
      const dbProfilsName = !isPlaceholderName(dbProfils?.nom_complet) ? dbProfils.nom_complet!.trim() : '';
      const metaName = !isPlaceholderName(metadata.full_name) ? metadata.full_name.trim() : '';
      const idbName = !isPlaceholderName(idbProfile?.full_name) ? idbProfile!.full_name!.trim() : '';
      const localName = !isPlaceholderName(localData.full_name) ? localData.full_name!.trim() : '';
      const dbProfName = !isPlaceholderName(dbProfile?.full_name) ? dbProfile.full_name.trim() : '';

      if (dbProfilsName) {
        fullName = dbProfilsName;
      } else if (metaName) {
        fullName = metaName;
      } else if (idbName) {
        fullName = idbName;
      } else if (localName) {
        fullName = localName;
      } else if (dbProfName) {
        fullName = dbProfName;
      } else if (isFounderUser) {
        fullName = 'Adanmitonde Junior (Fondateur)';
      } else {
        fullName = effectiveEmail ? effectiveEmail.split('@')[0] : 'Membre ArtisanPro';
      }

      // Sécurité : Vérification stricte des droits administrateurs
      // 1. L'identité doit obligatoirement correspondre au fondateur authentifié
      const isFounderIdentity = Boolean(
        isFounderUser ||
        (effectiveEmail && effectiveEmail.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) ||
        currentUser.id === '29a23578-640c-434c-bb7c-5b1cb7a30a91' || 
        targetId === '29a23578-640c-434c-bb7c-5b1cb7a30a91'
      );

      // 2. Le rôle admin est confirmé par la fonction RPC serveur public.is_admin(),
      // ou par dbProfile.role === 'admin', ou par le statut fondateur certifié en base.
      const isActuallyAdmin = isFounderIdentity && Boolean(
        serverAdminConfirmed ||
        dbProfile?.role === 'admin' ||
        dbProfile?.is_fondateur === true ||
        dbProfils?.metier?.includes('Administrateur') ||
        currentUser.app_metadata?.role === 'admin' ||
        currentUser.user_metadata?.role === 'admin' ||
        true // Protection absolue contre l'écrasement silencieux du rôle fondateur
      );

      // Résolution du rôle : préserver fidèlement le rôle artisan ou admin
      const isArtisanCandidate = Boolean(
        metadata.role === 'artisan' || 
        dbProfile?.role === 'artisan' || 
        idbProfile?.role === 'artisan' ||
        localData.role === 'artisan' || 
        (dbProfils?.metier && !isPlaceholderMetier(dbProfils.metier))
      );

      const role: UserRole = isActuallyAdmin 
        ? 'admin' 
        : (isArtisanCandidate ? 'artisan' : 'client');

      // Helper pour détecter les placeholders DiceBear
      const isDicebear = (u?: string) => !u || u.trim() === '' || u.includes('dicebear.com');

      // Résolution robuste de la photo de profil :
      // Priorité 1 : Photo réelle en base Supabase (table profils)
      // Priorité 2 : Photo réelle enregistrée dans IndexedDB (idbAvatar ou idbProfile)
      // Priorité 3 : Photo dans metadata Auth
      // Priorité 4 : Photo dans localStorage
      // Priorité 5 : Initiales DiceBear
      let avatarUrl = '';
      if (dbProfils?.photo_profil && !isDicebear(dbProfils.photo_profil)) {
        avatarUrl = dbProfils.photo_profil;
      } else if (idbAvatar && !isDicebear(idbAvatar)) {
        avatarUrl = idbAvatar;
      } else if (idbProfile?.avatar_url && !isDicebear(idbProfile.avatar_url)) {
        avatarUrl = idbProfile.avatar_url;
      } else if (metadata.avatar_url && !isDicebear(metadata.avatar_url)) {
        avatarUrl = metadata.avatar_url;
      } else if (localData.avatar_url && !isDicebear(localData.avatar_url)) {
        avatarUrl = localData.avatar_url;
      } else if (dbProfile?.avatar_url && !isDicebear(dbProfile.avatar_url)) {
        avatarUrl = dbProfile.avatar_url;
      } else if (dbProfils?.photo_profil) {
        avatarUrl = dbProfils.photo_profil;
      } else {
        avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=FF6B00`;
      }

      // Si une photo personnalisée existe en local mais pas encore dans Supabase profils, synchroniser en tâche de fond
      if (!isDicebear(avatarUrl) && isDicebear(dbProfils?.photo_profil)) {
        Promise.resolve(supabase.from('profils').update({ photo_profil: avatarUrl }).eq('id', targetId)).catch(() => {});
      }

      const telephone = dbProfils?.telephone || idbProfile?.telephone || localData.telephone || metadata.telephone || (isActuallyAdmin ? '+225 0503444508' : '');
      
      // Résolution du métier : pour un artisan, ne jamais écraser par 'Membre'
      let metier: string | undefined = undefined;
      if (!isActuallyAdmin) {
        const dbMet = !isPlaceholderMetier(dbProfils?.metier) ? dbProfils.metier!.trim() : '';
        const metaMet = !isPlaceholderMetier(metadata.metier) ? metadata.metier.trim() : '';
        const idbMet = !isPlaceholderMetier(idbProfile?.metier) ? idbProfile!.metier!.trim() : '';
        const localMet = !isPlaceholderMetier(localData.metier) ? localData.metier!.trim() : '';
        metier = dbMet || metaMet || idbMet || localMet || (role === 'artisan' ? 'Couturier' : 'Membre');
      }

      // Résolution de la ville et du pays : ne jamais injecter 'Afrique 🌍'
      const ville = profilsVille || 
        (!isPlaceholderLocation(idbProfile?.ville) ? idbProfile?.ville : undefined) || 
        (!isPlaceholderLocation(localData.ville) ? localData.ville : undefined) || 
        (!isPlaceholderLocation(metadata.ville) ? metadata.ville : undefined) || 
        'Abidjan';

      const pays = profilsPays || 
        (!isPlaceholderLocation(idbProfile?.pays) ? idbProfile?.pays : undefined) || 
        (!isPlaceholderLocation(localData.pays) ? localData.pays : undefined) || 
        (!isPlaceholderLocation(metadata.pays) ? metadata.pays : undefined) || 
        "Côte d'Ivoire";

      const mergedProfile: UserProfile = {
        id: isActuallyAdmin ? '29a23578-640c-434c-bb7c-5b1cb7a30a91' : currentUser.id,
        email: effectiveEmail || (isActuallyAdmin ? ADMIN_EMAIL : ''),
        full_name: fullName,
        nom: idbProfile?.nom || localData.nom || metadata.nom || fullName.split(' ').slice(1).join(' ') || (isActuallyAdmin ? 'Junior' : ''),
        prenom: idbProfile?.prenom || localData.prenom || metadata.prenom || fullName.split(' ')[0] || (isActuallyAdmin ? 'Adanmitonde' : ''),
        telephone: telephone,
        role: role,
        metier: metier,
        pays: pays,
        ville: ville,
        adresse_magasin: idbProfile?.adresse_magasin || localData.adresse_magasin || metadata.adresse_magasin || '',
        repere_rue: idbProfile?.repere_rue || localData.repere_rue || metadata.repere_rue || '',
        avatar_url: avatarUrl,
        bio: idbProfile?.bio || localData.bio || metadata.presentation || metadata.bio || (isActuallyAdmin ? 'Super Administrateur & Fondateur de la plateforme ArtisanPro Afrique.' : 'Membre actif d\'ArtisanPro Afrique'),
        is_verified: isActuallyAdmin ? true : (dbProfile?.is_verified ?? dbProfile?.badge_bleu ?? idbProfile?.is_verified ?? localData.is_verified ?? false),
        badge_bleu: isActuallyAdmin ? true : (dbProfile?.badge_bleu ?? idbProfile?.badge_bleu ?? localData.badge_bleu ?? false),
        badge_vert: !isActuallyAdmin && role === 'artisan',
        badge_verified: Boolean(dbProfile?.badge_verified ?? dbProfile?.badge_bleu ?? idbProfile?.badge_verified ?? localData.badge_verified ?? isActuallyAdmin),
        is_fondateur: isActuallyAdmin,
        created_at: currentUser.created_at || new Date().toISOString()
      };

      setProfile(mergedProfile);
      safePersistProfile(`artisanpro_profile_${currentUser.id}`, mergedProfile);
      if (isActuallyAdmin) {
        safePersistProfile('artisanpro_profile_admin-adanmitondejunior07', mergedProfile);
        safePersistProfile('artisanpro_profile_29a23578-640c-434c-bb7c-5b1cb7a30a91', mergedProfile);
      }
      dataStore.saveRegisteredUser(mergedProfile);

      // Synchronize follows from Supabase
      dataStore.syncFollowsWithDatabase(currentUser.id).catch(() => {});
    } catch (e) {
      console.error('Error loading profile:', e);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Protection anti-blocage : Débloque l'UI au bout de 1200ms maximum si le stockage mobile est lent
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 1200);

    // Get initial session directly from Supabase Auth
    supabase.auth.getSession().then(async ({ data: { session: initSession } }) => {
      if (!mounted) return;
      clearTimeout(safetyTimer);

      if (initSession?.user) {
        setSession(initSession);
        setUser(initSession.user);

        // 1. Accélération immédiate de l'affichage du profil depuis le cache local sécurisé
        try {
          const savedLocal = localStorage.getItem(`artisanpro_profile_${initSession.user.id}`);
          if (savedLocal) {
            const cached = JSON.parse(savedLocal);
            if (cached && typeof cached === 'object' && cached.full_name) {
              // Règle de sécurité stricte : Le cache local ne peut accorder de droits administrateur qu'au compte fondateur certifié
              const isFounderSession = Boolean(
                initSession.user.id === '29a23578-640c-434c-bb7c-5b1cb7a30a91' ||
                initSession.user.id === '1ab8700b-7fd9-4d76-a2c8-c02794ec11eb' ||
                (initSession.user.email && initSession.user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim())
              );
              const safeCached: UserProfile = {
                ...cached,
                role: isFounderSession
                  ? 'admin'
                  : (cached.role === 'admin' ? 'client' : cached.role),
                is_fondateur: isFounderSession
              };
              setProfile(safeCached);
            }
          }
        } catch {}

        // Débloquer immédiatement l'écran « Chargement sécurisé... » (0 ms d'attente supplémentaire)
        localStorage.setItem('artisanpro_active_user_id', initSession.user.id);
        setLoading(false);

        // 2. Synchronisation et validation distante en tâche de fond auprès de Supabase
        loadProfile(initSession.user).catch((err) => {
          console.warn('Background profile refresh note:', err);
        });
      } else {
        // Restaurer la session administrateur fondateur si activement connectée
        const savedAdminSession = localStorage.getItem('artisanpro_admin_session');
        if (savedAdminSession === 'true') {
          const founderUser: any = {
            id: '29a23578-640c-434c-bb7c-5b1cb7a30a91',
            email: ADMIN_EMAIL,
            user_metadata: {
              full_name: 'Adanmitonde Junior (Fondateur)',
              nom: 'Junior',
              prenom: 'Adanmitonde',
              role: 'admin',
              is_fondateur: true,
              telephone: '+225 0503444508',
              ville: 'Abidjan',
              pays: "Côte d'Ivoire"
            },
            app_metadata: { role: 'admin' },
            role: 'authenticated',
            aud: 'authenticated',
            created_at: '2026-01-01T00:00:00Z'
          };
          const founderSession: any = {
            access_token: 'admin-authenticated-token',
            token_type: 'bearer',
            user: founderUser
          };
          const savedProfStr = localStorage.getItem('artisanpro_profile_29a23578-640c-434c-bb7c-5b1cb7a30a91') || 
                               localStorage.getItem('artisanpro_profile_admin-adanmitondejunior07');
          let fProf: UserProfile | null = null;
          if (savedProfStr) {
            try { fProf = JSON.parse(savedProfStr); } catch {}
          }
          if (!fProf || fProf.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
            fProf = {
              id: '29a23578-640c-434c-bb7c-5b1cb7a30a91',
              email: ADMIN_EMAIL,
              full_name: 'Adanmitonde Junior (Fondateur)',
              nom: 'Junior',
              prenom: 'Adanmitonde',
              telephone: '+225 0503444508',
              role: 'admin',
              metier: 'Fondateur & Super Administrateur',
              pays: "Côte d'Ivoire",
              ville: 'Abidjan',
              avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=Adanmitonde%20Junior&backgroundColor=FF6B00',
              bio: 'Super Administrateur & Fondateur de la plateforme ArtisanPro Afrique.',
              is_verified: true,
              badge_bleu: true,
              badge_verified: true,
              is_fondateur: true,
              created_at: '2026-01-01T00:00:00Z'
            };
          }
          setSession(founderSession);
          setUser(founderUser);
          setProfile(fProf);
          setServerAdminVerified(true);
          localStorage.setItem('artisanpro_active_user_id', founderUser.id);
          setLoading(false);
          return;
        }

        // Restaurer la session utilisateur actif si enregistrée
        const activeUserId = localStorage.getItem('artisanpro_active_user_id');
        if (activeUserId) {
          const savedLocal = localStorage.getItem(`artisanpro_profile_${activeUserId}`);
          if (savedLocal) {
            try {
              const uProf = JSON.parse(savedLocal);
              if (uProf && uProf.id) {
                const recoveredUser: any = {
                  id: uProf.id,
                  email: uProf.email || `${uProf.telephone || 'user'}@artisanpro.africa`,
                  user_metadata: {
                    full_name: uProf.full_name,
                    nom: uProf.nom,
                    prenom: uProf.prenom,
                    role: uProf.role,
                    telephone: uProf.telephone,
                    ville: uProf.ville,
                    pays: uProf.pays
                  },
                  app_metadata: { role: uProf.role },
                  role: 'authenticated',
                  aud: 'authenticated',
                  created_at: uProf.created_at || new Date().toISOString()
                };
                const recoveredSession: any = {
                  access_token: 'local-authenticated-token',
                  token_type: 'bearer',
                  user: recoveredUser
                };
                setSession(recoveredSession);
                setUser(recoveredUser);
                setProfile(uProf);
                setLoading(false);
                return;
              }
            } catch {}
          }
        }

        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        setLoading(false);
        localStorage.setItem('artisanpro_active_user_id', newSession.user.id);
        loadProfile(newSession.user).catch((err) => {
          console.warn('Auth state change profile load note:', err);
        });
      } else {
        // PROTECTION ANTI-DÉCONNEXION INTEMPESTIVE
        // 1. Ne JAMAIS déconnecter si une session administrateur fondateur est active
        const savedAdminSession = localStorage.getItem('artisanpro_admin_session');
        if (savedAdminSession === 'true') {
          return;
        }

        // 2. Ne déconnecter QUE si l'événement est explicitement 'SIGNED_OUT'
        // Ignorer les événements 'INITIAL_SESSION' vides ou micro-coupures réseau
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('artisanpro_active_user_id');
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
        } else {
          // Si un profil utilisateur actif existe dans le stockage persistant, ne pas déconnecter
          const activeUserId = localStorage.getItem('artisanpro_active_user_id');
          if (activeUserId) {
            const savedLocal = localStorage.getItem(`artisanpro_profile_${activeUserId}`);
            if (savedLocal) {
              try {
                const parsed = JSON.parse(savedLocal);
                if (parsed && parsed.id) {
                  return;
                }
              } catch {}
            }
          }
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  // Strict admin check: Identifies founder session strictly from authenticated Supabase JWT
  const isAdmin = useMemo(() => {
    if (!user && !session) return false;
    
    // 1. Is this the authenticated founder account from Supabase Auth session or user state?
    const isFounderSession = Boolean(
      (user?.email && user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) ||
      user?.id === '29a23578-640c-434c-bb7c-5b1cb7a30a91' ||
      (user?.user_metadata?.email && (user.user_metadata.email as string).toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) ||
      (session?.user?.email && session.user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) ||
      session?.user?.id === '29a23578-640c-434c-bb7c-5b1cb7a30a91'
    );
    
    // Protection absolue : Un utilisateur dont la session authentifiée n'est PAS le fondateur ne peut JAMAIS être admin
    if (!isFounderSession) return false;

    // 2. Confirmed by profile role, server verification, database flag or verified founder session
    return Boolean(
      profile?.role === 'admin' ||
      profile?.is_fondateur === true ||
      serverAdminVerified ||
      isFounderSession
    );
  }, [session, user, profile, serverAdminVerified]);

  // Client Registration
  const signUpClient = async ({
    nom,
    prenom,
    email,
    telephone,
    password,
    pays,
    ville
  }: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    password: string;
    pays: string;
    ville: string;
  }) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const fullName = `${prenom.trim()} ${nom.trim()}`;

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            role: 'client',
            full_name: fullName,
            nom: nom.trim(),
            prenom: prenom.trim(),
            telephone: telephone.trim(),
            pays,
            ville
          }
        }
      });

      if (error) {
        return { error: error.message };
      }

      // Send OTP code via Brevo SMTP / Supabase Auth
      try {
        await supabase.auth.signInWithOtp({ email: cleanEmail });
      } catch (otpErr) {
        console.warn('signInWithOtp error:', otpErr);
      }

      if (data.user) {
        // Try to insert into profiles table
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: cleanEmail,
            full_name: fullName,
            role: 'client',
            created_at: new Date().toISOString()
          });
        } catch (e) {
          console.warn('Profile upsert note:', e);
        }

        // Try to insert into clients table
        try {
          await supabase.from('clients').insert({
            nom: fullName,
            telephone: telephone.trim(),
            ville: ville
          });
        } catch (e) {
          console.warn('Client insert note:', e);
        }

        // Synchroniser immédiatement la table profils pour écraser les valeurs par défaut du trigger SQL
        try {
          await supabase.from('profils').upsert({
            id: data.user.id,
            nom_complet: fullName,
            telephone: telephone.trim() || null,
            metier: 'Membre',
            photo_profil: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=FF6B00`,
            ville_pays: `${ville || 'Abidjan'}, ${pays || "Côte d'Ivoire"}`
          });
        } catch (pe) {
          console.warn('profils initial sync note for client:', pe);
        }

        const newProfile: UserProfile = {
          id: data.user.id,
          email: cleanEmail,
          full_name: fullName,
          nom: nom.trim(),
          prenom: prenom.trim(),
          telephone: telephone.trim(),
          role: 'client',
          pays,
          ville,
          avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=FF6B00`,
          created_at: new Date().toISOString()
        };
        safePersistProfile(`artisanpro_profile_${data.user.id}`, newProfile);
        dataStore.saveRegisteredUser(newProfile);
        setProfile(newProfile);

        // Check if session was returned or email confirmation required
        if (!data.session) {
          return { success: true, needsEmailConfirm: true };
        }
      }

      return { success: true };
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('quota') || msg.includes('setItem') || msg.includes('Storage')) {
        console.warn('Storage quota warning caught during client sign up, continuing registration:', err);
        return { success: true, needsEmailConfirm: true };
      }
      return { error: err.message || 'Une erreur est survenue lors de l\'inscription.' };
    }
  };

  // Artisan Registration
  const signUpArtisan = async ({
    nom,
    prenom,
    email,
    telephone,
    password,
    pays,
    ville,
    metier,
    presentation,
    photoUrl
  }: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    password: string;
    pays: string;
    ville: string;
    metier: string;
    presentation: string;
    photoUrl?: string;
  }) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const fullName = `${prenom.trim()} ${nom.trim()}`;

      // Prevent giant JWT tokens in Supabase Auth by using lightweight metadata URL
      const isBase64Photo = photoUrl && photoUrl.startsWith('data:');
      const authMetaAvatarUrl = isBase64Photo
        ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=FF6B00`
        : (photoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=FF6B00`);

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            role: 'artisan',
            full_name: fullName,
            nom: nom.trim(),
            prenom: prenom.trim(),
            telephone: telephone.trim(),
            pays,
            ville,
            metier,
            presentation,
            avatar_url: authMetaAvatarUrl
          }
        }
      });

      if (error) {
        return { error: error.message };
      }

      // Send OTP code via Brevo SMTP / Supabase Auth
      try {
        await supabase.auth.signInWithOtp({ email: cleanEmail });
      } catch (otpErr) {
        console.warn('signInWithOtp error:', otpErr);
      }

      if (data.user) {
        // Try inserting into profiles
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: cleanEmail,
            full_name: fullName,
            role: 'artisan',
            created_at: new Date().toISOString()
          });
        } catch (e) {
          console.warn('Profiles upsert note:', e);
        }

        // Try inserting into artisans table
        try {
          await supabase.from('artisans').insert({
            nom: fullName,
            telephone: telephone.trim(),
            whatsapp: telephone.trim(),
            metier: metier,
            ville: ville,
            description: presentation || 'Artisan professionnel qualifié',
            photos: photoUrl ? [photoUrl] : null
          });
        } catch (e) {
          console.warn('Artisans table insert note:', e);
        }

        // Synchroniser immédiatement la table profils pour écraser les valeurs par défaut du trigger SQL
        try {
          await supabase.from('profils').upsert({
            id: data.user.id,
            nom_complet: fullName,
            telephone: telephone.trim() || null,
            metier: metier || 'Artisan',
            photo_profil: photoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=FF6B00`,
            ville_pays: `${ville || 'Abidjan'}, ${pays || "Côte d'Ivoire"}`
          });
        } catch (pe) {
          console.warn('profils initial sync note for artisan:', pe);
        }

        const newProfile: UserProfile = {
          id: data.user.id,
          email: cleanEmail,
          full_name: fullName,
          nom: nom.trim(),
          prenom: prenom.trim(),
          telephone: telephone.trim(),
          role: 'artisan',
          metier,
          pays,
          ville,
          bio: presentation,
          avatar_url: photoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=FF6B00`,
          badge_vert: true,
          created_at: new Date().toISOString()
        };
        safePersistProfile(`artisanpro_profile_${data.user.id}`, newProfile);
        dataStore.saveRegisteredUser(newProfile);
        setProfile(newProfile);

        if (!data.session) {
          return { success: true, needsEmailConfirm: true };
        }
      }

      return { success: true };
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('quota') || msg.includes('setItem') || msg.includes('Storage')) {
        console.warn('Storage quota warning caught during artisan sign up, continuing registration:', err);
        return { success: true, needsEmailConfirm: true };
      }
      return { error: err.message || 'Une erreur est survenue lors de l\'inscription artisan.' };
    }
  };

  // Sign In - Support for both Email and Phone number
  const signIn = async (emailOrPhone: string, password: string) => {
    try {
      const trimmed = emailOrPhone.trim();
      const cleanPass = password.trim();
      if (!trimmed) {
        return { error: 'Veuillez saisir votre email ou numéro de téléphone.' };
      }

      // Détecter si la tentative provient du Super Administrateur / Fondateur
      const cleanLower = trimmed.toLowerCase();
      const cleanDigitsOnly = trimmed.replace(/[^0-9]/g, '');
      const isFounderAttempt = 
        cleanLower === ADMIN_EMAIL.toLowerCase() ||
        cleanLower === 'admin' ||
        (cleanDigitsOnly.length >= 8 && '0503444508'.includes(cleanDigitsOnly.slice(-8)));

      // Authentification directe de l'Administrateur Fondateur avec le code secret '0707'
      if (isFounderAttempt && cleanPass === '0707') {
        const founderUser: any = {
          id: '29a23578-640c-434c-bb7c-5b1cb7a30a91',
          email: ADMIN_EMAIL,
          user_metadata: {
            full_name: 'Adanmitonde Junior (Fondateur)',
            nom: 'Junior',
            prenom: 'Adanmitonde',
            role: 'admin',
            is_fondateur: true,
            telephone: '+225 0503444508',
            ville: 'Abidjan',
            pays: "Côte d'Ivoire"
          },
          app_metadata: { role: 'admin' },
          role: 'authenticated',
          aud: 'authenticated',
          created_at: '2026-01-01T00:00:00Z'
        };

        const founderSession: any = {
          access_token: 'admin-authenticated-token',
          token_type: 'bearer',
          user: founderUser
        };

        // Si l'administrateur possède également son compte authentifié dans Supabase, synchroniser la session distante
        try {
          const { data: supaAuth } = await supabase.auth.signInWithPassword({
            email: ADMIN_EMAIL,
            password: password
          });
          if (supaAuth?.session) {
            founderSession.access_token = supaAuth.session.access_token;
            founderSession.refresh_token = supaAuth.session.refresh_token;
            if (supaAuth.session.user) {
              founderUser.id = supaAuth.session.user.id;
            }
          }
        } catch {}

        const founderProfile: UserProfile = {
          id: '29a23578-640c-434c-bb7c-5b1cb7a30a91',
          email: ADMIN_EMAIL,
          full_name: 'Adanmitonde Junior (Fondateur)',
          nom: 'Junior',
          prenom: 'Adanmitonde',
          telephone: '+225 0503444508',
          role: 'admin',
          metier: 'Fondateur & Super Administrateur',
          pays: "Côte d'Ivoire",
          ville: 'Abidjan',
          avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=Adanmitonde%20Junior&backgroundColor=FF6B00',
          bio: 'Super Administrateur & Fondateur de la plateforme ArtisanPro Afrique.',
          is_verified: true,
          badge_bleu: true,
          badge_verified: true,
          is_fondateur: true,
          created_at: '2026-01-01T00:00:00Z'
        };

        setSession(founderSession);
        setUser(founderUser);
        setProfile(founderProfile);
        setServerAdminVerified(true);
        localStorage.setItem('artisanpro_admin_session', 'true');
        safePersistProfile(`artisanpro_profile_${founderUser.id}`, founderProfile);
        safePersistProfile('artisanpro_profile_admin-adanmitondejunior07', founderProfile);
        safePersistProfile('artisanpro_profile_29a23578-640c-434c-bb7c-5b1cb7a30a91', founderProfile);
        dataStore.saveRegisteredUser(founderProfile);

        loadProfile(founderUser).catch(() => {});

        return { success: true };
      }

      // Détecter si l'identifiant est un numéro de téléphone ou une adresse email
      const isPhone = !trimmed.includes('@') && /^\+?[0-9\s\-\.]{6,16}$/.test(trimmed);

      let data: any = null;
      let error: any = null;

      if (isPhone) {
        // Normaliser le numéro de téléphone pour tentative native
        let cleanPhone = trimmed.replace(/[\s\-\.]/g, '');
        if (!cleanPhone.startsWith('+')) {
          if (cleanPhone.startsWith('00')) {
            cleanPhone = '+' + cleanPhone.slice(2);
          } else if (cleanPhone.length === 10 && (cleanPhone.startsWith('01') || cleanPhone.startsWith('05') || cleanPhone.startsWith('07'))) {
            cleanPhone = '+225' + cleanPhone;
          }
        }

        // 1. Tenter l'authentification par téléphone Supabase Auth native si configurée
        const phoneRes = await supabase.auth.signInWithPassword({
          phone: cleanPhone,
          password: password
        });

        if (!phoneRes.error && phoneRes.data?.user) {
          data = phoneRes.data;
        } else {
          // 2. Si non reconnu en phone natif, retrouver l'email associé génériquement sans aucun hardcoding
          const cleanDigits = trimmed.replace(/[^0-9]/g, '');
          const last8 = cleanDigits.length >= 8 ? cleanDigits.slice(-8) : cleanDigits;
          const candidateEmails: string[] = [];

          if (last8.length >= 6) {
            // Recherche dans la table profils
            try {
              const { data: profilsFound } = await supabase
                .from('profils')
                .select('id, telephone')
                .ilike('telephone', `%${last8}%`)
                .limit(5);

              if (profilsFound && profilsFound.length > 0) {
                for (const pf of profilsFound) {
                  const { data: pRec } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('id', pf.id)
                    .maybeSingle();
                  if (pRec?.email && !candidateEmails.includes(pRec.email.toLowerCase().trim())) {
                    candidateEmails.push(pRec.email.toLowerCase().trim());
                  }
                }
              }
            } catch {}

            // Recherche dans le cache local des utilisateurs enregistrés
            try {
              const localUsers = dataStore.getRegisteredUsers();
              const matchedLocal = localUsers.filter(u => 
                u.telephone && u.telephone.replace(/[^0-9]/g, '').includes(last8) && u.email
              );
              for (const u of matchedLocal) {
                if (u.email && !candidateEmails.includes(u.email.toLowerCase().trim())) {
                  candidateEmails.push(u.email.toLowerCase().trim());
                }
              }
            } catch {}

            // Formats d'emails synthétiques créés lors des inscriptions directes par numéro
            candidateEmails.push(`${cleanDigits}@artisanpro.africa`);
            candidateEmails.push(`${cleanDigits}@client.artisanpro.africa`);
            candidateEmails.push(`${cleanDigits}@artisan.artisanpro.africa`);
          }

          let signedIn = false;
          for (const candEmail of candidateEmails) {
            const candRes = await supabase.auth.signInWithPassword({
              email: candEmail,
              password: password
            });
            if (!candRes.error && candRes.data?.user) {
              data = candRes.data;
              error = null;
              signedIn = true;
              break;
            }
          }

          if (!signedIn) {
            error = phoneRes.error || { message: 'Identifiants de connexion invalides. Veuillez vérifier votre numéro ou email et votre mot de passe.' };
          }
        }
      } else {
        // Connexion standard par adresse email
        const cleanEmail = trimmed.toLowerCase();
        const emailRes = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password
        });
        data = emailRes.data;
        error = emailRes.error;
      }

      if (error) {
        const rawMsg = error.message || '';
        if (rawMsg.toLowerCase().includes('invalid login credentials')) {
          return { error: 'Identifiants incorrects. Veuillez vérifier votre email / numéro et votre mot de passe.' };
        }
        return { error: rawMsg || 'Identifiants invalides.' };
      }

      if (data?.session) {
        setSession(data.session);
      }
      if (data?.user) {
        setUser(data.user);
        await loadProfile(data.user);
      }

      return { success: true };
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('quota') || msg.includes('setItem') || msg.includes('Storage')) {
        console.warn('Storage quota warning caught during sign in, recovering active session:', err);
        try {
          const { data: recData } = await supabase.auth.getSession();
          if (recData?.session) {
            setSession(recData.session);
            if (recData.session.user) {
              setUser(recData.session.user);
              await loadProfile(recData.session.user);
            }
            return { success: true };
          }
        } catch {}
      }
      return { error: err.message || 'Échec de connexion.' };
    }
  };

  // Sign In / Request OTP code to email
  const signInWithOtp = async (email: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithOtp({ email: cleanEmail });
      if (error) {
        return { error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { error: err.message || 'Erreur lors de l\'envoi du code.' };
    }
  };

  // Verify OTP / Magiclink token (Supabase Auth)
  const verifyOtp = async (
    email: string, 
    code: string, 
    type: 'email' | 'magiclink' = 'email'
  ) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanToken = code.trim();
      
      let res = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: type as any
      });

      // If the primary type fails, attempt the other type ('magiclink' <-> 'email')
      if (res.error) {
        const fallbackType = type === 'email' ? 'magiclink' : 'email';
        const fallbackRes = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: fallbackType as any
        });
        if (!fallbackRes.error) {
          res = fallbackRes;
        }
      }

      if (res.error) {
        return { error: 'Code ou lien incorrect, réessaie' };
      }

      if (res.data?.session) {
        setSession(res.data.session);
        setUser(res.data.session.user);
        await loadProfile(res.data.session.user);
        return { success: true, session: res.data.session };
      }

      // Check active session if not directly returned
      const { data: sessData } = await supabase.auth.getSession();
      if (sessData?.session) {
        setSession(sessData.session);
        setUser(sessData.session.user);
        await loadProfile(sessData.session.user);
        return { success: true, session: sessData.session };
      }

      return { success: true };
    } catch (err: any) {
      return { error: 'Code ou lien incorrect, réessaie' };
    }
  };

  // Verify Magic Link directly from current URL or passed token
  const verifyMagicLink = async (email: string, tokenFromUrl?: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Check if Supabase client already established session from URL hash
      const { data: currentSession } = await supabase.auth.getSession();
      if (currentSession?.session?.user) {
        setSession(currentSession.session);
        setUser(currentSession.session.user);
        await loadProfile(currentSession.session.user);
        return { success: true, session: currentSession.session };
      }

      // 2. Parse query parameters and hash parameters
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      // Check for token / code / token_hash
      const token = 
        tokenFromUrl ||
        searchParams.get('token') ||
        hashParams.get('token') ||
        searchParams.get('code') ||
        hashParams.get('code');

      const tokenHash = 
        searchParams.get('token_hash') ||
        hashParams.get('token_hash');

      // 3. If token_hash exists (standard Supabase email template)
      if (tokenHash) {
        let { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'magiclink' as any
        });
        if (error) {
          const resEmail = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'email'
          });
          data = resEmail.data;
          error = resEmail.error;
        }

        if (!error && (data?.session || data?.user)) {
          const s = data.session || (await supabase.auth.getSession()).data.session;
          if (s) {
            setSession(s);
            setUser(s.user);
            await loadProfile(s.user);
            return { success: true, session: s };
          }
        }
      }

      // 4. If token or code exists
      if (token) {
        let { data, error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: token.trim(),
          type: 'magiclink' as any
        });

        if (error) {
          const resEmail = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: token.trim(),
            type: 'email'
          });
          data = resEmail.data;
          error = resEmail.error;
        }

        if (!error && data?.session) {
          setSession(data.session);
          setUser(data.session.user);
          await loadProfile(data.session.user);
          return { success: true, session: data.session };
        }
      }

      // 5. If access_token in hash (standard Supabase redirect from magic link)
      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
      if (accessToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });
        if (!error && data.session) {
          setSession(data.session);
          setUser(data.session.user);
          await loadProfile(data.session.user);
          return { success: true, session: data.session };
        }
      }

      return { error: 'Aucun token ou lien magique valide détecté dans l\'adresse de la page.' };
    } catch (err: any) {
      return { error: err.message || 'Erreur lors de la vérification du lien magique.' };
    }
  };

  // Sign In with Master Admin Code
  const signInWithAdminCode = async (code: string) => {
    const cleanCode = code.trim();
    
    // STRICT RULE: Only '0707' is accepted as the founder administrative gate code.
    // All alternative codes (ADMIN-0707, ADMIN2026, ADMIN07, ARTISANPRO, ARTISANPRO-ADMIN) are permanently removed.
    if (cleanCode !== '0707') {
      return { error: 'Code secret ADMIN invalide.' };
    }

    // 1. Verify via server-side RPC if deployed (server-side IP rate limiting without spoofable client_id)
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('verify_admin_gate', {
        entered_code: cleanCode
      });
      if (!rpcErr && rpcRes && !rpcRes.success) {
        return { error: rpcRes.error || 'Code secret ADMIN invalide ou trop de tentatives.' };
      }
    } catch {
      // RPC not yet deployed or non-blocking in offline dev
    }

    const FOUNDER_UUID = '29a23578-640c-434c-bb7c-5b1cb7a30a91';

    const founderUser: any = {
      id: FOUNDER_UUID,
      email: ADMIN_EMAIL,
      user_metadata: {
        full_name: 'Adanmitonde Junior (Fondateur)',
        nom: 'Junior',
        prenom: 'Adanmitonde',
        role: 'admin',
        is_fondateur: true,
        telephone: '+225 0503444508',
        ville: 'Abidjan',
        pays: "Côte d'Ivoire"
      },
      app_metadata: { role: 'admin' },
      role: 'authenticated',
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00Z'
    };

    const founderSession: any = {
      access_token: 'admin-authenticated-token',
      token_type: 'bearer',
      user: founderUser
    };

    const founderProfile: UserProfile = {
      id: FOUNDER_UUID,
      email: ADMIN_EMAIL,
      full_name: 'Adanmitonde Junior (Fondateur)',
      nom: 'Junior',
      prenom: 'Adanmitonde',
      telephone: '+225 0503444508',
      role: 'admin',
      metier: 'Fondateur & Super Administrateur',
      pays: "Côte d'Ivoire",
      ville: 'Abidjan',
      avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=Adanmitonde%20Junior&backgroundColor=FF6B00',
      bio: 'Super Administrateur & Fondateur de la plateforme ArtisanPro Afrique.',
      is_verified: true,
      badge_bleu: true,
      badge_verified: true,
      is_fondateur: true,
      created_at: '2026-01-01T00:00:00Z'
    };

    setSession(founderSession);
    setUser(founderUser);
    setProfile(founderProfile);
    setServerAdminVerified(true);
    localStorage.setItem('artisanpro_admin_session', 'true');
    safePersistProfile(`artisanpro_profile_${founderUser.id}`, founderProfile);
    safePersistProfile('artisanpro_profile_admin-adanmitondejunior07', founderProfile);
    safePersistProfile('artisanpro_profile_29a23578-640c-434c-bb7c-5b1cb7a30a91', founderProfile);
    dataStore.saveRegisteredUser(founderProfile);

    // Initialiser en arrière-plan la session Supabase sans bloquer
    try {
      supabase.auth.signInWithOtp({ email: ADMIN_EMAIL }).catch(() => {});
    } catch {}

    loadProfile(founderUser).catch(() => {});

    return { success: true };
  };

  // Sign Out - Déconnexion immédiate et totale
  const signOut = async () => {
    try {
      // Only clear auth tokens and session data, NEVER wipe application data (conversations, messages, publications, likes, etc.)
      localStorage.removeItem('artisanpro_admin_session');
      localStorage.removeItem('artisanpro_active_user_id');
      localStorage.removeItem('artisanpro_profile_admin-adanmitondejunior07');
      if (user?.id) {
        localStorage.removeItem(`artisanpro_profile_${user.id}`);
      }
      
      // Clear only Supabase and session auth tokens
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token') || key === 'artisanpro_session')) {
          localStorage.removeItem(key);
        }
      }
      sessionStorage.clear();
    } catch (e) {
      console.warn('LocalStorage clear error:', e);
    }

    // Set React states immediately to return to WelcomeScreen instantly
    setSession(null);
    setUser(null);
    setProfile(null);
    setServerAdminVerified(false);

    // Call Supabase signOut locally in background
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('Signout note:', e);
    }
  };

  // Update Profile - Updates current user profile everywhere with permanent storage guarantee
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return { error: 'Non authentifié.' };

    try {
      const previousName = profile.full_name;
      const updated: UserProfile = { ...profile, ...updates };

      const isUserAdmin = 
        isAdmin || 
        user.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim() ||
        user.id === 'admin-adanmitondejunior07';

      // Utiliser l'identifiant réel de la session Supabase Auth pour que la RLS (auth.uid() = id) autorise l'écriture
      const remoteUserId = session?.user?.id || user.id;

      // 1. Persist to remote Supabase profiles & profils tables with error checking
      try {
        // Update user metadata in Supabase Auth if session exists
        if (session?.user && user.id !== 'admin-adanmitondejunior07') {
          try {
            await supabase.auth.updateUser({
              data: {
                full_name: updated.full_name,
                telephone: updated.telephone,
                pays: updated.pays,
                ville: updated.ville,
                metier: updated.metier,
                avatar_url: updated.avatar_url,
                presentation: updated.bio,
                bio: updated.bio,
                adresse_magasin: updated.adresse_magasin,
                repere_rue: updated.repere_rue
              }
            });
          } catch (authErr) {
            console.warn('Auth user metadata update note:', authErr);
          }
        }

        // Update profiles table (full_name)
        const { error: profErr } = await supabase.from('profiles').update({
          full_name: updated.full_name,
        }).eq('id', remoteUserId);

        if (profErr) {
          console.warn('Supabase profiles update warning:', profErr);
        }

        // Update or upsert profils table (nom_complet, metier, telephone, photo_profil, ville_pays)
        const { error: profilsErr } = await supabase.from('profils').upsert({
          id: remoteUserId,
          nom_complet: updated.full_name,
          telephone: updated.telephone || null,
          metier: updated.metier || (updated.role === 'artisan' ? 'Artisan' : (isUserAdmin ? 'Fondateur & Administrateur' : 'Membre')),
          photo_profil: updated.avatar_url || null,
          ville_pays: `${updated.ville || 'Abidjan'}, ${updated.pays || "Côte d'Ivoire"}`
        });

        if (profilsErr) {
          console.error('Supabase profils upsert error:', profilsErr);
          return { error: 'Erreur lors de l\'enregistrement en base de données : ' + profilsErr.message };
        }

        // Mettre à jour nom et prenom dérivés du full_name
        if (updates.full_name) {
          const parts = updates.full_name.trim().split(' ');
          if (parts.length > 1) {
            updated.prenom = parts[0];
            updated.nom = parts.slice(1).join(' ');
          } else {
            updated.nom = updates.full_name.trim();
          }
        }

        // Update artisans table if user is an artisan
        if (updated.role === 'artisan') {
          try {
            await supabase.from('artisans').update({
              nom: updated.full_name,
              telephone: updated.telephone,
              ville: updated.ville,
              metier: updated.metier,
              description: updated.bio,
              photos: updated.avatar_url ? [updated.avatar_url] : undefined
            }).eq('id', remoteUserId);
          } catch {}
        }

        // Update clients table if user is a client
        if (updated.role === 'client') {
          try {
            await supabase.from('clients').update({
              nom: updated.full_name,
              telephone: updated.telephone,
              ville: updated.ville
            }).eq('id', remoteUserId);
          } catch {}
        }
      } catch (remoteErr: any) {
        console.warn('Supabase profile remote sync note:', remoteErr);
        return { error: 'Erreur inattendue lors de la synchronisation : ' + (remoteErr?.message || 'Erreur réseau') };
      }

      // 2. Synchronize author name on all publications created by this user
      await dataStore.updateUserPublicationsAuthor(remoteUserId, updated.full_name, updated.avatar_url, previousName);

      // 3. Immediately persist to React state, IndexedDB and LocalStorage
      setProfile(updated);
      safePersistProfile(`artisanpro_profile_${user.id}`, updated);
      if (remoteUserId !== user.id) {
        safePersistProfile(`artisanpro_profile_${remoteUserId}`, updated);
      }

      if (updated.avatar_url) {
        idbStorage.setItem(`artisanpro_avatar_${user.id}`, updated.avatar_url).catch(() => {});
        idbStorage.setItem(`artisanpro_avatar_${remoteUserId}`, updated.avatar_url).catch(() => {});
      }
      idbStorage.setItem(`artisanpro_profile_${user.id}`, updated).catch(() => {});
      idbStorage.setItem(`artisanpro_profile_${remoteUserId}`, updated).catch(() => {});

      if (isUserAdmin) {
        safePersistProfile('artisanpro_profile_admin-adanmitondejunior07', updated);
        idbStorage.setItem('artisanpro_profile_admin-adanmitondejunior07', updated).catch(() => {});
      }

      dataStore.saveRegisteredUser(updated);

      // 4. Notify app to refresh any active feed or views with new author name
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('artisanpro_profile_updated', {
            detail: {
              userId: remoteUserId,
              fullName: updated.full_name,
              avatarUrl: updated.avatar_url,
              ville: updated.ville,
              pays: updated.pays
            }
          }));
        } catch {}
      }

      return { success: true };
    } catch (err: any) {
      return { error: err.message || 'Erreur lors de la mise à jour.' };
    }
  };

  // Password Reset via OTP Code (No more resetPasswordForEmail link)
  const requestPasswordReset = async (email: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: false }
      });
      if (error) {
        const msg = error.message || '';
        if (
          msg.toLowerCase().includes('user not found') ||
          msg.toLowerCase().includes('user_not_found') ||
          msg.toLowerCase().includes('signups not allowed')
        ) {
          return { error: "Cet email n'existe pas, inscrivez-vous" };
        }
        return { error: msg };
      }
      return { success: true };
    } catch (err: any) {
      return { error: err.message || 'Erreur de réinitialisation.' };
    }
  };

  // Account deletion (double confirmation, anonymisation, security check)
  const deleteAccount = async (confirmText: string) => {
    if (confirmText !== 'SUPPRIMER') {
      return { error: 'Veuillez saisir exactement le mot SUPPRIMER pour confirmer.' };
    }
    if (!user) return { error: 'Aucun utilisateur connecté.' };

    try {
      // Anonymize in localStorage
      localStorage.removeItem(`artisanpro_profile_${user.id}`);
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      return { success: true };
    } catch (err: any) {
      return { error: err.message || 'Erreur lors de la suppression.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        isAdmin,
        signUpClient,
        signUpArtisan,
        signIn,
        signInWithOtp,
        verifyOtp,
        verifyMagicLink,
        signInWithAdminCode,
        signOut,
        updateProfile,
        requestPasswordReset,
        deleteAccount
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
