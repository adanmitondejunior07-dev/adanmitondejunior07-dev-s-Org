import React, { useState } from 'react';
import { X, Lock, Mail, AlertCircle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_EMAIL, supabase } from '../../lib/supabase';
import { router } from '../../lib/router';

interface LoginModalProps {
  onClose: () => void;
  onSwitchToRegister: () => void;
  onNavigateToVerify?: (email: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  onClose,
  onSwitchToRegister,
  onNavigateToVerify
}) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Forgot password mode
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [authMode, setAuthMode] = useState<'password' | 'code'>('password');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Veuillez saisir votre email ou numéro de téléphone.');
      return;
    }

    if (isForgotMode) {
      setIsSubmitting(true);
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: false }
      });
      setIsSubmitting(false);

      if (error) {
        const msg = error.message || '';
        if (
          msg.toLowerCase().includes('user not found') ||
          msg.toLowerCase().includes('user_not_found') ||
          msg.toLowerCase().includes('signups not allowed')
        ) {
          setErrorMessage("Cet email n'existe pas, inscrivez-vous");
        } else {
          setErrorMessage(msg);
        }
      } else {
        onClose();
        router.push(`/verify-reset?email=${encodeURIComponent(cleanEmail)}`);
      }
      return;
    }

    // Connexion par code de confirmation email (OTP)
    if (authMode === 'code') {
      setIsSubmitting(true);
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: false }
      });
      setIsSubmitting(false);

      if (error) {
        const msg = error.message || '';
        if (
          msg.toLowerCase().includes('user not found') ||
          msg.toLowerCase().includes('user_not_found') ||
          msg.toLowerCase().includes('signups not allowed')
        ) {
          setErrorMessage("Cet email n'existe pas. Veuillez créer un compte.");
        } else {
          setErrorMessage(msg);
        }
        return;
      }

      onClose();
      if (onNavigateToVerify) {
        onNavigateToVerify(cleanEmail);
      }
      router.push(`/verify-code?email=${encodeURIComponent(cleanEmail)}`);
      return;
    }

    // Connexion standard par mot de passe avec session Supabase Auth
    if (!password) {
      setErrorMessage('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsSubmitting(true);
    const res = await signIn(email, password);
    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(
        res.error.includes('Invalid login') || res.error.includes('invalid_grant')
          ? 'Identifiants incorrects. Veuillez vérifier votre adresse email et votre mot de passe.' 
          : res.error
      );
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 leading-tight">
              {isForgotMode ? 'Mot de passe oublié' : 'Connexion'}
            </h2>
            <p className="text-xs text-neutral-500">
              {isForgotMode ? 'Recevez un code de réinitialisation' : 'Accédez à votre espace ArtisanPro'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-200/60 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Email ou numéro de téléphone
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Entrez votre email ou numéro"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]"
                />
              </div>
            </div>

            {/* Mode selection toggle when not in forgot password mode */}
            {!isForgotMode && (
              <div className="flex rounded-xl bg-neutral-100 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setAuthMode('password'); setErrorMessage(''); }}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    authMode === 'password'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Mot de passe
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('code'); setErrorMessage(''); }}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    authMode === 'code'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Code reçu par e-mail
                </button>
              </div>
            )}

            {/* Password */}
            {!isForgotMode && authMode === 'password' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-700">
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push('/mot-de-passe-oublie' + (email.trim() ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : ''));
                    }}
                    className="text-xs text-[#FF6B00] hover:underline cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-3 text-neutral-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-60 text-white font-bold text-sm shadow-md shadow-[#FF6B00]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>
                  {isForgotMode
                    ? 'Envoyer le code'
                    : authMode === 'code'
                    ? 'RECEVOIR MON CODE (EMAIL)'
                    : 'SE CONNECTER'}
                </span>
              )}
            </button>

              {/* Normal clean footer link with no admin code exposed */}
              <div className="pt-2 text-center border-t border-neutral-100">
                <p className="text-xs text-neutral-500">
                  Pas encore de compte ?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToRegister}
                    className="font-bold text-[#FF6B00] hover:underline cursor-pointer"
                  >
                    S'inscrire
                  </button>
                </p>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
};
