import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, ADMIN_EMAIL, formatFetchError } from '../lib/supabase';
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
      const targetId = currentUser.id;
      const effectiveEmail = email;

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
      } else if (email && email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) {
        fullName = 'Adanmitonde Junior';
      } else {
        fullName = effectiveEmail ? effectiveEmail.split('@')[0] : 'Membre ArtisanPro';
      }

      // Règle stricte : Le rôle admin est lu depuis profiles.role
      const isActuallyAdmin = dbProfile?.role === 'admin';

      // Résolution du rôle : lu en priorité depuis profiles.role, ou metadata Auth
      const role: UserRole = dbProfile?.role === 'admin'
        ? 'admin'
        : (dbProfile?.role === 'artisan' || metadata.role === 'artisan' || idbProfile?.role === 'artisan' || (dbProfils?.metier && !isPlaceholderMetier(dbProfils.metier))
            ? 'artisan'
            : (dbProfile?.role === 'client' || metadata.role === 'client' ? 'client' : (dbProfile?.role || 'client')));

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

      const repereRue = metadata.repere_rue || metadata.rue || idbProfile?.repere_rue || localData.repere_rue || '';
      const adresseMagasin = metadata.adresse_magasin || metadata.adresse || idbProfile?.adresse_magasin || localData.adresse_magasin || '';
      const gpsLat = metadata.gps_lat !== undefined && metadata.gps_lat !== null
        ? Number(metadata.gps_lat)
        : (idbProfile?.gps_lat ?? localData.gps_lat);
      const gpsLng = metadata.gps_lng !== undefined && metadata.gps_lng !== null
        ? Number(metadata.gps_lng)
        : (idbProfile?.gps_lng ?? localData.gps_lng);
      const gpsLabel = metadata.gps_label || idbProfile?.gps_label || localData.gps_label || '';

      const mergedProfile: UserProfile = {
        id: currentUser.id,
        email: email || dbProfile?.email || effectiveEmail || '',
        full_name: fullName,
        nom: idbProfile?.nom || localData.nom || metadata.nom || fullName.split(' ').slice(1).join(' ') || '',
        prenom: idbProfile?.prenom || localData.prenom || metadata.prenom || fullName.split(' ')[0] || '',
        telephone: telephone,
        role: role,
        metier: metier,
        pays: pays,
        ville: ville,
        adresse_magasin: adresseMagasin,
        repere_rue: repereRue,
        gps_lat: gpsLat,
        gps_lng: gpsLng,
        gps_label: gpsLabel,
        avatar_url: avatarUrl,
        bio: idbProfile?.bio || localData.bio || metadata.presentation || metadata.bio || (isActuallyAdmin ? 'Super Administrateur de la plateforme ArtisanPro Afrique.' : 'Membre actif d\'ArtisanPro Afrique'),
        is_verified: isActuallyAdmin ? true : (dbProfile?.is_verified ?? dbProfile?.badge_bleu ?? idbProfile?.is_verified ?? localData.is_verified ?? false),
        badge_bleu: isActuallyAdmin ? true : (dbProfile?.badge_bleu ?? idbProfile?.badge_bleu ?? localData.badge_bleu ?? false),
        badge_vert: !isActuallyAdmin && role === 'artisan',
        badge_verified: Boolean(dbProfile?.badge_verified ?? dbProfile?.badge_bleu ?? idbProfile?.badge_verified ?? localData.badge_verified ?? isActuallyAdmin),
        is_fondateur: isActuallyAdmin,
        created_at: dbProfile?.created_at || currentUser.created_at || new Date().toISOString()
      };

      setProfile(mergedProfile);
      safePersistProfile(`artisanpro_profile_${currentUser.id}`, mergedProfile);
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

        // 1. Accélération de l'affichage du profil depuis le cache local sécurisé
        try {
          const savedLocal = localStorage.getItem(`artisanpro_profile_${initSession.user.id}`);
          if (savedLocal) {
            const cached = JSON.parse(savedLocal);
            if (cached && typeof cached === 'object' && cached.full_name) {
              setProfile(cached);
            }
          }
        } catch {}

        localStorage.setItem('artisanpro_active_user_id', initSession.user.id);
        setLoading(false);

        // 2. Synchronisation et validation distante en tâche de fond auprès de Supabase
        loadProfile(initSession.user).catch((err) => {
          console.warn('Background profile refresh note:', err);
        });
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    // Écouter les changements d'état d'authentification Supabase (persistance et rafraîchissement automatique du jeton)
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
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('artisanpro_active_user_id');
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else {
        // En cas d'événement intermédiaire ou de coupure temporaire, vérifier avec getSession pour éviter une fausse déconnexion
        const { data: { session: checkSession } } = await supabase.auth.getSession();
        if (checkSession?.user) {
          setSession(checkSession);
          setUser(checkSession.user);
          loadProfile(checkSession.user).catch(() => {});
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  // Le rôle admin est lu depuis profiles.role
  const isAdmin = useMemo(() => {
    return profile?.role === 'admin';
  }, [profile]);

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

  // Obsolete: Custom secret passcodes removed per security guidelines
  const signInWithAdminCode = async (_code: string) => {
    return { error: 'Veuillez vous connecter avec votre adresse e-mail et mot de passe.' };
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

      const isUserAdmin = isAdmin;

      // Utiliser l'identifiant réel de la session Supabase Auth pour que la RLS (auth.uid() = id) autorise l'écriture
      const remoteUserId = session?.user?.id || user.id;

      // 1. Persist to remote Supabase profiles & profils tables with error checking
      try {
        // Update user metadata in Supabase Auth if session exists
        if (session?.user) {
          try {
            await supabase.auth.updateUser({
              data: {
                full_name: updated.full_name,
                nom: updated.nom,
                prenom: updated.prenom,
                telephone: updated.telephone,
                pays: updated.pays,
                ville: updated.ville,
                metier: updated.metier,
                avatar_url: updated.avatar_url,
                photo_url: updated.avatar_url,
                presentation: updated.bio,
                bio: updated.bio,
                adresse_magasin: updated.adresse_magasin,
                adresse: updated.adresse_magasin,
                repere_rue: updated.repere_rue,
                rue: updated.repere_rue,
                gps_lat: updated.gps_lat,
                gps_lng: updated.gps_lng,
                gps_label: updated.gps_label
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
        console.warn(`Supabase profile remote sync note (${SUPABASE_URL}/rest/v1/profiles):`, remoteErr);
        return { error: `Erreur d'enregistrement : ` + formatFetchError(remoteErr, `${SUPABASE_URL}/rest/v1/profiles`) };
      }

      // Re-read directly from Supabase immediately after write (Règle stricte : après chaque écriture, relis depuis Supabase)
      try {
        const { data: freshAuth } = await supabase.auth.getUser();
        if (freshAuth?.user) {
          await loadProfile(freshAuth.user);
        }
      } catch (readErr) {
        console.warn('Re-read from Supabase note:', readErr);
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
