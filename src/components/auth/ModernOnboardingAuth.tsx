import React, { useState } from 'react';
import { 
  Hammer, 
  Home, 
  Wrench, 
  ChevronRight, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  User, 
  Phone, 
  Mail,
  MapPin, 
  Building2, 
  Briefcase, 
  Clock, 
  FileText, 
  Lock, 
  ShieldCheck, 
  Check, 
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MetierSelectionModal } from './MetierSelectionModal';
import { PAYS_AFRIQUE, SUPABASE_URL, formatFetchError } from '../../lib/supabase';
import { router } from '../../lib/router';

interface ModernOnboardingAuthProps {
  onNavigateToVerify?: (email: string) => void;
  initialShowLogin?: boolean;
}

type ScreenState = 'onboarding' | 'choice' | 'artisan' | 'client';
type AuthTab = 'login' | 'register';

export const ModernOnboardingAuth: React.FC<ModernOnboardingAuthProps> = ({
  onNavigateToVerify,
  initialShowLogin = false
}) => {
  const { signIn, signUpClient, signUpArtisan } = useAuth();

  // State management
  const [screen, setScreen] = useState<ScreenState>(() => initialShowLogin ? 'choice' : 'onboarding');
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [authTab, setAuthTab] = useState<AuthTab>(() => initialShowLogin ? 'login' : 'login');

  // Metier modal state
  const [isMetierModalOpen, setIsMetierModalOpen] = useState(false);
  const [selectedMetiers, setSelectedMetiers] = useState<string[]>([]);

  // Passwords visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Common Form Fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Client Register Fields
  const [clientFullName, setClientFullName] = useState('');
  const [clientIdentifier, setClientIdentifier] = useState('');
  const [clientSecondaryPhone, setClientSecondaryPhone] = useState('');
  const [clientPays, setClientPays] = useState('Côte d\'Ivoire');
  const [clientVille, setClientVille] = useState('Abidjan');
  const [clientCommune, setClientCommune] = useState('');
  const [clientAdresse, setClientAdresse] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientConfirmPassword, setClientConfirmPassword] = useState('');
  const [clientAcceptTerms, setClientAcceptTerms] = useState(false);

  // Artisan Register Fields
  const [artisanFullName, setArtisanFullName] = useState('');
  const [artisanIdentifier, setArtisanIdentifier] = useState('');
  const [artisanSecondaryPhone, setArtisanSecondaryPhone] = useState('');
  const [artisanPays, setArtisanPays] = useState('Côte d\'Ivoire');
  const [artisanVille, setArtisanVille] = useState('Abidjan');
  const [artisanCommune, setArtisanCommune] = useState('');
  const [artisanAdresse, setArtisanAdresse] = useState('');
  const [artisanExperience, setArtisanExperience] = useState('2 ans');
  const [artisanDescription, setArtisanDescription] = useState('');
  const [artisanPassword, setArtisanPassword] = useState('');
  const [artisanConfirmPassword, setArtisanConfirmPassword] = useState('');
  const [artisanAcceptTerms, setArtisanAcceptTerms] = useState(false);

  // Loading & Error States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Experience Options
  const EXPERIENCE_OPTIONS = [
    'Moins d\'1 an',
    '1 an',
    '2 ans',
    '3 ans',
    '4 ans',
    '5 ans',
    '6 à 10 ans',
    'Plus de 10 ans'
  ];

  // Onboarding Slides Data (as per user specifications)
  const ONBOARDING_SLIDES = [
    {
      image: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?auto=format&fit=crop&w=900&q=80',
      badge: 'Proximité & Rapidité',
      title: 'Trouve un artisan près de chez vous',
      subtitle: 'Recherchez des artisans qualifiés selon votre besoin et votre localisation.',
      buttonText: 'Continuer >'
    },
    {
      image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=900&q=80',
      badge: 'Qualité Garantie',
      title: 'Des artisans vérifiés',
      subtitle: 'Tous nos artisans sont vérifiés pour garantir un service de qualité.',
      buttonText: 'Continuer >'
    },
    {
      image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=900&q=80',
      badge: 'Confiance & Sécurité',
      title: 'Des artisans vérifiés',
      subtitle: 'Tous nos artisans sont vérifiés pour garantir un service de qualité.',
      buttonText: 'Commencer >'
    }
  ];

  const handleNextOnboarding = () => {
    if (onboardingIndex < ONBOARDING_SLIDES.length - 1) {
      setOnboardingIndex(prev => prev + 1);
    } else {
      setScreen('choice');
    }
  };

  const handleSkipOnboarding = () => {
    setScreen('choice');
  };

  // Helper to split full name into first and last name
  const splitFullName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return { prenom: parts[0], nom: parts[0] };
    }
    const prenom = parts[0];
    const nom = parts.slice(1).join(' ');
    return { prenom, nom };
  };

  // Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanIdentifier = loginIdentifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage('Veuillez renseigner votre email ou numéro de téléphone.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Veuillez renseigner votre mot de passe.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signIn(cleanIdentifier, loginPassword);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage('Connexion réussie !');
        // Rediriger immédiatement vers l'accueil de l'application
        setTimeout(() => {
          router.push('/');
        }, 400);
      }
    } catch (err: any) {
      setErrorMessage(formatFetchError(err, `${SUPABASE_URL}/auth/v1/token`));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Client Register submission
  const handleClientRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!clientFullName.trim()) {
      setErrorMessage('Veuillez renseigner votre nom complet.');
      return;
    }
    const rawId = clientIdentifier.trim();
    if (!rawId) {
      setErrorMessage('Veuillez renseigner votre email ou numéro de téléphone.');
      return;
    }
    if (!clientPassword || clientPassword.length < 6) {
      setErrorMessage('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (clientPassword !== clientConfirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }
    if (!clientAcceptTerms) {
      setErrorMessage('Veuillez accepter les conditions d\'utilisation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { prenom, nom } = splitFullName(clientFullName);
      let email = '';
      let telephone = '';

      if (rawId.includes('@')) {
        email = rawId.toLowerCase();
        telephone = clientSecondaryPhone.trim();
      } else {
        telephone = rawId;
        email = clientSecondaryPhone.includes('@') ? clientSecondaryPhone.trim().toLowerCase() : '';
      }

      if (!email) {
        const cleanDigits = telephone.replace(/[^0-9]/g, '');
        email = `${cleanDigits}@client.artisanpro.africa`;
      }

      const fullVille = clientCommune ? `${clientVille} (${clientCommune})` : clientVille;

      const res = await signUpClient({
        nom,
        prenom,
        email,
        telephone,
        password: clientPassword,
        pays: clientPays,
        ville: fullVille
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage('Compte client créé avec succès !');
        if (res.needsEmailConfirm && onNavigateToVerify) {
          onNavigateToVerify(email);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l\'inscription client.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Artisan Register submission
  const handleArtisanRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!artisanFullName.trim()) {
      setErrorMessage('Veuillez renseigner votre nom complet.');
      return;
    }
    const rawId = artisanIdentifier.trim();
    if (!rawId) {
      setErrorMessage('Veuillez renseigner votre email ou numéro de téléphone.');
      return;
    }
    if (selectedMetiers.length === 0) {
      setErrorMessage('Veuillez sélectionner au moins un métier.');
      setIsMetierModalOpen(true);
      return;
    }
    if (!artisanPassword || artisanPassword.length < 6) {
      setErrorMessage('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (artisanPassword !== artisanConfirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }
    if (!artisanAcceptTerms) {
      setErrorMessage('Veuillez accepter les conditions d\'utilisation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { prenom, nom } = splitFullName(artisanFullName);
      let email = '';
      let telephone = '';

      if (rawId.includes('@')) {
        email = rawId.toLowerCase();
        telephone = artisanSecondaryPhone.trim();
      } else {
        telephone = rawId;
        email = artisanSecondaryPhone.includes('@') ? artisanSecondaryPhone.trim().toLowerCase() : '';
      }

      if (!email) {
        const cleanDigits = telephone.replace(/[^0-9]/g, '');
        email = `${cleanDigits}@artisan.artisanpro.africa`;
      }

      const primaryMetier = selectedMetiers[0];
      const allMetiersText = selectedMetiers.join(', ');
      const fullVille = artisanCommune ? `${artisanVille} (${artisanCommune})` : artisanVille;
      const fullPresentation = `${artisanDescription.trim() || 'Artisan professionnel qualifié.'}\nSpécialités : ${allMetiersText}\nExpérience : ${artisanExperience}\nAdresse : ${artisanAdresse.trim() || 'Non spécifiée'}`;

      const res = await signUpArtisan({
        nom,
        prenom,
        email,
        telephone,
        password: artisanPassword,
        pays: artisanPays,
        ville: fullVille,
        metier: primaryMetier,
        presentation: fullPresentation
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage('Compte artisan créé avec succès !');
        if (res.needsEmailConfirm && onNavigateToVerify) {
          onNavigateToVerify(email);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l\'inscription artisan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // 1. ÉCRAN ONBOARDING (3 Écrans avec Pagination)
  // =========================================================================
  if (screen === 'onboarding') {
    const currentSlide = ONBOARDING_SLIDES[onboardingIndex];

    return (
      <div className="min-h-screen bg-[#F8F8F8] text-neutral-900 flex flex-col justify-between max-w-md mx-auto w-full relative selection:bg-[#FF6B1A] selection:text-white">
        {/* Top Header with Skip Button */}
        <div className="p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FF6B1A] text-white flex items-center justify-center shadow-md shadow-[#FF6B1A]/20">
              <Hammer className="w-4 h-4 -rotate-12" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-neutral-900">
              Artisan<span className="text-[#FF6B1A]">Pro</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleSkipOnboarding}
            className="text-xs font-bold text-neutral-500 hover:text-neutral-800 px-3 py-1.5 rounded-full hover:bg-neutral-200/50 cursor-pointer transition-colors"
          >
            Passer
          </button>
        </div>

        {/* Slide Photo & Card */}
        <div className="flex-1 flex flex-col px-4 pb-4 justify-center">
          <div className="bg-white rounded-[28px] overflow-hidden border border-neutral-200/80 shadow-xl shadow-neutral-900/5 flex flex-col">
            {/* Visual Image */}
            <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-neutral-900">
              <img
                src={currentSlide.image}
                alt={currentSlide.title}
                className="w-full h-full object-cover transition-all duration-500 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              
              {/* Floating Badge */}
              <div className="absolute bottom-4 left-4 z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B1A] text-white text-[11px] font-black uppercase tracking-wider shadow-md">
                  <Sparkles className="w-3 h-3" />
                  {currentSlide.badge}
                </span>
              </div>
            </div>

            {/* Slide Text Content */}
            <div className="p-6 text-center space-y-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight leading-snug">
                {currentSlide.title}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-xs mx-auto">
                {currentSlide.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Footer with Pagination Dots & Action Button */}
        <div className="p-5 pt-0 space-y-4">
          {/* Pagination Dots */}
          <div className="flex items-center justify-center gap-2">
            {ONBOARDING_SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setOnboardingIndex(idx)}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  idx === onboardingIndex
                    ? 'w-7 h-2 bg-[#FF6B1A]'
                    : 'w-2 h-2 bg-neutral-300 hover:bg-neutral-400'
                }`}
                aria-label={`Écran ${idx + 1}`}
              />
            ))}
          </div>

          {/* Bottom Action Button */}
          <button
            type="button"
            onClick={handleNextOnboarding}
            className="w-full py-4 px-6 rounded-2xl bg-[#FF6B1A] hover:bg-[#e05e00] active:scale-[0.99] text-white font-extrabold text-sm sm:text-base tracking-wide shadow-lg shadow-[#FF6B1A]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{currentSlide.buttonText}</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. ÉCRAN CHOIX DE PROFIL ("Je suis...")
  // =========================================================================
  if (screen === 'choice') {
    return (
      <div className="min-h-screen bg-[#F8F8F8] text-neutral-900 flex flex-col justify-between max-w-md mx-auto w-full p-5 selection:bg-[#FF6B1A] selection:text-white">
        {/* Top bar with back to onboarding */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setScreen('onboarding')}
            className="w-9 h-9 rounded-full bg-white border border-neutral-200 text-neutral-700 flex items-center justify-center hover:bg-neutral-100 cursor-pointer shadow-xs transition-colors"
            title="Retour"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <span className="font-extrabold text-sm tracking-tight text-neutral-900">
            Artisan<span className="text-[#FF6B1A]">Pro</span> Afrique
          </span>

          <div className="w-9" /> {/* Spacer */}
        </div>

        {/* Center Content */}
        <div className="space-y-6 my-auto py-6">
          {/* Header & Central Orange Icon */}
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-3xl bg-orange-100/90 text-[#FF6B1A] border-2 border-orange-200 flex items-center justify-center mx-auto shadow-md shadow-[#FF6B1A]/10">
              <Hammer className="w-10 h-10 -rotate-12 stroke-[2.2]" />
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
                Je suis...
              </h1>
              <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                Choisissez votre profil pour commencer
              </p>
            </div>
          </div>

          {/* 2 Big Action Cards */}
          <div className="space-y-3.5">
            {/* Carte 1: Artisan */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setScreen('artisan');
                setAuthTab('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="group bg-white hover:bg-orange-50/40 p-5 rounded-3xl border-2 border-neutral-200/90 hover:border-[#FF6B1A] shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-4 text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#FF6B1A] text-white flex items-center justify-center shadow-md shadow-[#FF6B1A]/20 shrink-0 group-hover:scale-105 transition-transform">
                <Wrench className="w-7 h-7 -rotate-12" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-base text-neutral-900 group-hover:text-[#FF6B1A] transition-colors">
                    Artisan
                  </h3>
                  <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-[#FF6B1A] group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs font-bold text-neutral-700 mt-0.5">
                  Je propose mes services
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                  Plombier, électricien, mécanicien...
                </p>
              </div>
            </div>

            {/* Carte 2: Client */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setScreen('client');
                setAuthTab('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="group bg-white hover:bg-orange-50/40 p-5 rounded-3xl border-2 border-neutral-200/90 hover:border-[#FF6B1A] shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-4 text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-md shadow-neutral-900/20 shrink-0 group-hover:scale-105 transition-transform">
                <Home className="w-7 h-7 text-[#FF6B1A]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-base text-neutral-900 group-hover:text-[#FF6B1A] transition-colors">
                    Client
                  </h3>
                  <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-[#FF6B1A] group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs font-bold text-neutral-700 mt-0.5">
                  Je cherche un artisan
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                  Pour mes travaux ou réparations
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-[11px] text-neutral-500 pb-2">
          <span>Vous avez déjà un compte ? </span>
          <button
            type="button"
            onClick={() => {
              setScreen('artisan');
              setAuthTab('login');
              setErrorMessage(null);
            }}
            className="text-[#FF6B1A] font-bold hover:underline cursor-pointer"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. ÉCRANS AUTH : ESPACE ARTISAN & ESPACE CLIENT
  // =========================================================================
  const isArtisan = screen === 'artisan';

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-neutral-900 flex flex-col justify-between max-w-md mx-auto w-full p-4 sm:p-5 selection:bg-[#FF6B1A] selection:text-white">
      {/* Top Header with Back button */}
      <div>
        <div className="flex items-center justify-between pt-1 pb-4">
          <button
            type="button"
            onClick={() => setScreen('choice')}
            className="w-9 h-9 rounded-full bg-white border border-neutral-200 text-neutral-700 flex items-center justify-center hover:bg-neutral-100 cursor-pointer shadow-xs transition-colors"
            title="Changer de profil"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <span className="font-extrabold text-sm tracking-tight text-neutral-900">
            Artisan<span className="text-[#FF6B1A]">Pro</span> Afrique
          </span>

          <div className="w-9" />
        </div>

        {/* Header section with icon, greeting & badge */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/90 shadow-xs mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                isArtisan ? 'bg-[#FF6B1A]' : 'bg-neutral-900'
              }`}>
                {isArtisan ? <Wrench className="w-4 h-4" /> : <Home className="w-4 h-4 text-[#FF6B1A]" />}
              </div>
              <h1 className="font-black text-xl text-neutral-900 tracking-tight flex items-center gap-1.5">
                <span>Bienvenue</span>
                <span className="text-xl">👋</span>
              </h1>
            </div>

            {/* Badge Espace Artisan / Espace Client */}
            <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${
              isArtisan
                ? 'bg-orange-50 text-[#FF6B1A] border-orange-200'
                : 'bg-neutral-100 text-neutral-800 border-neutral-200'
            }`}>
              {isArtisan ? 'Espace Artisan' : 'Espace Client'}
            </span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            {authTab === 'login' 
              ? 'Heureux de vous revoir ! Connectez-vous à votre espace sécurisé.' 
              : 'Commencez l\'expérience dès maintenant en créant votre profil.'}
          </p>

          {/* 2 Tabs: Connexion / Inscription */}
          <div className="mt-4 grid grid-cols-2 p-1 bg-[#F8F8F8] rounded-2xl border border-neutral-200/80">
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                authTab === 'login'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                authTab === 'register'
                  ? 'bg-[#FF6B1A] text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Inscription
            </button>
          </div>
        </div>
      </div>

      {/* Main Form Content */}
      <div className="flex-1 pb-4">
        {/* Error / Success Banners */}
        {errorMessage && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-snug font-bold">{successMessage}</span>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* FORMULAIRE CONNEXION (Artisan & Client)                           */}
        {/* ------------------------------------------------------------------ */}
        {authTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="bg-white rounded-3xl p-5 border border-neutral-200/90 shadow-xs space-y-4">
            {/* Email ou numéro de téléphone */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                Email ou numéro de téléphone
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Entrez votre email ou numéro"
                  className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-[#FF6B1A] transition-colors"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-neutral-800">
                  Mot de passe
                </label>
                <a
                  href="/mot-de-passe-oublie"
                  className="text-[11px] font-bold text-[#FF6B1A] hover:underline"
                >
                  Mot de passe oublié ?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-[#FF6B1A] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-[#FF6B1A] hover:bg-[#e05e00] text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-[#FF6B1A]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <span>SE CONNECTER</span>
                  <ChevronRight className="w-4 h-4 stroke-[3]" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* FORMULAIRE INSCRIPTION ARTISAN                                     */}
        {/* ------------------------------------------------------------------ */}
        {authTab === 'register' && isArtisan && (
          <form onSubmit={handleArtisanRegisterSubmit} className="bg-white rounded-3xl p-5 border border-neutral-200/90 shadow-xs space-y-3.5">
            {/* Nom complet */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Nom complet *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={artisanFullName}
                  onChange={(e) => setArtisanFullName(e.target.value)}
                  placeholder="Ex: Kouamé Jean-Marc"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-[#FF6B1A]"
                />
              </div>
            </div>

            {/* Email ou numéro de téléphone principal */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Email ou numéro de téléphone *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={artisanIdentifier}
                  onChange={(e) => setArtisanIdentifier(e.target.value)}
                  placeholder="exemple@gmail.com ou 0708091011"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-[#FF6B1A]"
                />
              </div>
            </div>

            {/* Contact secondaire (optionnel) */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Téléphone ou email secondaire (optionnel)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={artisanSecondaryPhone}
                  onChange={(e) => setArtisanSecondaryPhone(e.target.value)}
                  placeholder="Ex: 0102030405 ou contact@exemple.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-[#FF6B1A]"
                />
              </div>
            </div>

            {/* Pays & Ville */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Pays
                </label>
                <select
                  value={artisanPays}
                  onChange={(e) => setArtisanPays(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900 font-medium cursor-pointer"
                >
                  {PAYS_AFRIQUE.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Ville *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={artisanVille}
                    onChange={(e) => setArtisanVille(e.target.value)}
                    placeholder="Ex: Abidjan"
                    className="w-full pl-8 pr-2.5 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900"
                  />
                </div>
              </div>
            </div>

            {/* Commune & Adresse */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Commune
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={artisanCommune}
                    onChange={(e) => setArtisanCommune(e.target.value)}
                    placeholder="Ex: Cocody"
                    className="w-full pl-8 pr-2.5 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Adresse / Rue
                </label>
                <input
                  type="text"
                  value={artisanAdresse}
                  onChange={(e) => setArtisanAdresse(e.target.value)}
                  placeholder="Ex: Rue des Jardins"
                  className="w-full px-3 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900"
                />
              </div>
            </div>

            {/* Dropdown / Bouton "Choisir mon/mes métier(s)" */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Métier(s) *
              </label>
              <button
                type="button"
                onClick={() => setIsMetierModalOpen(true)}
                className="w-full p-3 rounded-2xl bg-[#F8F8F8] hover:bg-orange-50/50 border border-neutral-200 text-left transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Briefcase className="w-4 h-4 text-[#FF6B1A] shrink-0" />
                  {selectedMetiers.length > 0 ? (
                    <span className="text-xs font-bold text-neutral-900 truncate">
                      {selectedMetiers.join(', ')}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 font-medium">
                      Choisir mon/mes métier(s)...
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-bold text-[#FF6B1A] shrink-0">
                  {selectedMetiers.length > 0 ? `(${selectedMetiers.length}) Modifier` : 'Sélectionner >'}
                </span>
              </button>
            </div>

            {/* Dropdown "Années d'expérience" */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Années d'expérience
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  value={artisanExperience}
                  onChange={(e) => setArtisanExperience(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900 font-medium cursor-pointer"
                >
                  {EXPERIENCE_OPTIONS.map(exp => (
                    <option key={exp} value={exp}>{exp}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Zone texte "Description du service" */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Description du service
              </label>
              <textarea
                rows={2}
                value={artisanDescription}
                onChange={(e) => setArtisanDescription(e.target.value)}
                placeholder="Décrivez brièvement vos compétences, réalisations et disponibilités..."
                className="w-full p-3 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-[#FF6B1A]"
              />
            </div>

            {/* Mot de passe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Mot de passe *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={artisanPassword}
                    onChange={(e) => setArtisanPassword(e.target.value)}
                    placeholder="Min. 6 car."
                    className="w-full pl-3 pr-8 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Confirmer *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={artisanConfirmPassword}
                    onChange={(e) => setArtisanConfirmPassword(e.target.value)}
                    placeholder="Confirmer"
                    className="w-full pl-3 pr-8 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Checkbox Conditions */}
            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={artisanAcceptTerms}
                onChange={(e) => setArtisanAcceptTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#FF6B1A] rounded"
              />
              <span className="text-[11px] text-neutral-600 leading-tight">
                J'accepte les conditions d'utilisation et la politique de confidentialité d'ArtisanPro Afrique.
              </span>
            </label>

            {/* Bouton S'inscrire */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-[#FF6B1A] hover:bg-[#e05e00] text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-[#FF6B1A]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Création du compte artisan...</span>
                </>
              ) : (
                <>
                  <span>S'inscrire</span>
                  <ChevronRight className="w-4 h-4 stroke-[3]" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* FORMULAIRE INSCRIPTION CLIENT                                      */}
        {/* ------------------------------------------------------------------ */}
        {authTab === 'register' && !isArtisan && (
          <form onSubmit={handleClientRegisterSubmit} className="bg-white rounded-3xl p-5 border border-neutral-200/90 shadow-xs space-y-3.5">
            {/* Nom complet */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Nom complet *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={clientFullName}
                  onChange={(e) => setClientFullName(e.target.value)}
                  placeholder="Ex: Amani Sarah"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900"
                />
              </div>
            </div>

            {/* Email ou numéro de téléphone principal */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Email ou numéro de téléphone *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={clientIdentifier}
                  onChange={(e) => setClientIdentifier(e.target.value)}
                  placeholder="exemple@gmail.com ou 0506070809"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-[#FF6B1A]"
                />
              </div>
            </div>

            {/* Contact secondaire (optionnel) */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Téléphone ou email secondaire (optionnel)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clientSecondaryPhone}
                  onChange={(e) => setClientSecondaryPhone(e.target.value)}
                  placeholder="Ex: 0102030405 ou contact@exemple.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-[#FF6B1A]"
                />
              </div>
            </div>

            {/* Ville & Commune */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Ville *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={clientVille}
                    onChange={(e) => setClientVille(e.target.value)}
                    placeholder="Ex: Abidjan"
                    className="w-full pl-8 pr-2.5 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Commune
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={clientCommune}
                    onChange={(e) => setClientCommune(e.target.value)}
                    placeholder="Ex: Marcory"
                    className="w-full pl-8 pr-2.5 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900"
                  />
                </div>
              </div>
            </div>

            {/* Adresse */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Adresse de résidence
              </label>
              <input
                type="text"
                value={clientAdresse}
                onChange={(e) => setClientAdresse(e.target.value)}
                placeholder="Ex: Boulevard Valéry Giscard d'Estaing"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900"
              />
            </div>

            {/* Mot de passe & Confirmation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Mot de passe *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.target.value)}
                    placeholder="Min. 6 car."
                    className="w-full pl-3 pr-8 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Confirmer *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={clientConfirmPassword}
                    onChange={(e) => setClientConfirmPassword(e.target.value)}
                    placeholder="Confirmer"
                    className="w-full pl-3 pr-8 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Checkbox Conditions */}
            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={clientAcceptTerms}
                onChange={(e) => setClientAcceptTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#FF6B1A] rounded"
              />
              <span className="text-[11px] text-neutral-600 leading-tight">
                J'accepte les conditions d'utilisation et la politique de confidentialité.
              </span>
            </label>

            {/* Bouton S'inscrire */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-[#FF6B1A] hover:bg-[#e05e00] text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-[#FF6B1A]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Création du compte client...</span>
                </>
              ) : (
                <>
                  <span>S'inscrire</span>
                  <ChevronRight className="w-4 h-4 stroke-[3]" />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Modal Sélection Métier */}
      <MetierSelectionModal
        isOpen={isMetierModalOpen}
        onClose={() => setIsMetierModalOpen(false)}
        selectedMetiers={selectedMetiers}
        onSelectMetiers={(mets) => {
          setSelectedMetiers(mets);
          setErrorMessage(null);
        }}
      />
    </div>
  );
};
