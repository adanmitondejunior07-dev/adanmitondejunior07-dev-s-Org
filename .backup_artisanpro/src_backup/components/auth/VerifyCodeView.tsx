import React, { useState, useRef, useEffect } from 'react';
import { Hammer, ArrowLeft, RefreshCw, CheckCircle, AlertCircle, ShieldCheck, Mail, Sparkles, Link2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { router } from '../../lib/router';

interface VerifyCodeViewProps {
  initialEmail?: string;
  onSuccess?: () => void;
  onBack?: () => void;
}

export const VerifyCodeView: React.FC<VerifyCodeViewProps> = ({
  initialEmail,
  onSuccess,
  onBack
}) => {
  const { verifyOtp, verifyMagicLink, signInWithOtp } = useAuth();
  
  // 1. Récupération de l'email depuis prop ou paramètre d'URL (?email=...)
  const [email, setEmail] = useState<string>(() => {
    if (initialEmail) return initialEmail;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('email') || 'artisanproafrique@gmail.com';
    } catch {
      return 'artisanproafrique@gmail.com';
    }
  });

  // 2. Formulaire avec 8 cases pour accepter le code à 8 chiffres par défaut de Supabase
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerifyingMagic, setIsVerifyingMagic] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hasUrlToken, setHasUrlToken] = useState(false);

  // Resend cooldown timer
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Focus sur la 1ère case au chargement
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Détection d'un token ou magic link présent dans l'URL (query params ou hash fragment)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const urlEmail = searchParams.get('email') || hashParams.get('email');
      if (urlEmail && urlEmail !== email) {
        setEmail(urlEmail);
      }

      const token = 
        searchParams.get('token') || 
        hashParams.get('token') || 
        searchParams.get('token_hash') || 
        hashParams.get('token_hash') ||
        searchParams.get('code') ||
        hashParams.get('code') ||
        hashParams.get('access_token');

      if (token) {
        setHasUrlToken(true);
      }
    } catch (e) {
      // Ignorer
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handlePastedCode = (pasted: string) => {
    const numbers = pasted.replace(/[^0-9]/g, '').slice(0, 8);
    if (!numbers) return;

    const newDigits = [...digits];
    for (let i = 0; i < 8; i++) {
      newDigits[i] = numbers[i] || '';
    }
    setDigits(newDigits);

    const targetIdx = Math.min(numbers.length, 7);
    inputRefs.current[targetIdx]?.focus();

    // Soumission automatique si 8 chiffres collés
    if (numbers.length === 8) {
      handleVerify(numbers);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/[^0-9]/g, '');
    if (cleanVal.length > 1) {
      handlePastedCode(cleanVal);
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanVal.slice(-1);
    setDigits(newDigits);
    setErrorMessage('');

    // Passer à la case suivante
    if (cleanVal && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }

    // Si toutes les 8 cases sont remplies, vérifier automatiquement
    const complete = newDigits.join('');
    if (complete.length === 8) {
      handleVerify(complete);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const fullCode = digits.join('');

  // 4. Vérification avec supabase.auth.verifyOtp (email et magiclink)
  const handleVerify = async (tokenCode?: string) => {
    const code = (typeof tokenCode === 'string' ? tokenCode : fullCode).trim();
    setErrorMessage('');
    setSuccessMessage('');

    if (code.length < 6) {
      setErrorMessage('Veuillez entrer le code (8 ou 6 chiffres) reçu par email.');
      return;
    }

    setIsVerifying(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      // Utilise supabase.auth.verifyOtp avec { email, token, type: 'email' }
      let { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: code,
        type: 'email'
      });

      // Si erreur, gère aussi le type 'magiclink'
      if (error) {
        const magicRes = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: code,
          type: 'magiclink' as any
        });
        if (!magicRes.error) {
          data = magicRes.data;
          error = null;
        }
      }

      if (error) {
        setErrorMessage('Code incorrect, réessaie');
        setIsVerifying(false);
      } else {
        setSuccessMessage('Connexion réussie ! Redirection en cours...');
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            router.push('/dashboard');
          }
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage('Code incorrect, réessaie');
      setIsVerifying(false);
    }
  };

  // 3. Bouton "Vérifier avec le lien magique" : lit le token depuis l'URL si l'utilisateur clique sur le lien dans l'email
  const handleVerifyMagicLink = async () => {
    setIsVerifyingMagic(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. D'abord vérifier si Supabase a déjà créé la session (via detectSessionInUrl)
      const { data: sessData } = await supabase.auth.getSession();
      if (sessData?.session?.user) {
        setSuccessMessage('Lien magique validé avec succès ! Redirection...');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          else router.push('/dashboard');
        }, 600);
        return;
      }

      // 2. Extraire les tokens depuis la query string et le hash fragment
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const token = 
        searchParams.get('token') || 
        hashParams.get('token') || 
        searchParams.get('code') || 
        hashParams.get('code');

      const tokenHash = 
        searchParams.get('token_hash') || 
        hashParams.get('token_hash');

      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');

      // Cas A : hash fragment avec access_token (format classique Supabase après clic sur lien)
      if (accessToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });

        if (!error && data?.session) {
          setSuccessMessage('Lien magique validé avec succès ! Redirection...');
          setTimeout(() => {
            if (onSuccess) onSuccess();
            else router.push('/dashboard');
          }, 600);
          return;
        }
      }

      // Cas B : token_hash dans l'URL
      if (tokenHash) {
        // Tente avec type 'magiclink' puis 'email'
        let { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'magiclink' as any
        });

        if (error) {
          const res = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'email'
          });
          data = res.data;
          error = res.error;
        }

        if (!error && (data?.session || data?.user)) {
          setSuccessMessage('Lien magique validé avec succès ! Redirection...');
          setTimeout(() => {
            if (onSuccess) onSuccess();
            else router.push('/dashboard');
          }, 600);
          return;
        }
      }

      // Cas C : token ou code dans l'URL
      if (token) {
        // Essayer type 'magiclink'
        let { data, error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: token.trim(),
          type: 'magiclink' as any
        });

        // Essayer type 'email'
        if (error) {
          const res = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: token.trim(),
            type: 'email'
          });
          data = res.data;
          error = res.error;
        }

        if (!error && (data?.session || data?.user)) {
          setSuccessMessage('Lien magique validé avec succès ! Redirection...');
          setTimeout(() => {
            if (onSuccess) onSuccess();
            else router.push('/dashboard');
          }, 600);
          return;
        }
      }

      // Appel de secours via verifyMagicLink du contexte
      const ctxRes = await verifyMagicLink(cleanEmail);
      if (ctxRes.success) {
        setSuccessMessage('Lien magique validé avec succès ! Redirection...');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          else router.push('/dashboard');
        }, 600);
        return;
      }

      // Si aucun token valide n'a été trouvé dans l'URL
      setErrorMessage(
        "Aucun lien magique détecté dans l'URL. Cliquez sur le lien « Sign in » reçu par email pour ouvrir l'application directement, ou saisissez le code à 8 chiffres ci-dessus."
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Lien magique invalide ou expiré.');
    } finally {
      setIsVerifyingMagic(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    setErrorMessage('');
    try {
      const res = await signInWithOtp(email);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setCountdown(60);
        setCanResend(false);
        setSuccessMessage(`Nouveau code ou lien envoyé à ${email}`);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-neutral-900 flex flex-col justify-between selection:bg-[#FF6B00] selection:text-white p-4">
      {/* Background Subtle Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#FF6B00_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.04] pointer-events-none" />

      {/* Top Bar with back button and brand */}
      <header className="relative z-10 max-w-md mx-auto w-full pt-4 pb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
            else router.push('/');
          }}
          className="p-2 -ml-2 rounded-xl bg-white border border-neutral-200 shadow-xs hover:bg-neutral-50 text-neutral-700 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8C38] flex items-center justify-center text-white shadow-xs">
            <Hammer className="w-4 h-4 -rotate-12" />
          </div>
          <span className="font-extrabold text-sm tracking-tight text-neutral-900">
            Artisan<span className="text-[#FF6B00]">Pro</span>
          </span>
        </div>
      </header>

      {/* Main Card */}
      <main className="relative z-10 max-w-md mx-auto w-full my-auto py-4">
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-neutral-200/90 shadow-xl shadow-neutral-900/5 space-y-5">
          {/* Header Icon */}
          <div className="text-center space-y-1.5">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 text-[#FF6B00] flex items-center justify-center mx-auto shadow-xs">
              <Mail className="w-7 h-7" />
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight">
              Vérification du code
            </h1>

            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed font-medium">
              Code envoyé à <strong className="text-neutral-900 underline font-extrabold">{email}</strong> — Vérifie ta boîte email et spam
            </p>
          </div>

          {/* Banner notification si un token a été détecté dans l'URL */}
          {hasUrlToken && (
            <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-[#FF6B00] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Un lien de connexion a été détecté dans l'adresse. Cliquez sur le bouton ci-dessous !</span>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 8 CASES POUR ENTRER LE CODE (STYLE WAVE - 8 CHIFFRES SUPABASE PAR DÉFAUT) */}
          <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="space-y-4">
            <div>
              <label className="block text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2.5">
                Code à 8 chiffres (ou collez le code reçu)
              </label>

              <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={idx === 0 ? 8 : 1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text');
                      handlePastedCode(pasted);
                    }}
                    className={`w-9 h-12 sm:w-11 sm:h-14 text-center text-lg sm:text-xl font-black rounded-xl sm:rounded-2xl border-2 transition-all outline-hidden cursor-text ${
                      digit
                        ? 'border-[#FF6B00] bg-orange-50/40 text-neutral-900 shadow-sm shadow-[#FF6B00]/10'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-[#FF6B00] focus:bg-white focus:ring-2 focus:ring-orange-200'
                    }`}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>
            </div>

            {/* BOUTON VÉRIFIER LE CODE */}
            <button
              type="submit"
              disabled={isVerifying || fullCode.length < 6}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-40 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-[#FF6B00]/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {isVerifying ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Vérification du code...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Vérifier le code</span>
                </>
              )}
            </button>
          </form>

          {/* SÉPARATEUR OU */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-neutral-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400 shrink-0">
              OU
            </span>
            <div className="border-t border-neutral-200 w-full" />
          </div>

          {/* 3. BOUTON "VÉRIFIER AVEC LE LIEN MAGIQUE" */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={handleVerifyMagicLink}
              disabled={isVerifyingMagic}
              className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-orange-50/60 active:scale-[0.99] border-2 border-[#FF6B00] text-[#FF6B00] font-bold text-sm sm:text-base shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isVerifyingMagic ? (
                <>
                  <span className="w-5 h-5 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
                  <span>Lecture du lien magique...</span>
                </>
              ) : (
                <>
                  <Link2 className="w-5 h-5" />
                  <span>Vérifier avec le lien magique</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-neutral-500 leading-tight">
              Si tu as cliqué sur le lien « Sign in » dans ton email, clique ici pour valider automatiquement
            </p>
          </div>

          {/* RESEND OPTION */}
          <div className="pt-2 border-t border-neutral-100 text-center space-y-1.5">
            <p className="text-xs text-neutral-500">
              Tu n'as rien reçu dans ta boîte mail (pense à vérifier les spams) ?
            </p>

            <button
              type="button"
              onClick={handleResendCode}
              disabled={!canResend || isResending}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6B00] hover:underline disabled:text-neutral-400 disabled:no-underline cursor-pointer disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              <span>
                {canResend
                  ? 'Renvoyer le code ou lien'
                  : `Renvoyer (${countdown}s)`}
              </span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="relative z-10 max-w-md mx-auto w-full pb-4 text-center">
        <p className="text-[11px] text-neutral-400">
          Système sécurisé par Supabase Auth & Magic Link • ArtisanPro Afrique
        </p>
      </footer>
    </div>
  );
};
