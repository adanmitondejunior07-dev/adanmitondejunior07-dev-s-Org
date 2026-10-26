import React, { useState, useRef } from 'react';
import { X, UserCheck, Wrench, Lock, Mail, Phone, MapPin, AlertCircle, CheckCircle, ArrowLeft, Eye, EyeOff, Sparkles, Plus, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { METIERS_LIST, PAYS_AFRIQUE, VILLES_PAR_PAYS } from '../../lib/supabase';
import { compressImageFile } from '../../lib/mediaCompressor';

interface RegisterModalProps {
  onClose: () => void;
  onSwitchToLogin: () => void;
  onRedirectToVerify?: (email: string) => void;
  initialRole?: 'client' | 'artisan';
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  onClose,
  onSwitchToLogin,
  onRedirectToVerify,
  initialRole = 'client'
}) => {
  const { signUpClient, signUpArtisan } = useAuth();
  const [selectedRole, setSelectedRole] = useState<'client' | 'artisan' | null>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ show: boolean; needsConfirm?: boolean }>({ show: false });

  // Form Fields
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pays, setPays] = useState(PAYS_AFRIQUE[0]);
  const [ville, setVille] = useState(VILLES_PAR_PAYS[PAYS_AFRIQUE[0]][0] || 'Abidjan');
  
  // Artisan specific
  const [metier, setMetier] = useState<string>(METIERS_LIST[0]);
  const [autreMetier, setAutreMetier] = useState('');
  const [presentation, setPresentation] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const artisanPhotoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const dataUrl = await compressImageFile(file, 400, 0.85);
    if (dataUrl) setPhotoUrl(dataUrl);
    e.target.value = '';
  };
  
  // Terms Checkbox
  const [cguAccepted, setCguAccepted] = useState(false);

  const handleCountryChange = (newCountry: string) => {
    setPays(newCountry);
    const cities = VILLES_PAR_PAYS[newCountry] || [];
    setVille(cities[0] || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedRole) {
      setErrorMessage('Veuillez sélectionner un type de compte.');
      return;
    }

    if (!nom.trim() || !prenom.trim()) {
      setErrorMessage('Veuillez renseigner votre nom et prénom.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = telephone.trim();

    if (!cleanEmail && !cleanPhone) {
      setErrorMessage('Veuillez renseigner un email ou un numéro de téléphone.');
      return;
    }

    let resolvedEmail = cleanEmail;
    let resolvedPhone = cleanPhone;

    if (!resolvedEmail && resolvedPhone) {
      const digits = resolvedPhone.replace(/[^0-9]/g, '');
      resolvedEmail = `${digits}@${selectedRole || 'client'}.artisanpro.africa`;
    }

    if (password.length < 6) {
      setErrorMessage('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    if (!cguAccepted) {
      setErrorMessage('Vous devez accepter les CGU et la Politique de Confidentialité pour continuer.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (selectedRole === 'client') {
        const res = await signUpClient({
          nom,
          prenom,
          email: resolvedEmail,
          telephone: resolvedPhone,
          password,
          pays,
          ville
        });

        if (res.error) {
          setErrorMessage(res.error);
        } else {
          window.history.pushState({}, '', `/verify-code?email=${encodeURIComponent(resolvedEmail)}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
          if (onRedirectToVerify) {
            onRedirectToVerify(resolvedEmail);
          }
          onClose();
          return;
        }
      } else {
        const finalMetier = metier === 'Autre' && autreMetier.trim() ? autreMetier.trim() : metier;
        const res = await signUpArtisan({
          nom,
          prenom,
          email: resolvedEmail,
          telephone: resolvedPhone,
          password,
          pays,
          ville,
          metier: finalMetier,
          presentation,
          photoUrl: photoUrl.trim() || undefined
        });

        if (res.error) {
          setErrorMessage(res.error);
        } else {
          window.history.pushState({}, '', `/verify-code?email=${encodeURIComponent(resolvedEmail)}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
          if (onRedirectToVerify) {
            onRedirectToVerify(resolvedEmail);
          }
          onClose();
          return;
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Top Header */}
        <div className="px-6 pt-5 pb-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            {selectedRole && (
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="p-1 -ml-1 text-neutral-500 hover:text-neutral-800 rounded-lg cursor-pointer"
                title="Retour au choix du profil"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold text-neutral-900 leading-tight">
                {selectedRole === null ? 'Créer un compte' : selectedRole === 'client' ? 'Compte Client' : 'Compte Artisan Pro'}
              </h2>
              <p className="text-xs text-neutral-500">
                {selectedRole === null ? 'Choisissez votre parcours' : 'Remplissez vos informations'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-200/60 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto">
          {successInfo.show ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold text-neutral-900 mb-2">
                Compte créé avec succès !
              </h3>
              <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
                {successInfo.needsConfirm
                  ? `Un email de confirmation vous a été envoyé à ${email}. Vous pouvez également vous connecter directement.`
                  : 'Bienvenue sur ArtisanPro Afrique ! Votre compte est prêt à l\'emploi.'}
              </p>
              <button
                onClick={() => {
                  onClose();
                  onSwitchToLogin();
                }}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-bold text-base shadow-md cursor-pointer"
              >
                Accéder à la connexion
              </button>
            </div>
          ) : selectedRole === null ? (
            /* STEP 1: CHOICE OF ROLE */
            <div className="space-y-4 py-2">
              <p className="text-sm text-neutral-600 text-center mb-4">
                Vous souhaitez trouver un professionnel ou proposer vos services d'artisan ?
              </p>

              {/* Client Card Choice */}
              <div
                onClick={() => setSelectedRole('client')}
                className="p-5 rounded-2xl border-2 border-neutral-200 hover:border-[#FF6B00] hover:bg-orange-50/30 transition-all cursor-pointer flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-neutral-100 text-neutral-700 group-hover:bg-[#FF6B00] group-hover:text-white transition-colors flex items-center justify-center shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-bold text-neutral-900 text-base">Je suis un Client</h3>
                    <span className="text-xs font-semibold text-[#FF6B00]">Choisir &rarr;</span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Trouvez des artisans qualifiés, demandez des devis et découvrez des réalisations.
                  </p>
                </div>
              </div>

              {/* Artisan Card Choice */}
              <div
                onClick={() => setSelectedRole('artisan')}
                className="p-5 rounded-2xl border-2 border-neutral-200 hover:border-[#FF6B00] hover:bg-orange-50/30 transition-all cursor-pointer flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-neutral-100 text-neutral-700 group-hover:bg-[#FF6B00] group-hover:text-white transition-colors flex items-center justify-center shrink-0">
                  <Wrench className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-bold text-neutral-900 text-base">Je suis un Artisan</h3>
                    <span className="text-xs font-semibold text-[#FF6B00]">Choisir &rarr;</span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Exposez vos travaux, recevez des demandes de clients et développez votre activité.
                  </p>
                </div>
              </div>

              <div className="pt-4 text-center">
                <p className="text-xs text-neutral-500">
                  Déjà un compte ?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="font-bold text-[#FF6B00] hover:underline cursor-pointer"
                  >
                    Se connecter
                  </button>
                </p>
              </div>
            </div>
          ) : (
            /* STEP 2: REGISTRATION FORM */
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Role Indicator Banner */}
              <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-between text-xs text-[#FF6B00] font-semibold">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Inscription : {selectedRole === 'client' ? 'Client' : 'Artisan Professionnel'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedRole(selectedRole === 'client' ? 'artisan' : 'client')}
                  className="text-neutral-600 hover:text-neutral-900 underline font-normal text-[11px] cursor-pointer"
                >
                  Changer
                </button>
              </div>

              {/* Nom & Prénom */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    required
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    placeholder="Moussa"
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    required
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Diallo"
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Adresse Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemple@gmail.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]"
                  />
                </div>
              </div>

              {/* Téléphone / WhatsApp */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Numéro de téléphone / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="Ex: 0708091011"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]"
                  />
                </div>
              </div>

              {/* ARTISAN SPECIFIC: Métier, Présentation, Photo */}
              {selectedRole === 'artisan' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Métier principal *
                    </label>
                    <select
                      value={metier}
                      onChange={(e) => setMetier(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] bg-white cursor-pointer"
                    >
                      {METIERS_LIST.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  {metier === 'Autre' && (
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Précisez votre métier *
                      </label>
                      <input
                        type="text"
                        required
                        value={autreMetier}
                        onChange={(e) => setAutreMetier(e.target.value)}
                        placeholder="Ex: Cordonnier, Tapissier..."
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Présentation / Description de votre atelier
                    </label>
                    <textarea
                      rows={2}
                      value={presentation}
                      onChange={(e) => setPresentation(e.target.value)}
                      placeholder="Décrivez vos compétences, votre expérience et vos spécialités..."
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00] resize-none"
                    />
                  </div>

                  {/* Hidden file input for artisan photo */}
                  <input
                    ref={artisanPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                  />

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Photo de profil / atelier (Optionnel)
                    </label>
                    <div className="flex items-center gap-3">
                      {photoUrl ? (
                        <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-neutral-200 shrink-0">
                          <img src={photoUrl} alt="Aperçu atelier" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setPhotoUrl('')}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => artisanPhotoInputRef.current?.click()}
                        className="flex-1 py-3 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#FF6B00] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>+ Choisir depuis ma galerie</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Pays & Ville */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Pays *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-neutral-400 absolute left-2.5 top-3" />
                    <select
                      value={pays}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className="w-full pl-8 pr-2 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00] bg-white cursor-pointer"
                    >
                      {PAYS_AFRIQUE.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Ville *
                  </label>
                  <input
                    type="text"
                    required
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    placeholder="Ville"
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Mot de passe (min. 6 caractères) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Confirmer le mot de passe *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              {/* Checkbox CGU */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 text-xs text-neutral-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cguAccepted}
                    onChange={(e) => setCguAccepted(e.target.checked)}
                    className="mt-0.5 rounded-sm border-neutral-300 text-[#FF6B00] focus:ring-[#FF6B00]"
                  />
                  <span>
                    J'accepte les <strong className="text-neutral-800">Conditions Générales d'Utilisation</strong> et la <strong className="text-neutral-800">Politique de Confidentialité</strong> d'ArtisanPro Afrique.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-60 text-white font-bold text-sm shadow-md shadow-[#FF6B00]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>
                    {selectedRole === 'client' ? 'Créer mon compte Client' : 'Créer mon compte Artisan'}
                  </span>
                )}
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-neutral-500">
                  Déjà membre ?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="font-bold text-[#FF6B00] hover:underline cursor-pointer"
                  >
                    Se connecter
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
