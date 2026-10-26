import React, { useState, useRef, useEffect } from 'react';
import { 
  Check, 
  Crown, 
  Sparkles, 
  ShieldCheck, 
  ExternalLink, 
  Upload, 
  X, 
  AlertCircle, 
  CheckCircle, 
  Zap, 
  FileCheck, 
  Camera, 
  CreditCard,
  Star
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../lib/dataStore';
import { SubscriptionPlanId, SubscriptionPeriod, SubscriptionPaymentProof } from '../../types';

interface SubscriptionPlansViewProps {
  onClose?: () => void;
}

interface PlanDefinition {
  id: SubscriptionPlanId;
  name: string;
  badge?: {
    text: string;
    bg: string;
    textColor: string;
  };
  monthly: {
    priceFcfa: number;
    priceDisplay: string;
    url: string;
  };
  annual: {
    priceFcfa: number;
    priceDisplay: string;
    oldPriceDisplay?: string;
    savingsText?: string;
    url: string;
  };
  features: string[];
  buttonStyle: 'white' | 'orange' | 'black';
  buttonLabel: string;
}

const PLANS: PlanDefinition[] = [
  {
    id: 'essentiel',
    name: 'ESSENTIEL Standard',
    monthly: {
      priceFcfa: 425,
      priceDisplay: '425 FCFA',
      url: 'https://geniuspay.ci/product/artisan-essentiel-DGIM7t'
    },
    annual: {
      priceFcfa: 4700,
      priceDisplay: '4 700 FCFA',
      oldPriceDisplay: '5 100 FCFA',
      savingsText: 'Économise 400 FCFA',
      url: 'https://geniuspay.ci/product/artisan-essentiel-DGIM7t'
    },
    features: [
      'Profil artisan visible dans l\'annuaire',
      '5 photos de réalisations dans la galerie',
      'Reçoit les demandes de devis et contacts clients'
    ],
    buttonStyle: 'white',
    buttonLabel: 'Choisir Essentiel'
  },
  {
    id: 'pro',
    name: 'PRO Recommandé',
    badge: {
      text: 'RECOMMANDÉ',
      bg: 'bg-[#FF6600]',
      textColor: 'text-white'
    },
    monthly: {
      priceFcfa: 900,
      priceDisplay: '900 FCFA',
      url: 'https://geniuspay.ci/product/abonnement-pro-MsgpAv'
    },
    annual: {
      priceFcfa: 9200,
      priceDisplay: '9 200 FCFA',
      oldPriceDisplay: '10 800 FCFA',
      savingsText: 'Économise 1 600 FCFA',
      url: 'https://geniuspay.ci/product/abonnement-pro-MsgpAv'
    },
    features: [
      'Tous les avantages Essentiel inclus',
      'Badge Pro bleu officiel de confiance',
      '20 photos de réalisations haute définition',
      'Statistiques de vues et clics sur profil',
      'Mise en avant prioritaire dans la recherche'
    ],
    buttonStyle: 'orange',
    buttonLabel: 'Choisir Pro'
  },
  {
    id: 'premium_vip',
    name: 'PREMIUM VIP Exclusif',
    badge: {
      text: 'EXCLUSIF',
      bg: 'bg-neutral-900',
      textColor: 'text-amber-400'
    },
    monthly: {
      priceFcfa: 1200,
      priceDisplay: '1 200 FCFA',
      url: 'https://geniuspay.ci/product/artisan-premium-vip-MsgpAv'
    },
    annual: {
      priceFcfa: 14325,
      priceDisplay: '14 325 FCFA',
      oldPriceDisplay: '14 400 FCFA',
      savingsText: 'Offre VIP annuelle',
      url: 'https://geniuspay.ci/product/artisan-premium-vip-MsgpAv'
    },
    features: [
      'Tous les avantages Pro inclus',
      'Profil prioritaire #1 en tête de liste',
      'Visibilité maximale sur toute l\'application',
      'Campagne publicitaire dédiée Artisan Pro Afrique',
      'Ligne de support technique et assistance VIP'
    ],
    buttonStyle: 'black',
    buttonLabel: 'Choisir Premium VIP'
  }
];

export const SubscriptionPlansView: React.FC<SubscriptionPlansViewProps> = ({ onClose }) => {
  const { user, profile } = useAuth();
  const [period, setPeriod] = useState<SubscriptionPeriod>('mensuel');
  const [selectedPlanForProof, setSelectedPlanForProof] = useState<PlanDefinition>(PLANS[1]);
  const [showProofModal, setShowProofModal] = useState(false);

  // Proof form state
  const [proofImage, setProofImage] = useState<string>('');
  const [proofTransactionRef, setProofTransactionRef] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [proofSubmittedSuccess, setProofSubmittedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Existing user proof
  const [myExistingProof, setMyExistingProof] = useState<SubscriptionPaymentProof | null>(null);

  const proofFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.id) {
      dataStore.getSubscriptionProofs().then(list => {
        const mine = list.find(p => p.artisan_id === user.id);
        if (mine) setMyExistingProof(mine);
      });
    }
  }, [user]);

  // Direct external click handler - Opens GeniusPay directly in a new tab without blocking
  const handleOpenGeniusPay = (plan: PlanDefinition) => {
    const targetUrl = period === 'mensuel' ? plan.monthly.url : plan.annual.url;
    setSelectedPlanForProof(plan);

    // Save intention so user can submit proof easily when returning
    try {
      localStorage.setItem('artisanpro_last_selected_plan', JSON.stringify({
        planId: plan.id,
        planName: plan.name,
        period,
        url: targetUrl
      }));
    } catch {}

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePickProofImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        // Compress lightly
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1000;
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
          setProofImage(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => setProofImage(result);
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!proofImage) {
      setErrorMessage('Veuillez ajouter la capture d\'écran de votre reçu GeniusPay (Wave, OM, MTN, Moov).');
      return;
    }

    if (!user) {
      setErrorMessage('Vous devez être connecté pour envoyer une preuve de paiement.');
      return;
    }

    setIsSubmittingProof(true);

    const planAmount = period === 'mensuel' 
      ? selectedPlanForProof.monthly.priceFcfa 
      : selectedPlanForProof.annual.priceFcfa;

    const productUrl = period === 'mensuel'
      ? selectedPlanForProof.monthly.url
      : selectedPlanForProof.annual.url;

    try {
      const created = await dataStore.submitSubscriptionProof({
        artisan_id: user.id,
        artisan_name: profile?.full_name || 'Artisan',
        artisan_email: profile?.email || user.email || '',
        plan_id: selectedPlanForProof.id,
        plan_name: selectedPlanForProof.name,
        period: period,
        amount_fcfa: planAmount,
        payment_proof_url: proofImage,
        product_url: productUrl,
        transaction_ref: proofTransactionRef.trim() || undefined,
        notes: proofNotes.trim() || undefined
      });

      setMyExistingProof(created);
      setProofSubmittedSuccess(true);
      setTimeout(() => {
        setShowProofModal(false);
        setProofSubmittedSuccess(false);
        setProofImage('');
        setProofTransactionRef('');
        setProofNotes('');
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l\'envoi de la preuve.');
    } finally {
      setIsSubmittingProof(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-3.5 text-neutral-900">
      {/* Hidden file input */}
      <input
        ref={proofFileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePickProofImage}
        className="hidden"
      />

      {/* Top Banner / Hero (compact) */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-[#FF6600] text-[10px] font-extrabold uppercase tracking-wide">
          <Crown className="w-3 h-3 fill-[#FF6600]" />
          <span>Abonnements Pro GeniusPay</span>
        </div>
        <h2 className="text-lg sm:text-xl font-black text-neutral-900 tracking-tight">
          Booste ta visibilité
        </h2>
        <p className="text-[11px] text-neutral-600 max-w-xs mx-auto leading-relaxed">
          Choisis ton forfait, paye par Wave, OM, MTN ou Moov, et active ton Badge Bleu Pro.
        </p>
      </div>

      {/* Active Subscription notice if user is already subscribed */}
      {profile?.subscription_plan && profile?.badge_bleu && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-[11px] space-y-0.5">
            <h4 className="font-extrabold text-emerald-900">
              Abonnement Actif : {profile.subscription_plan.toUpperCase()}
            </h4>
            <p className="text-emerald-800 text-[10px]">
              Badge Bleu Pro & protection activés
              {profile.subscription_expires_at && ` jusqu'au ${new Date(profile.subscription_expires_at).toLocaleDateString('fr-FR')}`}.
            </p>
          </div>
        </div>
      )}

      {/* Pending proof notice */}
      {myExistingProof?.status === 'pending' && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-2.5">
          <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] space-y-0.5">
            <h4 className="font-extrabold text-amber-900">
              Preuve de paiement en cours d'examen
            </h4>
            <p className="text-amber-800 text-[10px]">
              Reçu GeniusPay ({myExistingProof.plan_name} - {myExistingProof.amount_fcfa} FCFA) transmis. Validation sous 24h.
            </p>
          </div>
        </div>
      )}

      {/* 2 ONGLETS EN HAUT : [MENSUEL] [ANNUEL] */}
      <div className="flex justify-center">
        <div className="p-0.5 bg-neutral-100 rounded-xl border border-neutral-200 inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPeriod('mensuel')}
            className={`px-3.5 py-1.5 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
              period === 'mensuel'
                ? 'bg-[#FF6600] text-white shadow-xs shadow-[#FF6600]/25'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            MENSUEL
          </button>

          <button
            type="button"
            onClick={() => setPeriod('annuel')}
            className={`px-3.5 py-1.5 rounded-lg font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1 ${
              period === 'annuel'
                ? 'bg-[#FF6600] text-white shadow-xs shadow-[#FF6600]/25'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <span>ANNUEL</span>
            <span className="px-1 py-0.2 rounded-md bg-emerald-500 text-white text-[8px] font-black uppercase">
              Économie
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Header Banner */}
      <div className="text-center text-[11px] font-semibold text-neutral-500">
        <span>GeniusPay officiel • </span>
        <strong className="text-neutral-800">
          Mensuel : 425 FCFA / mois • Annuel : 4 700 FCFA / an
        </strong>
      </div>

      {/* CARDS LIST FOR THE 3 PLANS (LARGEUR ET LONGUEUR RÉDUITES) */}
      <div className="space-y-3">
        {PLANS.map((plan) => {
          const isPro = plan.id === 'pro';
          const isVip = plan.id === 'premium_vip';
          const priceObj = period === 'mensuel' ? plan.monthly : plan.annual;

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl p-3.5 sm:p-4 border-2 transition-all shadow-xs ${
                isPro
                  ? 'border-[#FF6600] shadow-md shadow-[#FF6600]/10 ring-1 ring-[#FF6600]/30'
                  : isVip
                  ? 'border-neutral-900 shadow-xs'
                  : 'border-neutral-200'
              }`}
            >
              {/* Badge (RECOMMANDÉ / EXCLUSIF) */}
              {plan.badge && (
                <div className="absolute -top-2.5 right-4">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-xs ${plan.badge.bg} ${plan.badge.textColor}`}>
                    {plan.badge.text}
                  </span>
                </div>
              )}

              {/* Title & Price Header */}
              <div className="mb-2.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <h3 className="font-extrabold text-sm text-neutral-900">
                    {plan.name}
                  </h3>
                  {isPro && <ShieldCheck className="w-3.5 h-3.5 text-[#FF6600]" />}
                  {isVip && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                </div>

                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
                    {priceObj.priceDisplay}
                  </span>
                  <span className="text-[11px] text-neutral-500 font-bold">
                    / {period === 'mensuel' ? 'mois' : 'an'}
                  </span>

                  {period === 'annuel' && plan.annual.oldPriceDisplay && (
                    <span className="text-[11px] text-neutral-400 line-through font-medium ml-1">
                      {plan.annual.oldPriceDisplay}
                    </span>
                  )}
                </div>

                {period === 'annuel' && plan.annual.savingsText && (
                  <div className="mt-0.5">
                    <span className="inline-block px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      💰 {plan.annual.savingsText}
                    </span>
                  </div>
                )}
              </div>

              {/* Features List (Compact) */}
              <div className="py-2 border-t border-neutral-100 space-y-1.5 mb-3">
                {plan.features.map((feat, fIdx) => (
                  <div key={fIdx} className="flex items-start gap-1.5 text-[11px] text-neutral-700">
                    <div className="w-3.5 h-3.5 rounded-full bg-orange-100 text-[#FF6600] flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span className="leading-tight">{feat}</span>
                  </div>
                ))}
              </div>

              {/* ACTION BUTTON - DIRECT EXTERNAL LINK (COMPACT) */}
              <div className="space-y-1 pt-0.5">
                <a
                  href={priceObj.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    setSelectedPlanForProof(plan);
                    try {
                      localStorage.setItem('artisanpro_last_selected_plan', JSON.stringify({
                        planId: plan.id,
                        planName: plan.name,
                        period,
                        url: priceObj.url
                      }));
                    } catch {}
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99] text-center ${
                    plan.buttonStyle === 'orange'
                      ? 'bg-[#FF6600] hover:bg-[#e65c00] text-white shadow-[#FF6600]/25'
                      : plan.buttonStyle === 'black'
                      ? 'bg-neutral-900 hover:bg-black text-white shadow-neutral-900/20'
                      : 'bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-300'
                  }`}
                >
                  <span>{plan.buttonLabel} — {priceObj.priceDisplay}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>

                {/* MANDATORY SUB-TEXT */}
                <p className="text-[10px] text-center text-neutral-500 font-medium">
                  🔒 Paiement sécurisé par GeniusPay - Wave, OM, MTN, Moov
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* BOUTON POST-PAIEMENT : "J'ai payé - Envoyer preuve" (Compact) */}
      <div className="pt-1">
        <div className="p-3 rounded-2xl bg-neutral-900 text-white space-y-2 shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF6600] text-white flex items-center justify-center shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-white">
                Tu as déjà effectué ton paiement ?
              </h4>
              <p className="text-[10px] text-neutral-300">
                Envoie ta capture d'écran GeniusPay pour activation immédiate.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setErrorMessage('');
              setShowProofModal(true);
            }}
            className="w-full py-2 px-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
          >
            <Camera className="w-3.5 h-3.5 text-[#FF6600]" />
            <span>J'ai payé — Envoyer ma preuve</span>
          </button>
        </div>
      </div>

      {/* PROOF SUBMISSION MODAL */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#FF6600] flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-neutral-900">Preuve de paiement GeniusPay</h3>
                  <p className="text-[10px] text-neutral-500">Wave • Orange Money • MTN • Moov</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowProofModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-200/60 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmitProof} className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
              {proofSubmittedSuccess ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="font-extrabold text-emerald-900 text-sm">Preuve transmise avec succès !</h4>
                  <p className="text-emerald-800 text-xs">
                    L'Administration examine votre reçu GeniusPay. Votre Badge Bleu Pro sera activé sous peu.
                  </p>
                </div>
              ) : (
                <>
                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Plan & Period Selection */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-neutral-800 mb-1 text-[11px]">
                        Forfait payé *
                      </label>
                      <select
                        value={selectedPlanForProof.id}
                        onChange={(e) => {
                          const p = PLANS.find(x => x.id === e.target.value);
                          if (p) setSelectedPlanForProof(p);
                        }}
                        className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs bg-white font-bold"
                      >
                        {PLANS.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-neutral-800 mb-1 text-[11px]">
                        Période *
                      </label>
                      <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as SubscriptionPeriod)}
                        className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs bg-white font-bold"
                      >
                        <option value="mensuel">Mensuel</option>
                        <option value="annuel">Annuel</option>
                      </select>
                    </div>
                  </div>

                  {/* Price confirmation box */}
                  <div className="p-3 bg-orange-50 rounded-2xl border border-orange-200 flex items-center justify-between">
                    <span className="text-neutral-700 font-semibold">Montant correspondant :</span>
                    <span className="text-base font-black text-[#FF6600]">
                      {period === 'mensuel' 
                        ? selectedPlanForProof.monthly.priceDisplay 
                        : selectedPlanForProof.annual.priceDisplay}
                    </span>
                  </div>

                  {/* Screenshot upload */}
                  <div>
                    <label className="block font-bold text-neutral-800 mb-1.5 text-[11px]">
                      Capture d'écran du reçu de paiement *
                    </label>

                    {proofImage ? (
                      <div className="relative rounded-2xl overflow-hidden border border-neutral-300 h-44 bg-neutral-100">
                        <img src={proofImage} alt="Reçu" className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => setProofImage('')}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => proofFileInputRef.current?.click()}
                        className="w-full py-6 px-4 rounded-2xl border-2 border-dashed border-orange-300 hover:border-[#FF6600] bg-orange-50/50 hover:bg-orange-50 text-[#FF6600] font-bold text-xs flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Camera className="w-6 h-6" />
                        <span>+ Sélectionner la capture du reçu GeniusPay (Galerie)</span>
                        <span className="text-[10px] text-neutral-500 font-normal">
                          Wave, Orange Money, MTN MoMo, Moov Money
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Transaction Ref Optional */}
                  <div>
                    <label className="block font-bold text-neutral-800 mb-1 text-[11px]">
                      Numéro ou Référence de transaction (optionnel)
                    </label>
                    <input
                      type="text"
                      value={proofTransactionRef}
                      onChange={(e) => setProofTransactionRef(e.target.value)}
                      placeholder="Ex: TX-9847293 ou Wave ID"
                      className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmittingProof || !proofImage}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#FF6600] hover:bg-[#e65c00] disabled:opacity-40 text-white font-black text-xs shadow-md shadow-[#FF6600]/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {isSubmittingProof ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Envoi en cours...</span>
                      </>
                    ) : (
                      <span>Transmettre la preuve à l'Administrateur</span>
                    )}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
