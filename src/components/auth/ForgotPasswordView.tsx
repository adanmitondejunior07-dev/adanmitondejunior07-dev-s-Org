import React, { useState } from 'react';
import { Mail, ArrowLeft, AlertCircle, Hammer, Sparkles, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { router } from '../../lib/router';

interface ForgotPasswordViewProps {
  onBack?: () => void;
  onNavigateToRegister?: () => void;
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({
  onBack,
  onNavigateToRegister
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanInput = email.trim();
    if (!cleanInput) {
      setErrorMessage('Veuillez renseigner votre email ou numéro de téléphone.');
      return;
    }

    setIsLoading(true);

    try {
      let targetEmail = cleanInput.toLowerCase();

      // If user provided a phone number instead of an email
      if (!cleanInput.includes('@')) {
        const cleanDigits = cleanInput.replace(/[^0-9]/g, '');
        if (cleanDigits.length >= 8) {
          const suffix = cleanDigits.slice(-8);
          // Try to look up profile by phone number
          const { data: profile } = await supabase
            .from('profils')
            .select('email, telephone')
            .ilike('telephone', `%${suffix}%`)
            .maybeSingle();

          if (profile?.email && profile.email.includes('@')) {
            targetEmail = profile.email.toLowerCase();
          } else {
            // Check fallback profiles table
            const { data: p2 } = await supabase
              .from('profiles')
              .select('email, telephone')
              .ilike('telephone', `%${suffix}%`)
              .maybeSingle();

            if (p2?.email && p2.email.includes('@')) {
              targetEmail = p2.email.toLowerCase();
            } else {
              targetEmail = `${cleanDigits}@client.artisanpro.africa`;
            }
          }
        }
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: { shouldCreateUser: false }
      });

      if (error) {
        const msg = error.message || '';
        if (
          msg.toLowerCase().includes('user not found') ||
          msg.toLowerCase().includes('user_not_found') ||
          msg.toLowerCase().includes('signups not allowed')
        ) {
          setErrorMessage("Cet identifiant n'existe pas, veuillez vous inscrire.");
        } else {
          setErrorMessage(msg || 'Erreur lors de l\'envoi du code.');
        }
      } else {
        setIsSuccess(true);
        // Small delay or instant push to verify-reset
        setTimeout(() => {
          router.push(`/verify-reset?email=${encodeURIComponent(targetEmail)}`);
        }, 300);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur est survenue.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/login');
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
          onClick={handleGoBack}
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

      {/* Main Container */}
      <main className="relative z-10 px-5 flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-6">
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xl shadow-neutral-900/5 border border-neutral-200/80">
          {/* Title & Description */}
          <div className="text-center mb-6">
            <div className="w-13 h-13 rounded-2xl bg-orange-50 text-[#FF6B1A] border border-orange-100 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Mail className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight">
              Mot de passe oublié
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-xs mx-auto leading-relaxed">
              Saisissez votre email ou numéro de téléphone pour recevoir votre code de vérification à 6 chiffres.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {errorMessage.includes('inscrivez-vous') && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateToRegister) {
                          onNavigateToRegister();
                        } else {
                          router.push('/register');
                        }
                      }}
                      className="font-bold text-[#FF6B1A] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Créer un compte maintenant</span>
                      <span>→</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Email ou numéro de téléphone
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Entrez votre email ou numéro"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B1A] focus:ring-2 focus:ring-[#FF6B1A]/20 transition-all bg-neutral-50/40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className="w-full py-4 px-6 rounded-2xl bg-[#FF6B1A] hover:bg-[#e05e00] active:scale-[0.99] disabled:opacity-60 text-white font-bold text-sm sm:text-base shadow-lg shadow-[#FF6B1A]/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Envoi en cours...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Code envoyé !</span>
                </>
              ) : (
                <span>Envoyer le code</span>
              )}
            </button>
          </form>

          {/* Bottom links */}
          <div className="mt-6 pt-5 border-t border-neutral-100 text-center space-y-2">
            <p className="text-xs text-neutral-500">
              Vous vous souvenez de votre mot de passe ?{' '}
              <button
                type="button"
                onClick={handleGoBack}
                className="font-bold text-[#FF6B1A] hover:underline cursor-pointer"
              >
                Se connecter
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 text-center max-w-md mx-auto w-full">
        <p className="text-[11px] text-neutral-400">
          ArtisanPro Afrique — Code de récupération sécurisé
        </p>
      </footer>
    </div>
  );
};
