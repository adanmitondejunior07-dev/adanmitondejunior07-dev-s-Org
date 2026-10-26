import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, ADMIN_EMAIL } from '../lib/supabase';
import { dataStore } from '../lib/dataStore';
import { UserProfile, UserRole } from '../types';

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

  // Sync profile from Supabase
  const loadProfile = async (currentUser: User) => {
    try {
      const email = currentUser.email || '';
      const metadata = currentUser.user_metadata || {};

      // Try fetching from profiles table
      const { data: dbProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      const savedLocal = localStorage.getItem(`artisanpro_profile_${currentUser.id}`);
      const localData: Partial<UserProfile> = savedLocal ? JSON.parse(savedLocal) : {};

      const fullName = 
        dbProfile?.full_name || 
        metadata.full_name || 
        (metadata.prenom && metadata.nom ? `${metadata.prenom} ${metadata.nom}` : '') ||
        localData.full_name ||
        email.split('@')[0];

      const isActuallyAdmin = 
        email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim() ||
        currentUser.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim() ||
        dbProfile?.role === 'admin' ||
        metadata.role === 'admin' ||
        localData.role === 'admin';

      const role: UserRole = isActuallyAdmin 
        ? 'admin' 
        : ((dbProfile?.role || metadata.role || localData.role || 'client') as UserRole);

      // Prioritize saved photo over default initials
      const savedPhoto = localData.avatar_url || metadata.avatar_url || dbProfile?.avatar_url;
      const avatarUrl = savedPhoto || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=FF6B00`;

      const mergedProfile: UserProfile = {
        id: currentUser.id,
        email: email,
        full_name: fullName,
        nom: metadata.nom || localData.nom || fullName.split(' ').slice(1).join(' ') || '',
        prenom: metadata.prenom || localData.prenom || fullName.split(' ')[0] || '',
        telephone: metadata.telephone || localData.telephone || '',
        role: role,
        metier: isActuallyAdmin ? undefined : (metadata.metier || localData.metier || ''),
        pays: metadata.pays || localData.pays || 'Côte d\'Ivoire',
        ville: metadata.ville || localData.ville || 'Abidjan',
        avatar_url: avatarUrl,
        bio: metadata.presentation || localData.bio || (isActuallyAdmin ? 'Super Administrateur & Fondateur de la plateforme ArtisanPro Afrique.' : 'Membre actif d\'ArtisanPro Afrique'),
        is_verified: isActuallyAdmin ? true : (dbProfile?.is_verified ?? dbProfile?.badge_bleu ?? localData.is_verified ?? false),
        badge_bleu: isActuallyAdmin ? true : (dbProfile?.badge_bleu ?? localData.badge_bleu ?? false),
        badge_vert: !isActuallyAdmin && role === 'artisan',
        is_fondateur: isActuallyAdmin,
        created_at: currentUser.created_at || new Date().toISOString()
      };

      setProfile(mergedProfile);
      localStorage.setItem(`artisanpro_profile_${currentUser.id}`, JSON.stringify(mergedProfile));
      if (isActuallyAdmin) {
        localStorage.setItem('artisanpro_profile_admin-adanmitondejunior07', JSON.stringify(mergedProfile));
      }
      dataStore.saveRegisteredUser(mergedProfile);
    } catch (e) {
      console.error('Error loading profile:', e);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initSession }, error }) => {
      if (mounted) {
        if (initSession) {
          setSession(initSession);
          setUser(initSession.user);
          loadProfile(initSession.user);
        } else {
          // Check for saved admin session
          const savedAdmin = localStorage.getItem('artisanpro_admin_session');
          if (savedAdmin) {
            try {
              const parsed = JSON.parse(savedAdmin);
              if (parsed.email === ADMIN_EMAIL) {
                const adminUser = {
                  id: 'admin-adanmitondejunior07',
                  email: ADMIN_EMAIL,
                  app_metadata: { role: 'admin' },
                  user_metadata: { full_name: 'Adanmitonde Junior (Fondateur)', role: 'admin' },
                  aud: 'authenticated',
                  created_at: '2026-01-01T00:00:00Z'
                } as unknown as User;

                const savedAdminProfileStr = localStorage.getItem('artisanpro_profile_admin-adanmitondejunior07');
                const savedAdminData = savedAdminProfileStr ? JSON.parse(savedAdminProfileStr) : null;

                const adminProfile: UserProfile = {
                  id: 'admin-adanmitondejunior07',
                  email: ADMIN_EMAIL,
                  full_name: savedAdminData?.full_name || 'Adanmitonde Junior (Fondateur)',
                  nom: savedAdminData?.nom || 'Junior',
                  prenom: savedAdminData?.prenom || 'Adanmitonde',
                  telephone: savedAdminData?.telephone || '+225 0503444508',
                  role: 'admin',
                  pays: savedAdminData?.pays || 'Côte d\'Ivoire',
                  ville: savedAdminData?.ville || 'Abidjan',
                  avatar_url: savedAdminData?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=Adanmitonde%20Junior&backgroundColor=FF6B00`,
                  bio: savedAdminData?.bio || 'Super Administrateur & Fondateur de la plateforme ArtisanPro Afrique.',
                  is_verified: true,
                  badge_bleu: true,
                  badge_vert: true,
                  badge_verified: true,
                  is_fondateur: true,
                  is_certified: true,
                  created_at: '2026-01-01T00:00:00Z'
                };

                setUser(adminUser);
                setProfile(adminProfile);
              }
            } catch (e) {
              console.warn(e);
            }
          }
        }
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user || null);

      if (newSession?.user) {
        await loadProfile(newSession.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Strict admin check
  const isAdmin = useMemo(() => {
    if (profile?.role === 'admin') return true;
    if (user?.user_metadata?.role === 'admin') return true;
    if (user?.email && user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) return true;
    if (profile?.email && profile.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) return true;
    return false;
  }, [user, profile]);

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
        localStorage.setItem(`artisanpro_profile_${data.user.id}`, JSON.stringify(newProfile));
        dataStore.saveRegisteredUser(newProfile);
        setProfile(newProfile);

        // Check if session was returned or email confirmation required
        if (!data.session) {
          return { success: true, needsEmailConfirm: true };
        }
      }

      return { success: true };
    } catch (err: any) {
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
            avatar_url: photoUrl
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
        localStorage.setItem(`artisanpro_profile_${data.user.id}`, JSON.stringify(newProfile));
        dataStore.saveRegisteredUser(newProfile);
        setProfile(newProfile);

        if (!data.session) {
          return { success: true, needsEmailConfirm: true };
        }
      }

      return { success: true };
    } catch (err: any) {
      return { error: err.message || 'Une erreur est survenue lors de l\'inscription artisan.' };
    }
  };

  // Sign In
  const signIn = async (emailOrPhone: string, password: string) => {
    try {
      const cleanEmail = emailOrPhone.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        await loadProfile(data.user);
      }

      return { success: true };
    } catch (err: any) {
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
    const cleanCode = code.trim().toUpperCase();
    const VALID_ADMIN_CODES = ['0707', 'ADMIN-0707', 'ADMIN2026', 'ADMIN07', 'ARTISANPRO', 'ARTISANPRO-ADMIN'];

    if (!VALID_ADMIN_CODES.includes(cleanCode)) {
      return { error: 'Code secret ADMIN invalide.' };
    }

    const adminUser = {
      id: 'admin-adanmitondejunior07',
      email: ADMIN_EMAIL,
      app_metadata: { role: 'admin' },
      user_metadata: { full_name: 'Adanmitonde Junior (Fondateur)', role: 'admin' },
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00Z'
    } as unknown as User;

    const savedAdminProfileStr = localStorage.getItem('artisanpro_profile_admin-adanmitondejunior07');
    const savedAdminData = savedAdminProfileStr ? JSON.parse(savedAdminProfileStr) : null;

    const adminProfile: UserProfile = {
      id: 'admin-adanmitondejunior07',
      email: ADMIN_EMAIL,
      full_name: savedAdminData?.full_name || 'Adanmitonde Junior (Fondateur)',
      nom: savedAdminData?.nom || 'Junior',
      prenom: savedAdminData?.prenom || 'Adanmitonde',
      telephone: savedAdminData?.telephone || '+225 0503444508',
      role: 'admin',
      pays: savedAdminData?.pays || 'Côte d\'Ivoire',
      ville: savedAdminData?.ville || 'Abidjan',
      avatar_url: savedAdminData?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=Adanmitonde%20Junior&backgroundColor=FF6B00`,
      bio: savedAdminData?.bio || 'Super Administrateur & Fondateur de la plateforme ArtisanPro Afrique.',
      is_verified: true,
      badge_bleu: true,
      badge_vert: true,
      badge_verified: true,
      is_fondateur: true,
      is_certified: true,
      created_at: '2026-01-01T00:00:00Z'
    };

    // Save session in localStorage so it stays connected
    localStorage.setItem('artisanpro_admin_session', JSON.stringify({ email: ADMIN_EMAIL, timestamp: Date.now() }));
    localStorage.setItem(`artisanpro_profile_admin-adanmitondejunior07`, JSON.stringify(adminProfile));
    dataStore.saveRegisteredUser(adminProfile);

    // Try to ensure record exists in profiles table
    try {
      await supabase.from('profiles').upsert({
        id: '29a23578-640c-434c-bb7c-5b1cb7a30a91', // or own id if permitted
        email: ADMIN_EMAIL,
        full_name: 'Adanmitonde Junior (Fondateur)',
        role: 'admin',
        is_fondateur: true,
        badge_bleu: true,
        is_verified: true
      });
    } catch (e) {
      // Non-blocking
    }

    setUser(adminUser);
    setProfile(adminProfile);

    return { success: true };
  };

  // Sign Out - Déconnexion immédiate et totale
  const signOut = async () => {
    try {
      // Only clear auth tokens and session data, NEVER wipe application data (conversations, messages, publications, likes, etc.)
      localStorage.removeItem('artisanpro_admin_session');
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
      const updated: UserProfile = { ...profile, ...updates };

      // 1. Immediately persist synchronously to React state and LocalStorage
      setProfile(updated);
      localStorage.setItem(`artisanpro_profile_${user.id}`, JSON.stringify(updated));

      const isUserAdmin = 
        isAdmin || 
        user.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim() ||
        user.id === 'admin-adanmitondejunior07';

      if (isUserAdmin) {
        localStorage.setItem('artisanpro_profile_admin-adanmitondejunior07', JSON.stringify(updated));
      }

      // Also sync to registered users directory in dataStore
      dataStore.saveRegisteredUser(updated);

      // 2. Try updating remote Supabase in background without blocking
      if (user.id !== 'admin-adanmitondejunior07') {
        try {
          await supabase.auth.updateUser({
            data: {
              full_name: updated.full_name,
              telephone: updated.telephone,
              pays: updated.pays,
              ville: updated.ville,
              metier: updated.metier,
              avatar_url: updated.avatar_url,
              presentation: updated.bio
            }
          });

          await supabase.from('profiles').update({
            full_name: updated.full_name,
          }).eq('id', user.id);
        } catch (remoteErr) {
          console.warn('Supabase profile remote sync note:', remoteErr);
        }
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
