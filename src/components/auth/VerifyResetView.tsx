import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle, AlertCircle, ShieldCheck, Mail, Hammer, Link2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { router } from '../../lib/router';

interface VerifyResetViewProps {
  initialEmail?: string;
  onSuccess?: () => void;
  onBack?: () => void;
}

export const VerifyResetView: React.FC<VerifyResetViewProps> = ({
  initialEmail,
  onSuccess,
  onBack
}) => {
  // 1. Récupère l'email dans l'URL ou prop
  const [email, setEmail] = useState<string>(() => {
    if (initialEmail) return initialEmail;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('email') || 'artisanproafrique@gmail.com';
    } catch {
      return 'artisanproafrique@gmail.com';
    }
  });

  // 2. 8 cases input pour le code (style Wave - défaut Supabase 8 chiffres)
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerifyingMagic, setIsVerifyingMagic] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Resend cooldown timer
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Update email if query string changes
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get('email');
      if (urlEmail && urlEmail !== email) {
        setEmail(urlEmail);
      }
    } catch {}
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

    // Auto submit if 8 digits pasted
    if (numbers.length === 8) {
      verifyCode(numbers);
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

    // Advance to next input if filled
    if (cleanVal && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto trigger if all 8 filled
    const complete = newDigits.join('');
    if (complete.length === 8) {
      verifyCode(complete);
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

  const verifyCode = async (tokenCode?: string) => {
    const codeComplet = (tokenCode || digits.join('')).trim();
    if (codeComplet.length < 6) {
      setErrorMessage('Veuillez entrer le code reçu par email.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      let { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: codeComplet,
        type: 'email'
      });

      if (error) {
        const magicRes = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: codeComplet,
          type: 'magiclink' as any
        });
        if (!magicRes.error) {
          data = magicRes.data;
          error = null;
        }
      }

      if (error) {
        setErrorMessage('Code incorrect');
        setIsVerifying(false);
      } else {
        setSuccessMessage('Code vérifié avec succès !');
        if (onSuccess) {
          onSuccess();
        }
        setTimeout(() => {
          router.push('/nouveau-mot-de-passe');
        }, 300);
      }
    } catch (err: any) {
      setErrorMessage('Code incorrect');
      setIsVerifying(false);
    }
  };

  // Lecture du lien magique depuis l'URL
  const handleVerifyMagicLink = async () => {
    setIsVerifyingMagic(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const cleanEmail = email.trim().toLowerCase();
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

      if (accessToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });
        if (!error) {
          setSuccessMessage('Lien validé ! Redirection...');
          setTimeout(() => router.push('/nouveau-mot-de-passe'), 500);
          return;
        }
      }

      if (tokenHash) {
        let { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'magiclink' as any
        });
        if (error) {
          const res = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'email'
          });
          error = res.error;
        }
        if (!error) {
          setSuccessMessage('Lien validé ! Redirection...');
          setTimeout(() => router.push('/nouveau-mot-de-passe'), 500);
          return;
        }
      }

      if (token) {
        let { error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: token.trim(),
          type: 'magiclink' as any
        });
        if (error) {
          const res = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: token.trim(),
            type: 'email'
          });
          error = res.error;
        }
        if (!error) {
          setSuccessMessage('Lien validé ! Redirection...');
          setTimeout(() => router.push('/nouveau-mot-de-passe'), 500);
          return;
        }
      }

      setErrorMessage("Aucun lien magique détecté dans l'URL. Cliquez sur le lien 'Sign in' dans l'email ou saisissez le code.");
    } catch (err: any) {
      setErrorMessage(err.message || 'Lien magique invalide.');
    } finally {
      setIsVerifyingMagic(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend || isResending) return;

    setIsResending(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: false }
      });

      if (error) {
        setErrorMessage('Erreur lors du renvoi : ' + error.message);
      } else {
        setSuccessMessage('Nouveau code envoyé dans votre boîte email !');
        setCountdown(60);
        setCanResend(false);
        setDigits(['', '', '', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      setErrorMessage('Impossible de renvoyer le code.');
    } finally {
      setIsResending(false);
    }
  };

  const handleBackAction = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/mot-de-passe-oublie');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col justify-between selection:bg-[#FF6B1A] selection:text-white">
      {/* Background African subtle pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#FF6B1A_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.04] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 px-6 pt-6 pb-2 flex items-center justify-between max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={handleBackAction}
          className="w-10 h-10 rounded-full bg-white border border-neutral-200 shadow-xs flex items-center justify-center text-neutral-700 hover:text-[#FF6B1A] hover:border-[#FF6B1A] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF6B1A] to-[#FF8C38] flex items-center justify-center text-white shadow-md shadow-[#FF6B1A]/25">
            <Hammer className="w-4 h-4 -rotate-12" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-neutral-900">
            Artisan<span className="text-[#FF6B1A]">Pro</span>
          </span>
        </div>

        <div className="w-10" />
      </header>

      {/* Main Card */}
      <main className="relative z-10 px-5 flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-6">
        <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-xl shadow-neutral-900/5 border border-neutral-200/80">
          {/* Visual Header */}
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#FF6B1A] border border-orange-100 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight">
              Vérification du code
            </h1>

            {/* Exact instruction text required: "Code envoyé à {email} - Vérifie ta boite email et spam" */}
            <p className="text-xs sm:text-sm text-neutral-600 mt-2 max-w-xs mx-auto leading-relaxed font-medium">
              Code envoyé à <strong className="text-neutral-900 break-all">{email}</strong> — Vérifie ta boîte email et spam
            </p>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* 8 cases input pour le code (style Wave) */}
          <div className="mb-5">
            <label className="block text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2.5">
              Code de sécurité (8 chiffres ou collez le code reçu)
            </label>

            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={index === 0 ? 8 : 1}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text');
                    handlePastedCode(pasted);
                  }}
                  className={`w-9 h-12 sm:w-11 sm:h-14 text-center text-lg sm:text-xl font-black rounded-xl sm:rounded-2xl border-2 transition-all outline-hidden ${
                    digit
                      ? 'border-[#FF6B1A] bg-orange-50/30 text-neutral-900 shadow-sm shadow-[#FF6B1A]/10'
                      : 'border-neutral-200 bg-neutral-50/50 text-neutral-800 focus:border-[#FF6B1A] focus:bg-white focus:ring-2 focus:ring-orange-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Bouton "Vérifier le code" */}
          <button
            type="button"
            onClick={() => verifyCode()}
            disabled={isVerifying || digits.join('').length < 6}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#FF6B1A] hover:bg-[#e05e00] active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm sm:text-base shadow-lg shadow-[#FF6B1A]/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isVerifying ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Vérification...</span>
              </>
            ) : (
              <span>Vérifier le code</span>
            )}
          </button>

          {/* Bouton "Vérifier avec le lien magique" */}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleVerifyMagicLink}
              disabled={isVerifyingMagic}
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-orange-50/60 active:scale-[0.99] border-2 border-[#FF6B1A] text-[#FF6B1A] font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isVerifyingMagic ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#FF6B1A] border-t-transparent rounded-full animate-spin" />
                  <span>Validation du lien...</span>
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  <span>Vérifier avec le lien magique</span>
                </>
              )}
            </button>
          </div>

          {/* Resend code section */}
          <div className="mt-5 pt-4 border-t border-neutral-100 flex flex-col items-center gap-2 text-center">
            <span className="text-xs text-neutral-500">
              Tu n'as pas reçu le code par email ?
            </span>

            {canResend ? (
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isResending}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6B1A] hover:underline cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                <span>Renvoyer un nouveau code</span>
              </button>
            ) : (
              <span className="text-xs text-neutral-400 font-medium">
                Renvoyer dans <strong className="text-neutral-700">{countdown}s</strong>
              </span>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 text-center max-w-md mx-auto w-full">
        <p className="text-[11px] text-neutral-400">
          Sécurité certifiée Supabase Auth & Magic Link • ArtisanPro Afrique
        </p>
      </footer>
    </div>
  );
};
