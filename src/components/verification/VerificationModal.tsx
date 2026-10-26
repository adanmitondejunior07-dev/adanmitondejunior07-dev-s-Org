import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Plus, 
  Eye, 
  ArrowLeft, 
  Award, 
  IdCard, 
  User, 
  Building2, 
  FileText, 
  Check, 
  Sparkles,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ArtisanVerificationRequest, VerificationStatus } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { compressImageFile } from '../../lib/mediaCompressor';

interface VerificationModalProps {
  onClose: () => void;
  onOpenAdmin?: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({ onClose, onOpenAdmin }) => {
  const { user, profile, isAdmin } = useAuth();
  const userId = user?.id || 'me';

  const [loading, setLoading] = useState(true);
  const [existingRequest, setExistingRequest] = useState<ArtisanVerificationRequest | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form Fields
  const [cniPhoto, setCniPhoto] = useState('');
  const [selfiePhoto, setSelfiePhoto] = useState('');
  const [atelierPhoto, setAtelierPhoto] = useState('');
  const [diplomePhoto, setDiplomePhoto] = useState('');
  const [cniNumber, setCniNumber] = useState('');
  const [experience, setExperience] = useState(profile?.bio || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Input refs
  const cniRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const atelierRef = useRef<HTMLInputElement>(null);
  const diplomeRef = useRef<HTMLInputElement>(null);

  // Load existing request on mount
  useEffect(() => {
    let isMounted = true;
    const fetchDossier = async () => {
      try {
        const req = await dataStore.getVerificationRequestForUser(userId);
        if (isMounted) {
          setExistingRequest(req);
          if (!req || req.status === 'rejected') {
            setShowForm(true);
          } else {
            setShowForm(false);
          }
        }
      } catch (err) {
        console.warn('Error fetching verification request:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDossier();
    return () => { isMounted = false; };
  }, [userId]);

  const handlePickFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, 800, 0.85);
      if (compressed) {
        setter(compressed);
      }
    } catch {
      setErrorMsg('Erreur lors du traitement de l\'image.');
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!cniPhoto || !selfiePhoto || !atelierPhoto || !diplomePhoto) {
      setErrorMsg('Les 4 pièces justificatives sont obligatoires pour soumettre votre dossier.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Sauvegarde sécurisée des 4 pièces justificatives dans le stockage privé
      const [cniRes, selfieRes, atelierRes, diplomeRes] = await Promise.all([
        dataStore.uploadKycDocument(cniPhoto, 'cni', userId, 'cni.jpg'),
        dataStore.uploadKycDocument(selfiePhoto, 'selfie', userId, 'selfie.jpg'),
        dataStore.uploadKycDocument(atelierPhoto, 'atelier', userId, 'atelier.jpg'),
        dataStore.uploadKycDocument(diplomePhoto, 'diplome', userId, 'diplome.jpg')
      ]);

      const newDossier = await dataStore.submitVerificationRequest({
        artisan_id: userId,
        artisan_name: profile?.full_name || user?.user_metadata?.full_name || 'Artisan',
        artisan_email: profile?.email || user?.email || '',
        metier: profile?.metier || 'Artisan Professionnel',
        ville: profile?.ville || 'Abidjan',
        pays: profile?.pays || 'Afrique',
        cni_url: cniRes.url,
        selfie_url: selfieRes.url,
        atelier_url: atelierRes.url,
        diplome_url: diplomeRes.url,
        cni_number: cniNumber.trim() || undefined,
        notes: notes.trim() || (experience.trim() ? `Expérience : ${experience.trim()}` : undefined)
      });

      setExistingRequest(newDossier);
      setShowForm(false);
      setSuccessMsg('Votre dossier a été transmis avec succès. Vous recevrez une notification à chaque étape de son examen.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la soumission du dossier.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine current effective status
  const currentStatus: VerificationStatus = 
    profile?.is_verified && profile?.badge_bleu
      ? 'verified'
      : (existingRequest?.status || 'unverified');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-[#FF6B1A] flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-neutral-900 leading-tight">
                Vérification du Profil
              </h3>
              <p className="text-[11px] text-neutral-500">
                Certification officielle & Badge Bleu ArtisanPro
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

        {/* Hidden File Inputs */}
        <input ref={cniRef} type="file" accept="image/*" onChange={(e) => handlePickFile(e, setCniPhoto)} className="hidden" />
        <input ref={selfieRef} type="file" accept="image/*" onChange={(e) => handlePickFile(e, setSelfiePhoto)} className="hidden" />
        <input ref={atelierRef} type="file" accept="image/*" onChange={(e) => handlePickFile(e, setAtelierPhoto)} className="hidden" />
        <input ref={diplomeRef} type="file" accept="image/*" onChange={(e) => handlePickFile(e, setDiplomePhoto)} className="hidden" />

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Notifications / Toast */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {/* STATUS BANNER */}
          {currentStatus === 'verified' && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 font-extrabold text-[10px] uppercase tracking-wider inline-block mb-1">
                  Certifié Officiel
                </span>
                <h4 className="font-extrabold text-neutral-900 text-base">
                  Profil Vérifié & Badge Bleu Actif ✅
                </h4>
                <p className="text-xs text-neutral-600 mt-1 max-w-sm mx-auto leading-relaxed">
                  Votre identité et vos compétences professionnelles ont été vérifiées et validées par la direction d'ArtisanPro Afrique.
                </p>
              </div>

              {existingRequest?.reviewed_at && (
                <p className="text-[11px] text-emerald-700 font-medium">
                  Validé le {new Date(existingRequest.reviewed_at).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          )}

          {currentStatus === 'pending' && (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-xl shadow-xs">
                ⏳
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-extrabold text-[10px] uppercase tracking-wider inline-block mb-1">
                  En attente
                </span>
                <h4 className="font-extrabold text-neutral-900 text-base">
                  Dossier Envoyé & Reçu
                </h4>
                <p className="text-xs text-neutral-600 mt-1 max-w-sm mx-auto leading-relaxed">
                  Vos 4 pièces justificatives ont bien été réceptionnées par nos services sécurisés. Votre dossier est en file d'attente pour examen.
                </p>
              </div>

              {existingRequest?.created_at && (
                <p className="text-[11px] text-amber-800 font-medium">
                  Déposé le {new Date(existingRequest.created_at).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          )}

          {currentStatus === 'in_review' && (
            <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mx-auto text-xl shadow-xs">
                🔍
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-200/80 text-blue-900 font-extrabold text-[10px] uppercase tracking-wider inline-block mb-1">
                  En cours
                </span>
                <h4 className="font-extrabold text-neutral-900 text-base">
                  Dossier en Cours d'Examen
                </h4>
                <p className="text-xs text-neutral-600 mt-1 max-w-sm mx-auto leading-relaxed">
                  Un administrateur certifié est en train d'examiner et d'authentifier vos pièces justificatives. Une notification vous sera envoyée dès la prise de décision.
                </p>
              </div>
            </div>
          )}

          {currentStatus === 'rejected' && (
            <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto text-xl shadow-xs">
                ❌
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-red-200 text-red-900 font-extrabold text-[10px] uppercase tracking-wider inline-block mb-1">
                  Dossier non validé
                </span>
                <h4 className="font-extrabold text-neutral-900 text-base">
                  Décision : Dossier Refusé
                </h4>
                <div className="mt-2 p-3 rounded-xl bg-white/80 border border-red-200 text-left">
                  <span className="text-[11px] font-bold text-red-900 block mb-0.5">Motif officiel du refus :</span>
                  <p className="text-xs text-red-800 italic">
                    "{existingRequest?.rejection_reason || 'Pièce justificative illisible ou non conforme aux critères d\'authenticité.'}"
                  </p>
                </div>
              </div>

              {!showForm && (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Corriger et renvoyer mon dossier</span>
                </button>
              )}
            </div>
          )}

          {/* CHRONOLOGIE DE SUIVI */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
            <h5 className="font-extrabold text-xs text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#FF6B1A]" />
              <span>Avancement de la démarche</span>
            </h5>

            <div className="space-y-2.5 text-xs">
              {/* Étape 1 */}
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                  currentStatus !== 'unverified' ? 'bg-emerald-600 text-white' : 'bg-neutral-300 text-neutral-700'
                }`}>
                  {currentStatus !== 'unverified' ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '1'}
                </div>
                <div className="flex-1">
                  <span className="font-bold text-neutral-900">1. Dépôt des 4 pièces justificatives</span>
                  <p className="text-[11px] text-neutral-500">CNI, photo selfie, atelier et attestation/diplôme</p>
                </div>
              </div>

              {/* Étape 2 */}
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                  currentStatus === 'in_review' || currentStatus === 'verified' ? 'bg-emerald-600 text-white' :
                  currentStatus === 'pending' ? 'bg-amber-500 text-white' : 'bg-neutral-200 text-neutral-500'
                }`}>
                  {currentStatus === 'in_review' || currentStatus === 'verified' ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '2'}
                </div>
                <div className="flex-1">
                  <span className="font-bold text-neutral-900">2. Examen rigoureux par l'Administration</span>
                  <p className="text-[11px] text-neutral-500">Contrôle de l'authenticité et conformité des pièces</p>
                </div>
              </div>

              {/* Étape 3 */}
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                  currentStatus === 'verified' ? 'bg-emerald-600 text-white' :
                  currentStatus === 'rejected' ? 'bg-red-500 text-white' : 'bg-neutral-200 text-neutral-500'
                }`}>
                  {currentStatus === 'verified' ? <Check className="w-3.5 h-3.5 stroke-[3]" /> :
                   currentStatus === 'rejected' ? '✕' : '3'}
                </div>
                <div className="flex-1">
                  <span className="font-bold text-neutral-900">3. Décision administrative & Attribution Badge Bleu</span>
                  <p className="text-[11px] text-neutral-500">Seule une décision autorisée attribue la vérification</p>
                </div>
              </div>
            </div>
          </div>

          {/* CONSULTATION DES PIÈCES DÉJÀ DÉPOSÉES (si dossier en cours ou validé) */}
          {existingRequest && !showForm && (
            <div className="space-y-2 pt-2">
              <span className="font-bold text-xs text-neutral-700 block">
                Pièces justificatives de votre dossier :
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* CNI */}
                <button
                  type="button"
                  onClick={() => setPreviewImage({ url: existingRequest.cni_url, title: 'CNI / Passeport' })}
                  className="p-2 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-center group cursor-pointer"
                >
                  <div className="h-16 rounded-lg overflow-hidden bg-white mb-1.5 border border-neutral-200">
                    <img src={existingRequest.cni_url} alt="CNI" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <span className="text-[10px] font-bold text-neutral-700 block truncate">1. CNI / Passeport</span>
                </button>

                {/* Selfie */}
                <button
                  type="button"
                  onClick={() => setPreviewImage({ url: existingRequest.selfie_url, title: 'Photo de vous' })}
                  className="p-2 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-center group cursor-pointer"
                >
                  <div className="h-16 rounded-lg overflow-hidden bg-white mb-1.5 border border-neutral-200">
                    <img src={existingRequest.selfie_url} alt="Selfie" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <span className="text-[10px] font-bold text-neutral-700 block truncate">2. Photo portrait</span>
                </button>

                {/* Atelier */}
                <button
                  type="button"
                  onClick={() => setPreviewImage({ url: existingRequest.atelier_url, title: 'Atelier / Lieu de travail' })}
                  className="p-2 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-center group cursor-pointer"
                >
                  <div className="h-16 rounded-lg overflow-hidden bg-white mb-1.5 border border-neutral-200">
                    <img src={existingRequest.atelier_url} alt="Atelier" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <span className="text-[10px] font-bold text-neutral-700 block truncate">3. Atelier / Outils</span>
                </button>

                {/* Diplôme */}
                <button
                  type="button"
                  onClick={() => setPreviewImage({ url: existingRequest.diplome_url, title: 'Attestation / Diplôme' })}
                  className="p-2 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-center group cursor-pointer"
                >
                  <div className="h-16 rounded-lg overflow-hidden bg-white mb-1.5 border border-neutral-200">
                    <img src={existingRequest.diplome_url} alt="Diplome" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <span className="text-[10px] font-bold text-neutral-700 block truncate">4. Attestation</span>
                </button>
              </div>
            </div>
          )}

          {/* FORMULAIRE DE DÉPÔT SÉCURISÉ */}
          {showForm && currentStatus !== 'verified' && (
            <form onSubmit={handleSubmit} className="space-y-3.5 pt-2 border-t border-neutral-100">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-neutral-900 text-sm">
                  {existingRequest?.status === 'rejected' ? 'Nouveau dossier corrigé' : 'Dépôt des 4 pièces justificatives'}
                </h4>
                {existingRequest?.status === 'rejected' && (
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-xs text-neutral-500 hover:underline"
                  >
                    Annuler
                  </button>
                )}
              </div>

              {/* GRILLE DES 4 PIÈCES OBLIGATOIRES */}
              <div className="space-y-2.5">
                {/* 1. CNI */}
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-xs text-neutral-800 flex items-center gap-1.5">
                      <IdCard className="w-4 h-4 text-[#FF6B1A]" />
                      <span>1. Pièce d'identité (CNI / Passeport) *</span>
                    </label>
                    {cniPhoto && <span className="text-emerald-600 font-bold text-[10px]">Prête ✓</span>}
                  </div>
                  {cniPhoto ? (
                    <div className="relative h-24 rounded-xl overflow-hidden border border-neutral-300">
                      <img src={cniPhoto} alt="CNI" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setCniPhoto('')}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/70 text-white rounded-full hover:bg-black"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => cniRef.current?.click()}
                      className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-orange-50 border-2 border-dashed border-orange-300 text-[#FF6B1A] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Choisir photo CNI / Passeport (Galerie)</span>
                    </button>
                  )}
                </div>

                {/* 2. Selfie portrait */}
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-xs text-neutral-800 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-[#FF6B1A]" />
                      <span>2. Photo portrait / Selfie net de vous *</span>
                    </label>
                    {selfiePhoto && <span className="text-emerald-600 font-bold text-[10px]">Prête ✓</span>}
                  </div>
                  {selfiePhoto ? (
                    <div className="relative h-24 rounded-xl overflow-hidden border border-neutral-300">
                      <img src={selfiePhoto} alt="Selfie" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setSelfiePhoto('')}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/70 text-white rounded-full hover:bg-black"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => selfieRef.current?.click()}
                      className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-orange-50 border-2 border-dashed border-orange-300 text-[#FF6B1A] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Choisir photo portrait de vous (Galerie)</span>
                    </button>
                  )}
                </div>

                {/* 3. Atelier */}
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-xs text-neutral-800 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#FF6B1A]" />
                      <span>3. Photo de l'atelier / lieu de travail / outillage *</span>
                    </label>
                    {atelierPhoto && <span className="text-emerald-600 font-bold text-[10px]">Prête ✓</span>}
                  </div>
                  {atelierPhoto ? (
                    <div className="relative h-24 rounded-xl overflow-hidden border border-neutral-300">
                      <img src={atelierPhoto} alt="Atelier" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setAtelierPhoto('')}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/70 text-white rounded-full hover:bg-black"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => atelierRef.current?.click()}
                      className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-orange-50 border-2 border-dashed border-orange-300 text-[#FF6B1A] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Choisir photo de votre atelier (Galerie)</span>
                    </button>
                  )}
                </div>

                {/* 4. Diplôme */}
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-xs text-neutral-800 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-[#FF6B1A]" />
                      <span>4. Attestation professionnelle ou diplôme *</span>
                    </label>
                    {diplomePhoto && <span className="text-emerald-600 font-bold text-[10px]">Prête ✓</span>}
                  </div>
                  {diplomePhoto ? (
                    <div className="relative h-24 rounded-xl overflow-hidden border border-neutral-300">
                      <img src={diplomePhoto} alt="Diplome" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setDiplomePhoto('')}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/70 text-white rounded-full hover:bg-black"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => diplomeRef.current?.click()}
                      className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-orange-50 border-2 border-dashed border-orange-300 text-[#FF6B1A] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Choisir attestation / diplôme (Galerie)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Numéro de CNI & Expérience */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Numéro CNI / Passeport (facultatif)
                  </label>
                  <input
                    type="text"
                    value={cniNumber}
                    onChange={(e) => setCniNumber(e.target.value)}
                    placeholder="Ex: CI-002938192"
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Années de pratique
                  </label>
                  <input
                    type="text"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="Ex: 5 ans"
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white"
                  />
                </div>
              </div>

              {/* Note / Message */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                  Précisions complémentaires pour l'Administrateur (facultatif)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Titulaire d'un CAP plomberie et artisan enregistré..."
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !cniPhoto || !selfiePhoto || !atelierPhoto || !diplomePhoto}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#FF6B1A] hover:bg-[#e05e00] disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-[#FF6B1A]/25 cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Envoi sécurisé du dossier...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Transmettre mon dossier à l'Administration</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* SECRET ADMIN LINK */}
          {isAdmin && onOpenAdmin && (
            <div className="pt-2 text-center border-t border-neutral-100">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdmin();
                }}
                className="text-[11px] font-bold text-amber-700 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <span>Accéder au Tableau d'Administration KYC</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FULLSCREEN IMAGE PREVIEW */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] w-full flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-white pb-3 px-2">
              <span className="font-bold text-sm">{previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}
    </div>
  );
};
