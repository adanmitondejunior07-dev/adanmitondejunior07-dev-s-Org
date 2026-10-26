import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ShieldCheck, 
  FileText, 
  DollarSign, 
  HelpCircle, 
  Info, 
  AlertTriangle, 
  Trash2, 
  Bell, 
  CheckCircle, 
  User, 
  ArrowLeft, 
  ChevronRight,
  Send,
  Upload,
  Lock,
  LogOut,
  Plus,
  Hammer,
  Crown,
  Share2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AppNotification, ArtisanVerificationRequest } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { SubscriptionPlansView } from '../subscription/SubscriptionPlansView';
import { SocialMediaBar } from '../navigation/SocialLinks';

interface SettingsModalProps {
  onClose: () => void;
  initialSection?: SettingsSection;
}

type SettingsSection = 
  | 'menu'
  | 'account'
  | 'subscriptions'
  | 'privacy'
  | 'cgu'
  | 'monetization'
  | 'verification'
  | 'how_it_works'
  | 'about'
  | 'report_problem'
  | 'delete_account'
  | 'notifications';

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, initialSection = 'menu' }) => {
  const { profile, user, deleteAccount, updateProfile, signOut, isAdmin } = useAuth();
  const [currentSection, setCurrentSection] = useState<SettingsSection>(initialSection);

  const isUserAdmin = 
    isAdmin || 
    profile?.role === 'admin' || 
    (profile?.email?.toLowerCase().trim() === 'adanmitondejunior07@gmail.com');

  useEffect(() => {
    if (initialSection) {
      setCurrentSection(initialSection);
    }
  }, [initialSection]);

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [onlyUnread, setOnlyUnread] = useState(false);

  // Report Problem Form
  const [reportCategory, setReportCategory] = useState('Bug technique');
  const [reportDescription, setReportDescription] = useState('');
  const [reportScreenshot, setReportScreenshot] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Delete Account Form
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Verification request state - 4 Required Pieces
  const [verifCniNumber, setVerifCniNumber] = useState('');
  const [verifExperience, setVerifExperience] = useState('');
  const [verifCniPhoto, setVerifCniPhoto] = useState('');
  const [verifSelfiePhoto, setVerifSelfiePhoto] = useState('');
  const [verifAtelierPhoto, setVerifAtelierPhoto] = useState('');
  const [verifDiplomePhoto, setVerifDiplomePhoto] = useState('');
  const [isSubmittingVerif, setIsSubmittingVerif] = useState(false);
  const [existingVerifRequest, setExistingVerifRequest] = useState<ArtisanVerificationRequest | null>(null);

  // File input refs for the 4 pieces
  const cniFileInputRef = useRef<HTMLInputElement>(null);
  const selfieFileInputRef = useRef<HTMLInputElement>(null);
  const atelierFileInputRef = useRef<HTMLInputElement>(null);
  const diplomeFileInputRef = useRef<HTMLInputElement>(null);

  const userId = user?.id || 'me';

  // Helper to read and compress file to base64 dataUrl
  const handlePickDocument = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let { width, height } = img;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setter(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => setter(result);
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    dataStore.getNotifications(userId).then(notifs => setNotifications(notifs));
    dataStore.getVerificationRequests().then(requests => {
      const myReq = requests.find(r => r.artisan_id === userId || r.artisan_email.toLowerCase() === profile?.email.toLowerCase());
      if (myReq) setExistingVerifRequest(myReq);
    });
  }, [userId, profile]);

  const handleMarkAllRead = async () => {
    await dataStore.markAllNotificationsRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDescription.trim()) return;

    setIsSubmittingReport(true);
    try {
      await dataStore.submitReport({
        user_id: userId,
        user_email: profile?.email || 'anonyme',
        category: reportCategory,
        description: reportDescription.trim(),
        screenshot_url: reportScreenshot.trim() || undefined
      });
      setReportSubmitted(true);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleDeleteAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');

    if (deleteConfirmText !== 'SUPPRIMER') {
      setDeleteError('Vous devez saisir exactement SUPPRIMER en majuscules.');
      return;
    }

    setIsDeleting(true);
    const res = await deleteAccount(deleteConfirmText);
    setIsDeleting(false);

    if (res.error) {
      setDeleteError(res.error);
    } else {
      onClose();
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifCniPhoto || !verifSelfiePhoto || !verifAtelierPhoto || !verifDiplomePhoto) {
      alert('Veuillez fournir l\'ensemble des 4 pièces obligatoires (CNI, Photo de vous, Photo atelier, Attestation/diplôme).');
      return;
    }

    setIsSubmittingVerif(true);
    try {
      const created = await dataStore.submitVerificationRequest({
        artisan_id: userId,
        artisan_name: profile?.full_name || 'Artisan',
        artisan_email: profile?.email || '',
        metier: profile?.metier || 'Artisan',
        ville: profile?.ville || 'Abidjan',
        pays: profile?.pays || 'Afrique',
        cni_url: verifCniPhoto,
        selfie_url: verifSelfiePhoto,
        atelier_url: verifAtelierPhoto,
        diplome_url: verifDiplomePhoto,
        cni_number: verifCniNumber.trim() || undefined,
        notes: verifExperience.trim() || undefined
      });
      setExistingVerifRequest(created);
    } finally {
      setIsSubmittingVerif(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            {currentSection !== 'menu' && (
              <button
                onClick={() => setCurrentSection('menu')}
                className="p-1 -ml-1 text-neutral-600 hover:text-neutral-900 rounded-lg cursor-pointer"
                title="Retour au menu"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h3 className="font-extrabold text-base text-neutral-900 leading-tight">
                {currentSection === 'menu' && 'Paramètres'}
                {currentSection === 'subscriptions' && 'Abonnements Professionnels GeniusPay'}
                {currentSection === 'account' && 'Paramètres du compte'}
                {currentSection === 'privacy' && 'Politique de confidentialité'}
                {currentSection === 'cgu' && 'Conditions d\'utilisation'}
                {currentSection === 'monetization' && 'Conditions de monétisation'}
                {currentSection === 'verification' && 'Vérification Artisan'}
                {currentSection === 'how_it_works' && 'Comment ça marche ?'}
                {currentSection === 'about' && 'À propos d\'ArtisanPro Afrique'}
                {currentSection === 'report_problem' && 'Signaler un problème ou un bug'}
                {currentSection === 'delete_account' && 'Suppression définitive du compte'}
                {currentSection === 'notifications' && 'Centre de notifications'}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-200/60 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 text-xs">
          {/* MENU LIST */}
          {currentSection === 'menu' && (
            <div className="space-y-1">
              {[
                { id: 'subscriptions' as SettingsSection, label: 'Abonnements Professionnels GeniusPay (425F, 900F, 1200F)', icon: Crown },
                { id: 'account' as SettingsSection, label: 'Paramètres du compte', icon: User },
                ...(!isUserAdmin ? [
                  { id: 'verification' as SettingsSection, label: 'Vérification Artisan (Badge Certifié)', icon: ShieldCheck }
                ] : []),
                { id: 'monetization' as SettingsSection, label: 'Conditions de monétisation', icon: DollarSign },
                { id: 'how_it_works' as SettingsSection, label: 'Comment ça marche ?', icon: HelpCircle },
                { id: 'cgu' as SettingsSection, label: 'Conditions Générales d\'Utilisation (CGU)', icon: FileText },
                { id: 'privacy' as SettingsSection, label: 'Politique de Confidentialité', icon: Lock },
                { id: 'report_problem' as SettingsSection, label: 'Signaler un problème / Bug', icon: AlertTriangle },
                { id: 'about' as SettingsSection, label: 'À propos d\'ArtisanPro Afrique', icon: Info },
                { id: 'delete_account' as SettingsSection, label: 'Suppression définitive du compte', icon: Trash2, danger: true }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentSection(item.id)}
                    className={`w-full p-3.5 rounded-2xl flex items-center justify-between transition-colors cursor-pointer text-left ${
                      item.danger
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        item.danger ? 'bg-red-100 text-red-600' : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-xs">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                    </div>
                  </button>
                );
              })}

              {/* Barre discrète réseaux sociaux en bas */}
              <div className="pt-3 border-t border-neutral-100">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                    Nos Réseaux Sociaux
                  </span>
                  <span className="text-[9px] text-[#FF6B00] font-semibold">
                    Rejoignez-nous
                  </span>
                </div>
                <SocialMediaBar variant="icons-only" />
              </div>

              {/* Prominent Logout button in Settings */}
              <div className="pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    signOut();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Se déconnecter</span>
                </button>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {currentSection === 'notifications' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <button
                  onClick={() => setOnlyUnread(!onlyUnread)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                    onlyUnread ? 'bg-[#FF6B00] text-white' : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {onlyUnread ? 'Afficher tout' : 'Non lues uniquement'}
                </button>
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-[#FF6B00] font-bold hover:underline cursor-pointer"
                >
                  Tout marquer comme lu
                </button>
              </div>

              {notifications
                .filter(n => (!onlyUnread || !n.is_read))
                .map(n => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-2xl border transition-colors ${
                      n.is_read
                        ? 'bg-white border-neutral-200 text-neutral-700'
                        : 'bg-orange-50/50 border-orange-200 text-neutral-900 font-medium'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">{n.title}</span>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-neutral-600 text-xs">{n.message}</p>
                  </div>
                ))}
            </div>
          )}

          {/* ACCOUNT SETTINGS */}
          {currentSection === 'account' && (
            <div className="space-y-4">
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/60 space-y-2">
                <h4 className="font-bold text-neutral-900">Identifiants de connexion</h4>
                <p className="text-neutral-600">Email enregistré : <strong>{profile?.email}</strong></p>
                <p className="text-neutral-600">ID unique : <code className="bg-white px-1 py-0.5 rounded-sm border">{profile?.id.slice(0, 12)}...</code></p>
              </div>
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900">
                Pour modifier votre mot de passe, utilisez la fonction <em>Mot de passe oublié</em> sur la page de connexion ou contactez le support.
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    signOut();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Se déconnecter de cette session</span>
                </button>
              </div>
            </div>
          )}

          {/* SUBSCRIPTIONS GENIUSPAY PAGE */}
          {currentSection === 'subscriptions' && (
            <SubscriptionPlansView onClose={onClose} />
          )}

          {/* ARTISAN VERIFICATION (4 PIÈCES OBLIGATOIRES) */}
          {currentSection === 'verification' && (
            <div className="space-y-4">
              {/* Hidden file inputs for the 4 pieces */}
              <input
                ref={cniFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePickDocument(e, setVerifCniPhoto)}
                className="hidden"
              />
              <input
                ref={selfieFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePickDocument(e, setVerifSelfiePhoto)}
                className="hidden"
              />
              <input
                ref={atelierFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePickDocument(e, setVerifAtelierPhoto)}
                className="hidden"
              />
              <input
                ref={diplomeFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePickDocument(e, setVerifDiplomePhoto)}
                className="hidden"
              />

              <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-neutral-800 space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#FF6B00]" />
                  <h4 className="font-bold text-sm text-neutral-900">Certification Officielle & Badge Bleu</h4>
                </div>
                <p className="text-xs text-neutral-700 leading-relaxed">
                  Pour certifier votre profil et garantir la confiance des clients, l'Administration vérifie rigoureusement 4 pièces obligatoires.
                </p>
              </div>

              {/* Status if already verified, pending, or rejected */}
              {profile?.is_verified && profile?.badge_bleu ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="font-extrabold text-emerald-900 text-sm">Compte Certifié & Validé ✅</h4>
                  <p className="text-emerald-800 text-xs leading-relaxed">
                    Félicitations ! Votre profil bénéficie du Badge Bleu officiel vérifié par la direction d'ArtisanPro Afrique.
                  </p>
                </div>
              ) : existingVerifRequest?.status === 'pending' ? (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-lg font-bold">
                    ⏳
                  </div>
                  <h4 className="font-extrabold text-amber-900 text-sm">Dossier en cours d'examen</h4>
                  <p className="text-amber-800 text-xs leading-relaxed">
                    Vos 4 pièces justificatives ont été transmises au Super Administrateur. Examen sous 24h à 48h.
                  </p>
                  <p className="text-[11px] text-amber-700 font-semibold">
                    Déposé le {new Date(existingVerifRequest.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleVerificationSubmit} className="space-y-4">
                  {existingVerifRequest?.status === 'rejected' && (
                    <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs">
                      <p className="font-bold mb-1">❌ Dossier précédent refusé par l'Administrateur :</p>
                      <p className="italic">{existingVerifRequest.rejection_reason || 'Pièces justificatives non conformes.'}</p>
                      <p className="mt-1 font-semibold text-red-900">Veuillez renvoyer les 4 pièces ci-dessous :</p>
                    </div>
                  )}

                  {/* LES 4 PIÈCES OBLIGATOIRES AVEC BOUTON + GALERIE */}
                  <div className="space-y-3">
                    <span className="font-extrabold text-neutral-900 text-xs block">
                      Les 4 pièces à fournir obligatoirement :
                    </span>

                    {/* 1. CNI OU PASSEPORT */}
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-xs text-neutral-800 flex items-center gap-1.5">
                          <span>1. CNI ou Passeport (Photo recto/verso) *</span>
                        </label>
                        {verifCniPhoto && <span className="text-emerald-600 font-bold text-[10px]">Photo prête ✓</span>}
                      </div>

                      {verifCniPhoto ? (
                        <div className="relative h-24 rounded-xl overflow-hidden border border-neutral-300">
                          <img src={verifCniPhoto} alt="CNI" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setVerifCniPhoto('')}
                            className="absolute top-1.5 right-1.5 p-1 bg-black/70 text-white rounded-full hover:bg-black"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => cniFileInputRef.current?.click()}
                          className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-orange-50 border-2 border-dashed border-orange-300 text-[#FF6B00] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Choisir CNI ou Passeport (Galerie)</span>
                        </button>
                      )}
                    </div>

                    {/* 2. PHOTO DE VOUS */}
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-xs text-neutral-800 flex items-center gap-1.5">
                          <span>2. Photo de vous (Portrait / Selfie net) *</span>
                        </label>
                        {verifSelfiePhoto && <span className="text-emerald-600 font-bold text-[10px]">Photo prête ✓</span>}
                      </div>

                      {verifSelfiePhoto ? (
                        <div className="relative h-24 rounded-xl overflow-hidden border border-neutral-300">
                          <img src={verifSelfiePhoto} alt="Selfie" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setVerifSelfiePhoto('')}
                            className="absolute top-1.5 right-1.5 p-1 bg-black/70 text-white rounded-full hover:bg-black"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => selfieFileInputRef.current?.click()}
                          className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-orange-50 border-2 border-dashed border-orange-300 text-[#FF6B00] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Choisir une photo de vous (Galerie)</span>
                        </button>
                      )}
                    </div>

                    {/* 3. PHOTO DE VOTRE ATELIER */}
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-xs text-neutral-800 flex items-center gap-1.5">
                          <span>3. Photo de votre atelier ou lieu de travail *</span>
                        </label>
                        {verifAtelierPhoto && <span className="text-emerald-600 font-bold text-[10px]">Photo prête ✓</span>}
                      </div>

                      {verifAtelierPhoto ? (
                        <div className="relative h-24 rounded-xl overflow-hidden border border-neutral-300">
                          <img src={verifAtelierPhoto} alt="Atelier" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setVerifAtelierPhoto('')}
                            className="absolute top-1.5 right-1.5 p-1 bg-black/70 text-white rounded-full hover:bg-black"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => atelierFileInputRef.current?.click()}
                          className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-orange-50 border-2 border-dashed border-orange-300 text-[#FF6B00] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Choisir la photo de votre atelier (Galerie)</span>
                        </button>
                      )}
                    </div>

                    {/* 4. ATTESTATION DIPLOME OU CERTIFICAT */}
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-xs text-neutral-800 flex items-center gap-1.5">
                          <span>4. Attestation de diplôme / certificat d'expérience *</span>
                        </label>
                        {verifDiplomePhoto && <span className="text-emerald-600 font-bold text-[10px]">Photo prête ✓</span>}
                      </div>

                      {verifDiplomePhoto ? (
                        <div className="relative h-24 rounded-xl overflow-hidden border border-neutral-300">
                          <img src={verifDiplomePhoto} alt="Diplome" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setVerifDiplomePhoto('')}
                            className="absolute top-1.5 right-1.5 p-1 bg-black/70 text-white rounded-full hover:bg-black"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => diplomeFileInputRef.current?.click()}
                          className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-orange-50 border-2 border-dashed border-orange-300 text-[#FF6B00] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Choisir attestation de diplôme (Galerie)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Numéro de pièce & Années d'expérience */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        Numéro CNI / Passeport
                      </label>
                      <input
                        type="text"
                        value={verifCniNumber}
                        onChange={(e) => setVerifCniNumber(e.target.value)}
                        placeholder="Ex: CI-002938192"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        Années d'expérience
                      </label>
                      <input
                        type="text"
                        value={verifExperience}
                        onChange={(e) => setVerifExperience(e.target.value)}
                        placeholder="Ex: 8 ans de pratique"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      isSubmittingVerif ||
                      !verifCniPhoto ||
                      !verifSelfiePhoto ||
                      !verifAtelierPhoto ||
                      !verifDiplomePhoto
                    }
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-40 text-white font-extrabold text-xs shadow-md shadow-[#FF6B00]/25 cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmittingVerif ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>Soumettre les 4 pièces au Super Administrateur</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* MONETIZATION */}
          {currentSection === 'monetization' && (
            <div className="space-y-3 text-neutral-700 leading-relaxed">
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-900 font-semibold">
                ⚠️ AVERTISSEMENT FORMEL : AUCUN REVENU GARANTI.
              </div>
              <p>
                ArtisanPro Afrique est une plateforme de mise en relation entre artisans indépendants et clients.
                La plateforme <strong>ne garantit aucun chiffre d'affaires, ni volume de commandes, ni rémunération automatique</strong>.
              </p>
              <p>
                Chaque artisan négocie librement ses tarifs avec ses clients. Les transactions financières s'effectuent directement entre les parties sans intermédiaire financier frauduleux.
              </p>
            </div>
          )}

          {/* HOW IT WORKS */}
          {currentSection === 'how_it_works' && (
            <div className="space-y-3.5 text-neutral-700 leading-relaxed text-xs">
              <h4 className="font-extrabold text-neutral-900 text-sm">Comment fonctionne ArtisanPro Afrique ?</h4>
              <p>
                ArtisanPro Afrique est une plateforme qui facilite la mise en relation directe entre les artisans professionnels et les clients à travers l’Afrique.
              </p>

              <div className="bg-orange-50/70 p-3.5 rounded-2xl border border-orange-200/80 space-y-2">
                <h5 className="font-bold text-neutral-900 text-xs text-[#FF6B00]">Pour les clients :</h5>
                <ul className="space-y-1 list-disc list-inside text-neutral-700">
                  <li>Créez votre compte ou connectez-vous.</li>
                  <li>Recherchez un artisan selon son métier, sa ville ou son pays.</li>
                  <li>Consultez son profil et ses publications.</li>
                  <li>Contactez-le directement par messagerie pour discuter de vos besoins et obtenir un devis.</li>
                  <li>Choisissez l’artisan qui correspond à vos attentes.</li>
                </ul>
              </div>

              <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200 space-y-2">
                <h5 className="font-bold text-neutral-900 text-xs text-[#FF6B00]">Pour les artisans :</h5>
                <ul className="space-y-1 list-disc list-inside text-neutral-700">
                  <li>Créez votre compte professionnel.</li>
                  <li>Complétez votre profil avec votre métier, votre ville et vos réalisations.</li>
                  <li>Publiez des photos et des vidéos de vos travaux.</li>
                  <li>Échangez directement avec les clients.</li>
                  <li>Développez votre visibilité et votre activité professionnelle.</li>
                </ul>
              </div>

              <p className="font-medium text-neutral-800">
                <strong>Notre objectif :</strong> rapprocher les artisans des clients, valoriser les compétences africaines et favoriser le développement des activités professionnelles.
              </p>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                ⚠️ <strong>ArtisanPro Afrique ne remplace pas votre vigilance :</strong> vérifiez les informations, les prix et les conditions de chaque prestation avant de conclure un accord.
              </div>
            </div>
          )}

          {/* CGU */}
          {currentSection === 'cgu' && (
            <div className="space-y-3.5 text-neutral-700 leading-relaxed text-xs max-h-[70vh] overflow-y-auto pr-1">
              <h4 className="font-extrabold text-neutral-900 text-sm">CONDITIONS GÉNÉRALES D’UTILISATION</h4>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">1. Objet</h5>
                <p>
                  Les présentes conditions définissent les règles d’utilisation de la plateforme ArtisanPro Afrique, destinée à faciliter les échanges entre les artisans et les clients.
                </p>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">2. Inscription</h5>
                <p>
                  Chaque utilisateur doit fournir des informations exactes, à jour et sincères. Il est responsable de la sécurité de son compte et de ses identifiants.
                </p>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">3. Utilisation autorisée</h5>
                <p>
                  Les utilisateurs s’engagent à respecter les autres membres, à publier des contenus légaux et à utiliser la plateforme à des fins légitimes.
                </p>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">4. Comportements interdits</h5>
                <p>
                  Il est interdit de publier des contenus frauduleux, trompeurs, insultants, discriminatoires, menaçants ou portant atteinte aux droits d’autrui. Les arnaques, le harcèlement et l’usurpation d’identité sont également interdits.
                </p>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">5. Responsabilités</h5>
                <p>
                  ArtisanPro Afrique facilite la mise en relation entre les utilisateurs. Chaque artisan et chaque client reste responsable de ses engagements, de ses accords, des prix convenus et de l’exécution des prestations. La plateforme ne garantit pas automatiquement la qualité des travaux ni le paiement des prestations.
                </p>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">6. Abonnements</h5>
                <p>
                  Certains services professionnels et fonctionnalités de monétisation peuvent être soumis à un abonnement. Les prix, la durée, les avantages et les modalités de paiement doivent être présentés avant toute souscription.
                </p>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">7. Suspension du compte</h5>
                <p>
                  En cas de violation des présentes conditions, ArtisanPro Afrique peut prendre des mesures appropriées, notamment limiter ou suspendre un compte, dans le respect des règles applicables.
                </p>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">8. Suppression du compte</h5>
                <p>
                  Chaque utilisateur peut demander la suppression définitive de son compte selon la procédure prévue dans les paramètres de l’application.
                </p>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">9. Modification des conditions</h5>
                <p>
                  Les présentes conditions peuvent être mises à jour. La version applicable doit être consultable dans l’application.
                </p>
              </div>

              <div className="space-y-1 pt-1 border-t border-neutral-200">
                <h5 className="font-bold text-neutral-900">10. Contact</h5>
                <p>
                  Pour toute question concernant ces conditions, contactez : <a href="mailto:artisanproafrique@gmail.com" className="text-[#FF6B00] font-bold underline">artisanproafrique@gmail.com</a>
                </p>
              </div>

              <p className="text-[11px] text-neutral-500 italic pt-1">
                En créant un compte ou en utilisant la plateforme, l’utilisateur reconnaît avoir pris connaissance des présentes conditions.
              </p>
            </div>
          )}

          {/* PRIVACY */}
          {currentSection === 'privacy' && (
            <div className="space-y-3.5 text-neutral-700 leading-relaxed text-xs max-h-[70vh] overflow-y-auto pr-1">
              <h4 className="font-extrabold text-neutral-900 text-sm">POLITIQUE DE CONFIDENTIALITÉ</h4>
              <p>
                ArtisanPro Afrique accorde une importance particulière à la protection des données personnelles de ses utilisateurs.
              </p>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">1. Données collectées</h5>
                <p>Selon les fonctionnalités utilisées, l’application peut collecter :</p>
                <ul className="list-disc list-inside pl-1 space-y-0.5">
                  <li>Nom et prénom.</li>
                  <li>Adresse e-mail ou numéro de téléphone.</li>
                  <li>Pays et ville.</li>
                  <li>Métier et informations du profil professionnel.</li>
                  <li>Photos, vidéos, publications et messages.</li>
                  <li>Informations nécessaires à la sécurité du compte et à son fonctionnement.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">2. Utilisation des données</h5>
                <p>Ces informations peuvent être utilisées pour :</p>
                <ul className="list-disc list-inside pl-1 space-y-0.5">
                  <li>Créer et gérer votre compte.</li>
                  <li>Afficher votre profil et vos publications selon les paramètres de visibilité.</li>
                  <li>Faciliter les échanges entre clients et artisans.</li>
                  <li>Assurer la sécurité et prévenir les abus.</li>
                  <li>Gérer les abonnements et les fonctionnalités associées.</li>
                  <li>Répondre aux demandes d’assistance.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">3. Partage des données</h5>
                <p>
                  Certaines informations de profil et publications peuvent être visibles par les autres utilisateurs selon les fonctionnalités de l’application. Les données ne doivent être communiquées à des prestataires techniques ou à d’autres tiers que dans le cadre nécessaire au service, avec les garanties appropriées et conformément à la législation applicable.
                </p>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">4. Protection des données</h5>
                <p>
                  ArtisanPro Afrique met en œuvre des mesures de sécurité adaptées pour protéger les informations personnelles. Aucun système ne peut toutefois garantir une sécurité absolue.
                </p>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">5. Conservation des données</h5>
                <p>
                  Les données sont conservées pendant la durée nécessaire aux finalités prévues, sous réserve des obligations légales et des besoins légitimes de sécurité.
                </p>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">6. Vos droits</h5>
                <p>
                  Selon la législation applicable, vous pouvez demander l’accès à vos données, leur rectification, leur suppression ou exercer vos autres droits en matière de protection des données.
                </p>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-neutral-900">7. Suppression du compte</h5>
                <p>
                  Vous pouvez demander la suppression de votre compte depuis les paramètres de l’application ou en contactant notre support. Certaines données peuvent devoir être conservées lorsque la loi l’exige.
                </p>
              </div>

              <div className="space-y-1 pt-1 border-t border-neutral-200">
                <h5 className="font-bold text-neutral-900">8. Contact</h5>
                <p>
                  Pour toute question ou demande relative à vos données personnelles, écrivez à : <a href="mailto:artisanproafrique@gmail.com" className="text-[#FF6B00] font-bold underline">artisanproafrique@gmail.com</a>
                </p>
              </div>

              <p className="text-[11px] text-neutral-500 italic pt-1">
                Cette politique correspond aux données réellement collectées, aux services utilisés et aux pratiques effectives de l’application.
              </p>
            </div>
          )}

          {/* ABOUT - À PROPOS D’ARTISANPRO AFRIQUE */}
          {currentSection === 'about' && (
            <div className="space-y-3.5 text-neutral-700 leading-relaxed text-xs max-h-[70vh] overflow-y-auto pr-1">
              <div className="w-12 h-12 rounded-2xl bg-[#FF6B00] text-white flex items-center justify-center mx-auto shadow-md mb-2">
                <Hammer className="w-6 h-6 -rotate-12" />
              </div>
              <h4 className="font-extrabold text-neutral-900 text-sm sm:text-base text-center">
                À PROPOS D’ARTISANPRO AFRIQUE
              </h4>

              <p>
                ArtisanPro Afrique est une initiative dédiée à la valorisation des artisans et au développement des activités professionnelles en Afrique.
              </p>

              <p>
                Notre mission est de faciliter la rencontre entre les artisans et les clients, de permettre aux professionnels de présenter leur savoir-faire et d’offrir aux clients un moyen pratique de découvrir et de contacter des prestataires.
              </p>

              <div className="bg-orange-50/70 p-3.5 rounded-2xl border border-orange-200/80 space-y-2">
                <h5 className="font-bold text-neutral-900 text-xs text-[#FF6B00]">Nos domaines :</h5>
                <ul className="space-y-1 list-disc list-inside text-neutral-700">
                  <li>Couture et mode.</li>
                  <li>Coiffure et beauté.</li>
                  <li>Mécanique et réparation.</li>
                  <li>Maçonnerie et construction.</li>
                  <li>Électricité et plomberie.</li>
                  <li>Menuiserie et autres métiers professionnels.</li>
                </ul>
              </div>

              <p>
                <strong>Notre vision :</strong> construire une plateforme accessible, utile et évolutive pour les artisans et les clients des pays africains.
              </p>

              <p className="font-medium text-neutral-800">
                Nous croyons au talent africain, au travail bien fait et aux opportunités offertes par le numérique.
              </p>

              <div className="p-3 rounded-2xl bg-gradient-to-r from-orange-500 to-[#FF6B00] text-white text-center font-extrabold text-xs shadow-xs">
                ArtisanPro Afrique — L’Afrique qui travaille.
              </div>

              <div className="pt-2 border-t border-neutral-200 space-y-1 text-center">
                <p>
                  Contact : <a href="mailto:artisanproafrique@gmail.com" className="text-[#FF6B00] font-bold underline">artisanproafrique@gmail.com</a>
                </p>
                <p className="text-[11px] text-neutral-500 font-semibold">
                  © Fondé par A.G GERAUD.
                </p>
              </div>
            </div>
          )}

          {/* REPORT PROBLEM - SIGNALER UN PROBLÈME OU UN BUG */}
          {currentSection === 'report_problem' && (
            <div className="space-y-4 text-xs leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-3 text-neutral-700">
                <h4 className="font-extrabold text-neutral-900 text-sm sm:text-base">
                  SIGNALER UN PROBLÈME OU UN BUG
                </h4>

                <p>
                  Vous rencontrez un problème sur ArtisanPro Afrique ? Aidez-nous à améliorer l’application en nous signalant les difficultés rencontrées.
                </p>

                <div className="bg-orange-50/60 p-3.5 rounded-2xl border border-orange-200/70 space-y-2">
                  <h5 className="font-bold text-neutral-900 text-xs text-[#FF6B00]">
                    Comment effectuer un signalement ?
                  </h5>
                  <ol className="space-y-1 list-decimal list-inside text-neutral-700">
                    <li>Décrivez clairement le problème.</li>
                    <li>Indiquez la page ou la fonctionnalité concernée.</li>
                    <li>Précisez les étapes qui provoquent le problème.</li>
                    <li>Ajoutez, si possible, une capture d’écran.</li>
                  </ol>
                </div>

                <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200 space-y-2">
                  <h5 className="font-bold text-neutral-900 text-xs">Exemples de problèmes :</h5>
                  <ul className="space-y-1 list-disc list-inside text-neutral-600">
                    <li>Impossible de se connecter ou de créer un compte.</li>
                    <li>Code de vérification non reçu.</li>
                    <li>Messages qui ne s’envoient pas correctement.</li>
                    <li>Publication ou photo qui disparaît.</li>
                    <li>Problème de profil ou d’abonnement.</li>
                    <li>Application bloquée ou trop lente.</li>
                  </ul>
                </div>

                <div className="p-3 bg-neutral-100 rounded-2xl space-y-1 text-neutral-800">
                  <p>
                    <strong>Contact support :</strong>{' '}
                    <a href="mailto:artisanproafrique@gmail.com?subject=Signalement%20de%20probl%C3%A8me%20%E2%80%93%20ArtisanPro%20Afrique" className="text-[#FF6B00] font-bold underline">
                      artisanproafrique@gmail.com
                    </a>
                  </p>
                  <p className="text-[11px] text-neutral-600">
                    <strong>Objet conseillé :</strong> Signalement de problème – ArtisanPro Afrique
                  </p>
                </div>

                <p className="font-medium text-neutral-800">
                  Merci de contribuer à l’amélioration de notre plateforme. Nous examinerons votre signalement dans la mesure de nos possibilités.
                </p>

                <div className="p-3 bg-red-50 rounded-2xl border border-red-200 text-red-900 text-[11px] font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>Ne communiquez jamais votre mot de passe ni vos codes de vérification.</span>
                </div>
              </div>

              {/* Direct In-App Reporting Form */}
              <div className="pt-2 border-t border-neutral-200 space-y-3">
                <h5 className="font-bold text-neutral-900 text-xs flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Formulaire de signalement direct</span>
                </h5>

                {reportSubmitted ? (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
                    <CheckCircle className="w-7 h-7 text-emerald-600 mx-auto" />
                    <h5 className="font-bold text-emerald-900 text-xs">Signalement Enregistré</h5>
                    <p className="text-emerald-700 text-[11px]">
                      Votre message a été transmis à l'équipe. Merci pour votre aide !
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setReportSubmitted(false);
                        setReportDescription('');
                      }}
                      className="py-1.5 px-3.5 rounded-xl bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Nouveau signalement
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleReportSubmit} className="space-y-3 bg-white p-3.5 rounded-2xl border border-neutral-200">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1 text-[11px]">
                        Fonctionnalité concernée *
                      </label>
                      <select
                        value={reportCategory}
                        onChange={(e) => setReportCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white cursor-pointer"
                      >
                        <option value="Connexion / Inscription">Connexion / Inscription / Code OTP</option>
                        <option value="Messagerie">Messages / Discussion</option>
                        <option value="Publication ou photo">Publication ou photo qui disparaît</option>
                        <option value="Profil / Vérification">Profil / Vérification de compte</option>
                        <option value="Bug technique / lenteur">Application bloquée ou trop lente</option>
                        <option value="Autre">Autre difficulté</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1 text-[11px]">
                        Description précise des étapes et du problème *
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                        placeholder="1. Décrivez clairement ce qui s'est produit&#10;2. Précisez la page et les étapes qui provoquent le problème..."
                        className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs resize-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1 text-[11px]">
                        Lien ou capture d'écran (optionnel)
                      </label>
                      <input
                        type="url"
                        value={reportScreenshot}
                        onChange={(e) => setReportScreenshot(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingReport}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-bold text-xs shadow-md shadow-[#FF6B00]/25 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmittingReport ? 'Envoi...' : 'Envoyer mon signalement'}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* DELETE ACCOUNT - SUPPRESSION DÉFINITIVE DU COMPTE */}
          {currentSection === 'delete_account' && (
            <div className="space-y-4 text-xs leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-3 text-neutral-700">
                <h4 className="font-extrabold text-neutral-900 text-sm sm:text-base">
                  SUPPRESSION DÉFINITIVE DU COMPTE
                </h4>

                <p>
                  Vous souhaitez quitter ArtisanPro Afrique ? Vous pouvez demander la suppression définitive de votre compte.
                </p>

                <div className="bg-red-50 p-3.5 rounded-2xl border border-red-200 text-red-950 space-y-2">
                  <h5 className="font-bold text-xs text-red-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Avant de confirmer :</span>
                  </h5>
                  <ul className="space-y-1 list-disc list-inside text-red-900">
                    <li>Vous risquez de perdre l’accès à votre profil et à vos publications.</li>
                    <li>Vos informations de compte et contenus associés seront supprimés conformément à la procédure de suppression et aux obligations légales applicables.</li>
                    <li>Certaines données peuvent être conservées lorsque la loi l’exige ou pour traiter des obligations et litiges en cours.</li>
                    <li>La suppression du compte ne garantit pas automatiquement le remboursement d’un abonnement déjà payé.</li>
                  </ul>
                </div>

                <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200 space-y-2">
                  <h5 className="font-bold text-neutral-900 text-xs">
                    Comment supprimer votre compte ?
                  </h5>
                  <ol className="space-y-1 list-decimal list-inside text-neutral-700">
                    <li>Ouvrez ArtisanPro Afrique.</li>
                    <li>Accédez à votre profil ou aux paramètres.</li>
                    <li>Choisissez « Suppression définitive du compte ».</li>
                    <li>Lisez les informations affichées.</li>
                    <li>Confirmez votre demande après vérification de votre identité si nécessaire.</li>
                  </ol>
                </div>

                <div className="p-3 bg-neutral-100 rounded-2xl space-y-1 text-neutral-800">
                  <p>
                    Si cette option ne fonctionne pas, contactez notre support à l’adresse{' '}
                    <a href="mailto:artisanproafrique@gmail.com?subject=Demande%20de%20suppression%20de%20compte" className="text-[#FF6B00] font-bold underline">
                      artisanproafrique@gmail.com
                    </a>{' '}
                    en indiquant « <strong>Demande de suppression de compte</strong> ».
                  </p>
                  <p className="text-[11px] text-neutral-600">
                    La demande sera traitée selon la procédure effective de l’application et les délais légaux applicables.
                  </p>
                </div>

                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 text-[11px] font-semibold leading-relaxed">
                  ⚠️ <strong>Attention :</strong> cette action est définitive lorsqu’elle a été exécutée. Vous ne pourrez pas récupérer les données supprimées si elles ne peuvent plus être restaurées.
                </div>
              </div>

              {/* Confirmation Form */}
              <div className="pt-2 border-t border-neutral-200 space-y-3">
                <h5 className="font-bold text-neutral-900 text-xs">
                  Confirmation dans l'application :
                </h5>

                {deleteError && (
                  <div className="p-2.5 rounded-xl bg-red-100 text-red-800 font-semibold text-xs">
                    {deleteError}
                  </div>
                )}

                <form onSubmit={handleDeleteAccountSubmit} className="space-y-3 bg-white p-3.5 rounded-2xl border border-red-200">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1 text-[11px]">
                      Pour confirmer, tapez le mot <strong>SUPPRIMER</strong> ci-dessous :
                    </label>
                    <input
                      type="text"
                      required
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="SUPPRIMER"
                      className="w-full px-3 py-2 rounded-xl border border-red-300 text-xs font-bold text-red-600 focus:outline-hidden focus:border-red-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isDeleting || deleteConfirmText !== 'SUPPRIMER'}
                    className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeleting ? 'Suppression en cours...' : 'Confirmer et supprimer définitivement mon compte'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
