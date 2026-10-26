import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Navigation,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Star,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Car,
  Check,
  DollarSign,
  Send,
  Zap,
  RefreshCw,
  XCircle,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../lib/dataStore';
import { ServiceRequest, MissionStatus, Artisan } from '../../types';

interface MissionTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ServiceRequest;
  onOpenChatWith: (artisan: Artisan) => void;
  onOpenWallet: () => void;
  onRequestUpdated: (updated: ServiceRequest) => void;
}

export const MissionTrackingModal: React.FC<MissionTrackingModalProps> = ({
  isOpen,
  onClose,
  request,
  onOpenChatWith,
  onOpenWallet,
  onRequestUpdated
}) => {
  const { user, profile, isAdmin } = useAuth();
  const userId = user?.id || profile?.id || 'me';

  const [currentRequest, setCurrentRequest] = useState<ServiceRequest>(request);
  const [assignedArtisan, setAssignedArtisan] = useState<Artisan | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [countdown, setCountdown] = useState(45);
  const [nearbyCount, setNearbyCount] = useState(0);

  // Quote state
  const [quoteAmount, setQuoteAmount] = useState<number>(currentRequest.quote_amount_fcfa || 15000);
  const [quoteNotes, setQuoteNotes] = useState<string>(currentRequest.quote_notes || '');
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);

  // Review state
  const [rating, setRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Action status message
  const [actionMsg, setActionMsg] = useState<string>('');

  const isClient = currentRequest.client_id === userId || !currentRequest.assigned_artisan_id || currentRequest.assigned_artisan_id !== userId;
  const isAssignedArtisan = currentRequest.assigned_artisan_id === userId;

  // Sync state
  useEffect(() => {
    setCurrentRequest(request);
  }, [request]);

  // Load artisan info if assigned
  useEffect(() => {
    if (currentRequest.assigned_artisan_id) {
      dataStore.getArtisans().then(list => {
        const art = list.find(a => a.id === currentRequest.assigned_artisan_id);
        if (art) setAssignedArtisan(art);
      });
    }
  }, [currentRequest.assigned_artisan_id]);

  // Distribution algorithm runner if searching_artisan
  useEffect(() => {
    let timer: any;
    if (currentRequest.status === 'searching_artisan' && isOpen) {
      setIsSearching(true);
      // Run GPS distribution search
      dataStore.findNearbyAvailableArtisans(
        currentRequest.metier,
        currentRequest.client_lat || 5.3600,
        currentRequest.client_lng || -4.0083,
        currentRequest.search_radius_km || 15
      ).then(candidates => {
        setNearbyCount(candidates.length);
        if (candidates.length > 0) {
          // Propose mission to the first available artisan
          const best = candidates[0];
          timer = setTimeout(async () => {
            const updated = await dataStore.updateServiceRequest(currentRequest.id, {
              status: 'offer_sent',
              assigned_artisan_id: best.artisan.id,
              assigned_artisan_name: best.artisan.nom,
              assigned_artisan_phone: best.artisan.telephone || best.artisan.whatsapp,
              assigned_artisan_avatar: best.artisan.photos?.[0],
              assigned_artisan_lat: best.artisan.gps_lat || (currentRequest.client_lat ? currentRequest.client_lat + 0.015 : 5.375),
              assigned_artisan_lng: best.artisan.gps_lng || (currentRequest.client_lng ? currentRequest.client_lng + 0.012 : -3.995)
            });
            if (updated) {
              setCurrentRequest(updated);
              onRequestUpdated(updated);
              setAssignedArtisan(best.artisan);
            }
          }, 2000);
        } else {
          // Expand radius or alert
          setActionMsg('Aucun artisan disponible immédiatement dans ce rayon. Recherche élargie en cours...');
        }
      });
    }

    return () => clearTimeout(timer);
  }, [currentRequest.status, isOpen]);

  // Countdown for offer_sent
  useEffect(() => {
    let interval: any;
    if (currentRequest.status === 'offer_sent' && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(c => c - 1);
      }, 1000);
    } else if (currentRequest.status === 'offer_sent' && countdown === 0) {
      // Auto-accept simulated if demonstration or fallback to next
      handleStatusChange('artisan_accepted');
    }
    return () => clearInterval(interval);
  }, [currentRequest.status, countdown]);

  if (!isOpen) return null;

  const handleStatusChange = async (newStatus: MissionStatus, extra: Partial<ServiceRequest> = {}) => {
    setActionMsg('');
    const now = new Date().toISOString();
    const updates: Partial<ServiceRequest> = {
      status: newStatus,
      ...extra
    };

    if (newStatus === 'artisan_accepted') updates.assigned_at = now;
    if (newStatus === 'artisan_en_route') updates.en_route_at = now;
    if (newStatus === 'artisan_arrived') updates.arrived_at = now;
    if (newStatus === 'in_progress') updates.started_at = now;
    if (newStatus === 'completed_by_artisan') updates.completed_at = now;

    const updated = await dataStore.updateServiceRequest(currentRequest.id, updates);
    if (updated) {
      setCurrentRequest(updated);
      onRequestUpdated(updated);
    }
  };

  // Submit Quote (by Artisan)
  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingQuote(true);
    try {
      const updated = await dataStore.updateServiceRequest(currentRequest.id, {
        quote_amount_fcfa: Math.round(quoteAmount),
        quote_notes: quoteNotes.trim() || 'Devis détaillé main d\'œuvre et matériaux',
        quote_status: 'pending'
      });
      if (updated) {
        setCurrentRequest(updated);
        onRequestUpdated(updated);
        setActionMsg('Devis soumis au client avec succès !');
      }
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  // Accept Quote and Pay from Wallet (by Client)
  const handleAcceptAndPayQuote = async () => {
    if (!currentRequest.quote_amount_fcfa || !currentRequest.assigned_artisan_id) return;
    const amount = currentRequest.quote_amount_fcfa;
    setActionMsg('Validation du paiement du devis...');

    const res = await dataStore.payArtisanFromWallet(
      userId,
      currentRequest.assigned_artisan_id,
      amount,
      currentRequest.id,
      `Paiement devis intervention ${currentRequest.metier}`
    );

    if (res.success) {
      const updated = await dataStore.updateServiceRequest(currentRequest.id, {
        quote_status: 'accepted',
        quote_paid: true,
        quote_payment_ref: res.clientTx?.reference,
        status: 'in_progress'
      });
      if (updated) {
        setCurrentRequest(updated);
        onRequestUpdated(updated);
        setActionMsg('Devis validé et montant sécurisé ! L\'artisan commence le travail.');
      }
    } else {
      setActionMsg(res.error || 'Solde insuffisant dans votre portefeuille.');
    }
  };

  // Confirm Work Completion (by Client)
  const handleConfirmWorkDone = async () => {
    setActionMsg('Clôture et validation de l\'intervention...');
    const updated = await dataStore.updateServiceRequest(currentRequest.id, {
      status: 'payment_finalized',
      completed_at: new Date().toISOString()
    });
    if (updated) {
      setCurrentRequest(updated);
      onRequestUpdated(updated);
      setActionMsg('Travail validé ! Veuillez laisser un avis sur l\'artisan.');
    }
  };

  // Submit Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReview(true);
    try {
      const updated = await dataStore.updateServiceRequest(currentRequest.id, {
        client_review_rating: rating,
        client_review_comment: reviewComment.trim()
      });
      if (updated) {
        setCurrentRequest(updated);
        onRequestUpdated(updated);
        setReviewSuccess(true);
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Cancel Request with safety refund
  const handleCancelRequest = async () => {
    if (!window.confirm('Voulez-vous vraiment annuler cette demande ?')) return;
    
    // If urgent fee was paid, refund automatically
    if (currentRequest.is_urgency_paid && currentRequest.urgency_payment_ref) {
      await dataStore.createDepositTransaction(
        userId,
        currentRequest.urgency_fee_fcfa,
        'wallet_internal',
        profile?.telephone || '',
        'REF-' + currentRequest.id,
        profile?.full_name
      );
    }

    const updated = await dataStore.updateServiceRequest(currentRequest.id, {
      status: currentRequest.is_urgency_paid ? 'refunded' : 'cancelled'
    });
    if (updated) {
      setCurrentRequest(updated);
      onRequestUpdated(updated);
    }
  };

  // Compute status steps progress
  const getStatusStep = (status: MissionStatus): number => {
    switch (status) {
      case 'pending_payment':
      case 'payment_verifying':
        return 0;
      case 'searching_artisan':
      case 'offer_sent':
        return 1;
      case 'artisan_accepted':
        return 2;
      case 'artisan_en_route':
        return 3;
      case 'artisan_arrived':
        return 4;
      case 'in_progress':
        return 5;
      case 'completed_by_artisan':
        return 6;
      case 'completed_by_client':
      case 'payment_finalized':
        return 7;
      default:
        return 0;
    }
  };

  const currentStep = getStatusStep(currentRequest.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-neutral-100 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 ${
              currentRequest.type === 'urgent' ? 'bg-[#FF6B00] shadow-[#FF6B00]/30' : 'bg-emerald-600 shadow-emerald-600/30'
            }`}>
              {currentRequest.type === 'urgent' ? <Zap className="w-5 h-5 fill-white" /> : <Navigation className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Mission GPS #{currentRequest.id.slice(-6).toUpperCase()}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  currentRequest.type === 'urgent'
                    ? 'bg-[#FF6B00] text-white'
                    : 'bg-emerald-700 text-white'
                }`}>
                  {currentRequest.type === 'urgent' ? '🚨 URGENT' : 'NORMAL'}
                </span>
              </div>
              <p className="text-xs text-neutral-300">
                {currentRequest.metier} • {currentRequest.ville}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">

          {actionMsg && (
            <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-orange-950 font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-[#FF6B00] shrink-0" />
              <span>{actionMsg}</span>
            </div>
          )}

          {/* STATUS STEPPER PROGRESS BAR */}
          <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-neutral-500 uppercase tracking-wider text-[10px]">
                Statut de l'intervention
              </span>
              <span className="text-[#FF6B00]">
                Étape {currentStep} sur 7
              </span>
            </div>

            {/* Visual Step Indicator */}
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map(step => (
                <div
                  key={step}
                  className={`h-2 rounded-full transition-all ${
                    currentStep >= step
                      ? 'bg-[#FF6B00]'
                      : 'bg-neutral-200'
                  }`}
                />
              ))}
            </div>

            <div className="text-center pt-1">
              <span className="font-extrabold text-xs text-neutral-900 block">
                {currentRequest.status === 'searching_artisan' && '🔍 Recherche GPS des artisans libres en cours...'}
                {currentRequest.status === 'offer_sent' && `⏳ Proposition envoyée à l'artisan (${countdown}s)...`}
                {currentRequest.status === 'artisan_accepted' && '✅ Artisan trouvé et mission acceptée !'}
                {currentRequest.status === 'artisan_en_route' && '🚗 L\'artisan est en route vers votre adresse.'}
                {currentRequest.status === 'artisan_arrived' && '📍 L\'artisan est arrivé sur place.'}
                {currentRequest.status === 'in_progress' && '🔨 Travaux en cours de réalisation.'}
                {currentRequest.status === 'completed_by_artisan' && '🏁 Travail terminé par l\'artisan. En attente de validation.'}
                {currentRequest.status === 'payment_finalized' && '🎉 Intervention clôturée et travail validé !'}
                {currentRequest.status === 'cancelled' && '❌ Demande annulée.'}
                {currentRequest.status === 'refunded' && '🔄 Demande annulée et frais remboursés sur votre portefeuille.'}
              </span>
            </div>
          </div>

          {/* RADAR ANIMATION WHEN SEARCHING */}
          {(currentRequest.status === 'searching_artisan' || currentRequest.status === 'offer_sent') && (
            <div className="p-6 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 rounded-3xl text-white text-center space-y-3 relative overflow-hidden shadow-lg border border-neutral-700">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-[#FF6B00]/40 animate-ping" />
                <div className="absolute inset-2 rounded-full border border-orange-400/50 animate-pulse" />
                <div className="w-12 h-12 rounded-full bg-[#FF6B00] flex items-center justify-center text-white shadow-lg shadow-[#FF6B00]/50 z-10">
                  <Navigation className="w-6 h-6 animate-spin" />
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-sm text-white">
                  {currentRequest.status === 'searching_artisan' ? 'Scan GPS en cours' : 'Artisan contacté en priorité'}
                </h4>
                <p className="text-xs text-neutral-300 mt-1">
                  Recherche des {currentRequest.metier} disponibles dans un rayon de {currentRequest.search_radius_km} km.
                </p>
                {currentRequest.status === 'offer_sent' && (
                  <div className="mt-2 text-xs font-black text-orange-400 bg-white/10 py-1 px-3 rounded-full inline-block">
                    Temps de réponse imparti : {countdown} secondes
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ASSIGNED ARTISAN CARD & GPS TRACKING */}
          {currentRequest.assigned_artisan_id && (
            <div className="p-4 bg-white rounded-3xl border border-neutral-200 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Artisan Affecté à la Mission
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Vérifié ArtisanPro
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-neutral-100 overflow-hidden border border-neutral-200 shrink-0">
                  <img
                    src={currentRequest.assigned_artisan_avatar || assignedArtisan?.photos?.[0] || 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?w=300&auto=format&fit=crop&q=80'}
                    alt={currentRequest.assigned_artisan_name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-sm text-neutral-900 truncate">
                    {currentRequest.assigned_artisan_name}
                  </h3>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-orange-50 text-[#FF6B00] text-[10px] font-bold mt-0.5">
                    {currentRequest.metier}
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-500">
                    <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      5.0 (Vérifié)
                    </span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold">~ 2.4 km d'approche</span>
                  </div>
                </div>
              </div>

              {/* MAP & GPS APPROACH VISUALIZER */}
              <div className="p-3 bg-neutral-900 text-white rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 text-orange-400 font-bold">
                    <Navigation className="w-3.5 h-3.5" />
                    Itinéraire GPS en direct
                  </span>
                  <span className="text-neutral-400 font-mono">
                    Client: {currentRequest.client_lat?.toFixed(3)}, {currentRequest.client_lng?.toFixed(3)}
                  </span>
                </div>

                {/* Simulated live visual map route */}
                <div className="h-24 bg-neutral-800 rounded-xl relative overflow-hidden flex items-center justify-between px-6 border border-neutral-700">
                  {/* Route line */}
                  <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#FF6B00]/70" />

                  {/* Artisan point */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#FF6B00] text-white flex items-center justify-center shadow-lg shadow-[#FF6B00]/50 animate-bounce">
                      <Car className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold mt-1 text-orange-300">Artisan</span>
                  </div>

                  {/* Status label in middle */}
                  <div className="relative z-10 px-2 py-1 bg-black/60 backdrop-blur-xs rounded-lg border border-white/10 text-[9px] font-bold text-neutral-300">
                    {currentRequest.status === 'artisan_en_route' ? 'En déplacement 🚗' : 'Zone couverte'}
                  </div>

                  {/* Client point */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/50">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold mt-1 text-emerald-300">Votre Position</span>
                  </div>
                </div>

                {/* Google Maps link */}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${currentRequest.client_lat},${currentRequest.client_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Ouvrir l'itinéraire complet sur Google Maps</span>
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>

              {/* ACTION BUTTONS : CONTACT ARTISAN */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (assignedArtisan) {
                      onClose();
                      onOpenChatWith(assignedArtisan);
                    }
                  }}
                  className="py-2.5 px-3 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#FF6B00]/25 cursor-pointer transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat avec l'artisan</span>
                </button>

                {currentRequest.assigned_artisan_phone && (
                  <a
                    href={`tel:${currentRequest.assigned_artisan_phone}`}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 cursor-pointer transition-all"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Appel Direct</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* QUOTE SECTION */}
          {currentRequest.assigned_artisan_id && (
            <div className="p-4 bg-white rounded-3xl border border-neutral-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-neutral-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#FF6B00]" />
                  Devis & Rémunération du Travail
                </h4>
                {currentRequest.quote_paid && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                    Payé & Sécurisé ✅
                  </span>
                )}
              </div>

              {currentRequest.quote_amount_fcfa ? (
                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 font-semibold">Montant proposé :</span>
                    <span className="text-lg font-black text-[#FF6B00]">
                      {currentRequest.quote_amount_fcfa.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  {currentRequest.quote_notes && (
                    <p className="text-[11px] text-neutral-700 pt-1 border-t border-neutral-200">
                      <strong>Détails :</strong> {currentRequest.quote_notes}
                    </p>
                  )}

                  {/* Client Accept Button */}
                  {isClient && !currentRequest.quote_paid && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleAcceptAndPayQuote}
                        className="w-full py-2.5 px-3 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-extrabold text-xs shadow-md shadow-[#FF6B00]/25 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Check className="w-4 h-4" />
                        <span>Accepter & Payer depuis mon Portefeuille ({currentRequest.quote_amount_fcfa.toLocaleString('fr-FR')} F)</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Form for Artisan to submit quote */
                <form onSubmit={handleSubmitQuote} className="space-y-2">
                  <p className="text-[11px] text-neutral-500">
                    Fixez le montant des travaux après examen de la panne avec le client.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">Montant (FCFA) *</label>
                      <input
                        type="number"
                        min={1000}
                        step={500}
                        required
                        value={quoteAmount}
                        onChange={(e) => setQuoteAmount(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-300 text-xs font-black"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">Détail des pièces</label>
                      <input
                        type="text"
                        placeholder="Ex: Raccord + Joint + Main d'œuvre"
                        value={quoteNotes}
                        onChange={(e) => setQuoteNotes(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-300 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmittingQuote}
                    className="w-full py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-extrabold text-xs cursor-pointer transition-colors"
                  >
                    {isSubmittingQuote ? 'Enregistrement...' : 'Proposer ce devis'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ARTISAN MISSION PROGRESS CONTROLS (SIMULATE/ADVANCE STEPS) */}
          <div className="p-4 bg-orange-50/60 rounded-3xl border border-orange-200/70 space-y-2">
            <span className="text-[10px] font-black uppercase text-[#FF6B00] tracking-wider block">
              Contrôles de l'Intervention (Artisan & Suivi)
            </span>
            
            <div className="grid grid-cols-2 gap-1.5">
              {currentRequest.status === 'offer_sent' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('artisan_accepted')}
                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs col-span-2"
                >
                  Accepter la mission ✅
                </button>
              )}

              {currentRequest.status === 'artisan_accepted' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('artisan_en_route')}
                  className="py-2 px-3 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-bold text-xs cursor-pointer shadow-xs col-span-2"
                >
                  🚗 Je suis en route vers le client
                </button>
              )}

              {currentRequest.status === 'artisan_en_route' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('artisan_arrived')}
                  className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-xs col-span-2"
                >
                  📍 Je suis arrivé sur place
                </button>
              )}

              {currentRequest.status === 'artisan_arrived' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('in_progress')}
                  className="py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-xs col-span-2"
                >
                  🔨 Commencer les travaux
                </button>
              )}

              {currentRequest.status === 'in_progress' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('completed_by_artisan')}
                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs col-span-2"
                >
                  🏁 Marquer travail terminé (Artisan)
                </button>
              )}
            </div>

            {/* Client Confirmation Button */}
            {currentRequest.status === 'completed_by_artisan' && isClient && (
              <button
                type="button"
                onClick={handleConfirmWorkDone}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmer la fin du travail & libérer le paiement</span>
              </button>
            )}
          </div>

          {/* RATING & REVIEW SECTION ON COMPLETION */}
          {(currentRequest.status === 'payment_finalized' || currentRequest.status === 'completed_by_client') && (
            <div className="p-4 bg-white rounded-3xl border border-neutral-200 shadow-sm space-y-3">
              <h4 className="font-extrabold text-xs text-neutral-900 flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                Évaluation & Avis Client
              </h4>

              {reviewSuccess || currentRequest.client_review_rating ? (
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 font-bold text-xs space-y-1">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(st => (
                      <Star
                        key={st}
                        className={`w-4 h-4 ${
                          st <= (currentRequest.client_review_rating || rating)
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-neutral-300'
                        }`}
                      />
                    ))}
                    <span className="ml-2 font-black">{currentRequest.client_review_rating || rating}/5</span>
                  </div>
                  <p className="text-[11px] text-neutral-700 font-normal">
                    « {currentRequest.client_review_comment || reviewComment || 'Excellente prestation !'} »
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitReview} className="space-y-3">
                  <div className="flex items-center justify-center gap-2 py-1">
                    {[1, 2, 3, 4, 5].map(st => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setRating(st)}
                        className="p-1 cursor-pointer transition-transform hover:scale-125"
                      >
                        <Star className={`w-6 h-6 ${st <= rating ? 'text-amber-400 fill-amber-400' : 'text-neutral-300'}`} />
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={2}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Laissez votre avis sur la ponctualité et la qualité du travail..."
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                  />

                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="w-full py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-extrabold text-xs cursor-pointer shadow-md shadow-[#FF6B00]/25 transition-all"
                  >
                    {isSubmittingReview ? 'Envoi...' : 'Publier mon avis'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* DÉTAILS INITIAL DE LA DEMANDE */}
          <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-1.5 text-neutral-700">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
              Détails de votre demande initiale
            </span>
            <p className="text-xs font-semibold text-neutral-900 leading-relaxed">
              {currentRequest.description}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-neutral-500 pt-1">
              <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>{currentRequest.address_text} ({currentRequest.ville})</span>
            </div>
          </div>

          {/* CANCEL BUTTON */}
          {['pending_payment', 'searching_artisan', 'offer_sent', 'artisan_accepted'].includes(currentRequest.status) && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCancelRequest}
                className="w-full py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>
                  {currentRequest.is_urgency_paid ? 'Annuler la demande (Remboursement des frais)' : 'Annuler la demande'}
                </span>
              </button>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="p-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-[11px] text-neutral-500 shrink-0">
          <span className="flex items-center gap-1 text-emerald-700 font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Mission sous protection ArtisanPro Afrique
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold cursor-pointer"
          >
            Fermer le suivi
          </button>
        </div>

      </div>
    </div>
  );
};
