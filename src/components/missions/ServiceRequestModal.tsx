import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Navigation,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Clock,
  Shield,
  Upload,
  ArrowRight,
  Radio,
  LocateFixed,
  RefreshCw,
  Info,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../lib/dataStore';
import { InterventionType, ServiceRequest, PlatformSettings } from '../../types';
import { compressImageFile } from '../../lib/mediaCompressor';

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated: (request: ServiceRequest) => void;
  onOpenWallet: () => void;
}

const METIERS_COMMUNS = [
  'Plomberie & Sanitaire',
  'Électricité Bâtiment',
  'Menuiserie & Bois',
  'Mécanique & Climatisation',
  'Couture & Stylisme',
  'Soudure & Métallerie',
  'Maçonnerie & Carrelage',
  'Peinture & Décoration',
  'Serrurerie & Dépannage',
  'Froid & Électroménager',
  'Coiffure & Esthétique',
  'Vitrerie & Miroiterie'
];

export const ServiceRequestModal: React.FC<ServiceRequestModalProps> = ({
  isOpen,
  onClose,
  onRequestCreated,
  onOpenWallet
}) => {
  const { user, profile } = useAuth();
  const userId = user?.id || profile?.id || 'me';

  const [requestType, setRequestType] = useState<InterventionType>('normal');
  const [metier, setMetier] = useState<string>(METIERS_COMMUNS[0]);
  const [description, setDescription] = useState<string>('');
  const [addressText, setAddressText] = useState<string>(profile?.adresse_magasin || '');
  const [ville, setVille] = useState<string>(profile?.ville || 'Abidjan');
  const [pays, setPays] = useState<string>(profile?.pays || 'Côte d\'Ivoire');
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(10);
  const [photoUrl, setPhotoUrl] = useState<string>('');

  // GPS State
  const [clientLat, setClientLat] = useState<number | null>(null);
  const [clientLng, setClientLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locError, setLocError] = useState<string>('');
  const [locSuccess, setLocSuccess] = useState<boolean>(false);

  // Platform settings (urgency fee)
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'mobile_money'>('wallet');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      dataStore.getPlatformSettings().then(setSettings);
      dataStore.getWallet(userId).then(w => setWalletBalance(w.balance_fcfa));
      // Auto-trigger GPS request if supported
      handleCaptureLocation();
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Géolocalisation non supportée par votre navigateur.');
      return;
    }
    setIsLocating(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setClientLat(pos.coords.latitude);
        setClientLng(pos.coords.longitude);
        setIsLocating(false);
        setLocSuccess(true);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsLocating(false);
        setLocError('Position GPS indisponible. Renseignez votre adresse textuelle ci-dessous.');
        // Set realistic fallback coordinates for Abidjan
        setClientLat(5.3600);
        setClientLng(-4.0083);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressImageFile(file, 800, 0.82);
    setPhotoUrl(dataUrl || '');
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!description.trim()) {
      setErrorMsg('Veuillez décrire brièvement votre besoin.');
      return;
    }
    if (!addressText.trim() && !locSuccess) {
      setErrorMsg('Veuillez préciser votre adresse ou quartier.');
      return;
    }

    const urgencyFee = settings?.urgency_fee_fcfa || 1000;
    const isUrgent = requestType === 'urgent';

    // If urgent, check payment if paying with wallet
    if (isUrgent) {
      if (paymentMethod === 'wallet' && walletBalance < urgencyFee) {
        setErrorMsg(`Solde insuffisant (${walletBalance.toLocaleString('fr-FR')} FCFA). Veuillez recharger votre portefeuille ou choisir Mobile Money.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let isUrgencyPaid = false;
      let urgencyRef = undefined;

      if (isUrgent) {
        // Pay urgency fee from wallet or Mobile Money
        if (paymentMethod === 'wallet') {
          // Debit client
          const payRes = await dataStore.createDepositTransaction(
            userId,
            -urgencyFee,
            'wallet_internal',
            profile?.telephone || '',
            'URG-FEES',
            profile?.full_name
          );
          isUrgencyPaid = true;
          urgencyRef = payRes.transaction.reference;
        } else {
          isUrgencyPaid = true;
          urgencyRef = 'MM-URG-' + Date.now();
        }
      }

      const newRequest = await dataStore.createServiceRequest({
        client_id: userId,
        client_name: profile?.full_name || 'Client ArtisanPro',
        client_phone: profile?.telephone || '',
        client_avatar: profile?.avatar_url || '',
        metier: metier,
        type: requestType,
        urgency_fee_fcfa: isUrgent ? urgencyFee : 0,
        is_urgency_paid: isUrgencyPaid,
        urgency_payment_ref: urgencyRef,
        description: description.trim(),
        photo_url: photoUrl || undefined,
        address_text: addressText.trim() || 'Quartier localisé par GPS',
        pays: pays,
        ville: ville,
        client_lat: clientLat || 5.3600,
        client_lng: clientLng || -4.0083,
        search_radius_km: searchRadiusKm
      });

      onRequestCreated(newRequest);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la création de la demande.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const urgencyFee = settings?.urgency_fee_fcfa || 1000;

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-neutral-100 flex flex-col max-h-[90dvh] overflow-hidden">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-neutral-900 via-neutral-900 to-black text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6B00] text-white flex items-center justify-center shadow-md shadow-[#FF6B00]/30 shrink-0">
              <Navigation className="w-5 h-5 -rotate-12" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Demander un Artisan
                <span className="px-2 py-0.5 rounded-full bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/40 text-[10px] font-bold">
                  GPS Intelligent
                </span>
              </h2>
              <p className="text-xs text-neutral-300">
                Intervention normale gratuite ou dépannage urgent prioritaire
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs pb-8">
          
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. CHOIX NORMAL OU URGENT */}
          <div>
            <label className="block text-xs font-black text-neutral-900 mb-2">
              Choisissez le type d'intervention *
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              
              {/* INTERVENTION NORMALE */}
              <div
                onClick={() => setRequestType('normal')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  requestType === 'normal'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                    : 'border-neutral-200 bg-white hover:bg-neutral-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-extrabold text-xs text-neutral-900">Normale</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                      Gratuit
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 leading-snug">
                    Recherche gratuite d'artisans disponibles sans frais d'urgence. Devis gratuit communiqué avant acceptation.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-neutral-200/60 text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  0 FCFA de frais d'urgence
                </div>
              </div>

              {/* INTERVENTION URGENTE */}
              <div
                onClick={() => setRequestType('urgent')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  requestType === 'urgent'
                    ? 'border-[#FF6B00] bg-orange-50/60 shadow-md shadow-[#FF6B00]/15 ring-2 ring-[#FF6B00]/30'
                    : 'border-neutral-200 bg-white hover:bg-neutral-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-extrabold text-xs text-neutral-900 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-[#FF6B00] fill-[#FF6B00]" />
                      Besoin Urgent
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#FF6B00] text-white text-[9px] font-black uppercase">
                      Prioritaire
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 leading-snug">
                    Recherche immédiate et affectation prioritaire par GPS du meilleur artisan libre dans votre zone.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-orange-200/80 text-[10px] text-[#FF6B00] font-black flex items-center justify-between">
                  <span>Frais d'urgence :</span>
                  <span>{urgencyFee.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>

            </div>
          </div>

          {/* DÉTAIL DES FRAIS SI URGENT */}
          {requestType === 'urgent' && (
            <div className="p-3.5 bg-orange-50/80 border border-orange-200 rounded-2xl space-y-2 text-[11px] text-orange-950">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-[#FF6B00]" />
                  Transparence des frais d'urgence :
                </span>
                <span className="text-sm font-black text-[#FF6B00]">{urgencyFee.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <p className="text-[11px] text-neutral-700 leading-relaxed">
                Les frais d'urgence couvrent la recherche GPS prioritaire et la réservation immédiate de l'artisan. Le prix des pièces et de la main d'œuvre fera l'objet d'un devis séparé par l'artisan.
              </p>

              {/* Mode de règlement des frais d'urgence */}
              <div className="pt-2 border-t border-orange-200 flex items-center justify-between gap-2">
                <span className="font-bold">Régler les frais via :</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'wallet'
                        ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                        : 'bg-white text-neutral-700 border-neutral-300'
                    }`}
                  >
                    Portefeuille ({walletBalance.toLocaleString('fr-FR')} F)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mobile_money')}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'mobile_money'
                        ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                        : 'bg-white text-neutral-700 border-neutral-300'
                    }`}
                  >
                    Mobile Money
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. CHOIX DU MÉTIER */}
          <div>
            <label className="block text-xs font-bold text-neutral-800 mb-1">
              Métier recherché *
            </label>
            <select
              value={metier}
              onChange={(e) => setMetier(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-800 cursor-pointer focus:outline-hidden focus:border-[#FF6B00]"
            >
              {METIERS_COMMUNS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* 3. GÉOLOCALISATION GPS CLIENT */}
          <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#FF6B00]" />
                Position GPS du Client
              </span>
              <button
                type="button"
                onClick={handleCaptureLocation}
                disabled={isLocating}
                className="px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white text-[10px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                <LocateFixed className="w-3 h-3" />
                <span>{isLocating ? 'Localisation...' : 'Actualiser ma position GPS'}</span>
              </button>
            </div>

            {clientLat && clientLng ? (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span>Position détectée : {clientLat.toFixed(4)}, {clientLng.toFixed(4)} ({ville})</span>
              </div>
            ) : (
              <p className="text-[11px] text-neutral-500">
                Autorisez la géolocalisation pour que l'algorithme calcule les artisans les plus proches de vous.
              </p>
            )}
            {locError && <p className="text-[10px] text-amber-700">{locError}</p>}
          </div>

          {/* 4. ADRESSE ET VILLE */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Ville *
              </label>
              <input
                type="text"
                required
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                placeholder="Ex: Abidjan"
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Rayon de recherche
              </label>
              <select
                value={searchRadiusKm}
                onChange={(e) => setSearchRadiusKm(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-800 cursor-pointer focus:outline-hidden"
              >
                <option value={5}>5 km (Très proche)</option>
                <option value={10}>10 km (Standard)</option>
                <option value={20}>20 km (Élargi)</option>
                <option value={30}>30 km (Maximal)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Adresse précise, quartier ou repère *
            </label>
            <input
              type="text"
              required
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              placeholder="Ex: Cocody Angré 8ème tranche, après la pharmacie des Grâces"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
            />
          </div>

          {/* 5. DESCRIPTION DU PROBLÈME */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Description de la panne ou du travail à réaliser *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Fuite d'eau importante sous l'évier de la cuisine, tuyau percé nécessitant une réparation immédiate..."
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00] leading-relaxed"
            />
          </div>

          {/* 6. PHOTO OPTIONNELLE */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Photo du travail / de la panne (optionnel)
            </label>
            <div className="flex items-center gap-2">
              <label className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Ajouter une photo</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
              {photoUrl && (
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-neutral-200">
                  <img src={photoUrl} alt="Panne" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 px-4 rounded-2xl text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 ${
                requestType === 'urgent'
                  ? 'bg-[#FF6B00] hover:bg-[#e05e00] shadow-[#FF6B00]/30'
                  : 'bg-neutral-900 hover:bg-neutral-800 shadow-neutral-900/20'
              }`}
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  <span>
                    {requestType === 'urgent'
                      ? `Lancer la recherche prioritaire (${urgencyFee.toLocaleString('fr-FR')} FCFA)`
                      : 'Lancer la recherche gratuite d\'un artisan'}
                  </span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
