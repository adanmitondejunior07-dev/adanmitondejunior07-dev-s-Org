import React, { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Hammer, ArrowLeft, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { router } from '../../lib/router';

interface NewPasswordViewProps {
  onSuccess?: () => void;
}

export const NewPasswordView: React.FC<NewPasswordViewProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!password) {
      setErrorMessage('Veuillez saisir votre nouveau mot de passe.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: password });

      if (error) {
        setErrorMessage(error.message || 'Impossible de mettre à jour le mot de passe.');
        setIsLoading(false);
      } else {
        setSuccessMessage('Mot de passe changé !');
        setIsLoading(false);

        if (onSuccess) {
          onSuccess();
        }

        // Redirige vers /login après succès
        setTimeout(() => {
          router.push('/login');
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur est survenue.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col justify-between selection:bg-[#FF6B00] selection:text-white">
      {/* Subtle African background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#FF6B00_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.04] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 px-6 pt-6 pb-2 flex items-center justify-between max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="w-10 h-10 rounded-full bg-white border border-neutral-200 shadow-xs flex items-center justify-center text-neutral-700 hover:text-[#FF6B00] hover:border-[#FF6B00] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8C38] flex items-center justify-center text-white shadow-md shadow-[#FF6B00]/25">
            <Hammer className="w-4 h-4 -rotate-12" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-neutral-900">
            Artisan<span className="text-[#FF6B00]">Pro</span>
          </span>
        </div>

        <div className="w-10" />
      </header>

      {/* Main Container */}
      <main className="relative z-10 px-5 flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-6">
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xl shadow-neutral-900/5 border border-neutral-200/80">
          {/* Header Title */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#FF6B00] border border-orange-100 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Lock className="w-7 h-7" />
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight">
              Nouveau mot de passe
            </h1>

            <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-xs mx-auto leading-relaxed">
              Choisissez un nouveau mot de passe sécurisé pour votre compte.
            </p>
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">{successMessage}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Redirection vers la page de connexion...</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Nouveau mot de passe */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Minimum 6 caractères"
                  className="w-full pl-10 pr-11 py-3 rounded-2xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20 transition-all bg-neutral-50/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 2. Confirmer le mot de passe */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Répétez le mot de passe"
                  className="w-full pl-10 pr-11 py-3 rounded-2xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20 transition-all bg-neutral-50/40"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-3.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Bouton de validation */}
            <button
              type="submit"
              disabled={isLoading || !!successMessage}
              className="w-full py-4 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] active:scale-[0.99] disabled:opacity-60 text-white font-bold text-sm sm:text-base shadow-lg shadow-[#FF6B00]/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : successMessage ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Mot de passe changé !</span>
                </>
              ) : (
                <span>Changer mon mot de passe</span>
              )}
            </button>
          </form>

          {/* Link back */}
          <div className="mt-6 pt-5 border-t border-neutral-100 text-center">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-xs text-neutral-500 hover:text-[#FF6B00] font-semibold transition-colors cursor-pointer"
            >
              ← Annuler et retourner à la connexion
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 text-center max-w-md mx-auto w-full">
        <p className="text-[11px] text-neutral-400">
          ArtisanPro Afrique — Mot de passe chiffré de bout en bout
        </p>
      </footer>
    </div>
  );
};
