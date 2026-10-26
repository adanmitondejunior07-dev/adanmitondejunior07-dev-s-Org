import React, { useState, useEffect } from 'react';
import {
  X,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Send,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Phone,
  Copy,
  Check,
  DollarSign,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../lib/dataStore';
import { supabase } from '../../lib/supabase';
import { UserWallet, WalletTransaction, PaymentProvider, TransactionType, Artisan } from '../../types';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenArtisanChat?: (artisanId: string) => void;
  onOpenDeployer?: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onOpenDeployer }) => {
  const { user, profile } = useAuth();
  const userId = user?.id || profile?.id || 'me';

  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Sub-modals for wallet operations
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showPayArtisanModal, setShowPayArtisanModal] = useState(false);

  // Deposit state
  const [depositAmount, setDepositAmount] = useState<number>(5000);
  const [depositProvider, setDepositProvider] = useState<PaymentProvider>('orange_money');
  const [depositPhone, setDepositPhone] = useState<string>(profile?.telephone || '');
  const [depositRef, setDepositRef] = useState<string>('');
  const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState('');

  // GeniusPay Sandbox pending state & server verification
  const [geniusPayPendingTx, setGeniusPayPendingTx] = useState<{ reference: string; amount: number; checkoutUrl?: string } | null>(null);
  const [isVerifyingGeniusPay, setIsVerifyingGeniusPay] = useState(false);
  const [geniusPayStatusMsg, setGeniusPayStatusMsg] = useState<{ type: 'info' | 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Payout state (Withdrawal for artisans / users)
  const [payoutAmount, setPayoutAmount] = useState<number>(5000);
  const [payoutProvider, setPayoutProvider] = useState<PaymentProvider>('orange_money');
  const [payoutPhone, setPayoutPhone] = useState<string>(profile?.telephone || '');
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState('');
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState('');

  // Pay artisan state
  const [artisansList, setArtisansList] = useState<Artisan[]>([]);
  const [selectedPayArtisanId, setSelectedPayArtisanId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<number>(10000);
  const [payDescription, setPayDescription] = useState<string>('');
  const [isProcessingPay, setIsProcessingPay] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccessMsg, setPaySuccessMsg] = useState('');

  // Country payment methods
  const userCountry = profile?.pays || 'Côte d\'Ivoire';

  const loadWalletData = async () => {
    setIsLoading(true);
    try {
      const w = await dataStore.getWallet(userId);
      setWallet(w);
      const txs = await dataStore.getWalletTransactions(userId);
      setTransactions(txs);
      const artisans = await dataStore.getArtisans();
      setArtisansList(artisans.filter(a => a.id !== userId));
    } catch (err) {
      console.error('Error loading wallet:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadWalletData();
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  // Filter transactions
  const filteredTxs = transactions.filter(tx => {
    if (filterType === 'all') return true;
    if (filterType === 'deposit') return tx.type === 'deposit';
    if (filterType === 'payment') return tx.type === 'payment';
    if (filterType === 'payout') return tx.type === 'payout';
    if (filterType === 'refund') return tx.type === 'refund';
    return true;
  });

  // Handle Deposit Submit
  const handleConfirmDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount < 200) {
      setGeniusPayStatusMsg({
        type: 'warning',
        text: 'Le montant minimum de recharge GeniusPay est de 200 FCFA.'
      });
      return;
    }
    setIsProcessingDeposit(true);
    setDepositSuccessMsg('');
    setGeniusPayStatusMsg(null);

    // Mappage strict vers les méthodes supportées par GeniusPay
    const methodMap: Record<string, string> = {
      wave: 'wave',
      mtn_momo: 'mtn_money',
      orange_money: 'orange_money',
      moov_money: 'moov_money',
      geniuspay: 'wave'
    };
    const paymentMethod = methodMap[depositProvider] || 'wave';

    try {
      let checkoutUrl = '';
      let serverReference = '';
      let failureError = '';

      // 1. Appel de la fonction Supabase Edge create-wallet-recharge avec capture propre d'erreur
      try {
        const { data, error } = await supabase.functions.invoke('create-wallet-recharge', {
          body: {
            amount_fcfa: depositAmount,
            phone_number: depositPhone,
            customer_name: profile?.full_name || 'Utilisateur',
            payment_method: paymentMethod,
            return_url: window.location.href,
            user_id: userId
          }
        });

        if (!error && data?.success && data?.checkout_url && data?.reference) {
          // ✅ Récupération de la référence marchand officielle enregistrée
          checkoutUrl = String(data.checkout_url).trim();
          serverReference = String(data.reference).trim();
        } else if (error) {
          // Si l'edge function a renvoyé un statut non-2xx, essayer de lire le détail
          let detail = '';
          try {
            if ((error as any).context && typeof (error as any).context.json === 'function') {
              const errBody = await (error as any).context.json();
              if (errBody?.error) detail = errBody.error;
            }
          } catch {}
          failureError = detail || error.message || '';
        }
      } catch (edgeErr: any) {
        failureError = edgeErr?.message || '';
      }

      // 2. Repli serveur fiable et instantané si l'Edge Function distante a renvoyé une erreur non-2xx
      if (!checkoutUrl || !serverReference) {
        try {
          const srvRes = await fetch('/api/wallet/create-recharge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount_fcfa: depositAmount,
              phone_number: depositPhone,
              customer_name: profile?.full_name || 'Utilisateur',
              payment_method: paymentMethod,
              return_url: window.location.href,
              user_id: userId
            })
          });

          if (srvRes.ok) {
            const srvJson = await srvRes.json();
            if (srvJson.success && srvJson.checkout_url && srvJson.reference) {
              checkoutUrl = String(srvJson.checkout_url).trim();
              serverReference = String(srvJson.reference).trim();
              failureError = '';
            }
          }
        } catch (srvErr: any) {
          console.warn('Fallback recharge note:', srvErr);
        }
      }

      // 3. Enregistrement local et ouverture du guichet UNIQUEMENT si le serveur a validé l'intention
      if (checkoutUrl && serverReference) {
        // Enregistre en local une seule fois avec la VRAIE référence marchand serveur
        await dataStore.initiateGeniusPayRecharge(
          userId,
          depositAmount,
          serverReference,
          depositPhone,
          profile?.full_name || 'Utilisateur'
        );

        // ✅ Assure que le bouton "Vérifier" enverra la référence marchand officielle
        setGeniusPayPendingTx({
          reference: serverReference,
          amount: depositAmount,
          checkoutUrl: checkoutUrl
        });

        // Ouvre immédiatement l'URL de paiement Wave / GeniusPay
        try {
          const opened = window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
          if (!opened) {
            console.log('Ouverture popup bloquée par le navigateur, bouton direct disponible.');
          }
        } catch (_) {}

        setGeniusPayStatusMsg({
          type: 'info',
          text: `Session de paiement ${paymentMethod.toUpperCase()} prête (Réf: ${serverReference}). Cliquez sur le bouton ci-dessous pour ouvrir le guichet de paiement GeniusPay.`
        });
        setDepositSuccessMsg(`Demande de recharge initiée (Réf: ${serverReference}). Statut: EN ATTENTE. Le portefeuille ne sera crédité qu'après confirmation.`);
      } else {
        const cleanMsg = failureError && !failureError.includes('non-2xx')
          ? failureError
          : `Le moyen de paiement ${paymentMethod.toUpperCase()} est temporairement indisponible sur le réseau. Veuillez réessayer dans quelques instants.`;
        setGeniusPayStatusMsg({
          type: 'warning',
          text: cleanMsg
        });
      }

      await loadWalletData();
    } catch (err: any) {
      console.error('Erreur initiation recharge:', err);
      setGeniusPayStatusMsg({
        type: 'warning',
        text: err?.message || 'Erreur lors de la préparation de la transaction'
      });
    } finally {
      setIsProcessingDeposit(false);
    }
  };

  const handleVerifyGeniusPay = async (ref: string, amount: number) => {
    setIsVerifyingGeniusPay(true);
    setGeniusPayStatusMsg(null);

    try {
      let isVerified = false;
      let isAlreadyProcessed = false;
      let msg = '';

      try {
        const { data, error } = await supabase.functions.invoke('verify-wallet-recharge', {
          body: { reference: ref }
        });

        if (!error && data?.success) {
          if (data.already_processed) {
            isAlreadyProcessed = true;
            msg = 'Transaction déjà traitée et créditée (verrou anti-double crédit actif).';
          } else {
            isVerified = true;
            msg = data.message || `Paiement certifié par GeniusPay ! Portefeuille crédité de ${amount.toLocaleString('fr-FR')} FCFA.`;
          }
        }
      } catch (edgeErr) {
        console.warn('Edge Function verify-wallet-recharge en mode vérification:', edgeErr);
      }

      // Repli serveur direct si Edge Function retourne non-2xx ou non vérifié
      if (!isVerified && !isAlreadyProcessed) {
        try {
          const srvVerify = await fetch('/api/wallet/verify-recharge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: ref, user_id: userId })
          });
          if (srvVerify.ok) {
            const vData = await srvVerify.json();
            if (vData.success) {
              if (vData.already_processed) {
                isAlreadyProcessed = true;
                msg = 'Transaction déjà traitée et créditée (verrou anti-double crédit actif).';
              } else {
                isVerified = true;
                msg = `Paiement validé avec succès ! Portefeuille crédité de ${amount.toLocaleString('fr-FR')} FCFA.`;
              }
            }
          }
        } catch {}
      }

      if (!msg) {
        msg = 'Paiement en cours de validation par l\'opérateur. Veuillez patienter un instant.';
      }

      if (isVerified) {
        await dataStore.confirmGeniusPayRecharge(ref, amount);
        await loadWalletData();
        setGeniusPayStatusMsg({ type: 'success', text: msg });
        setGeniusPayPendingTx(null);
      } else if (isAlreadyProcessed) {
        await loadWalletData();
        setGeniusPayStatusMsg({ type: 'info', text: msg });
        setGeniusPayPendingTx(null);
      } else {
        setGeniusPayStatusMsg({ type: 'error', text: msg });
      }
    } catch (err: any) {
      setGeniusPayStatusMsg({ type: 'error', text: err.message || 'Erreur lors de la vérification' });
    } finally {
      setIsVerifyingGeniusPay(false);
    }
  };

  // Handle Payout Submit
  const handleConfirmPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError('');
    setPayoutSuccessMsg('');

    if (payoutAmount < 1000) {
      setPayoutError('Le montant minimum de retrait est de 1 000 FCFA.');
      return;
    }
    if ((wallet?.balance_fcfa || 0) < payoutAmount) {
      setPayoutError(`Solde insuffisant (${(wallet?.balance_fcfa || 0).toLocaleString('fr-FR')} FCFA disponibles).`);
      return;
    }

    setIsProcessingPayout(true);
    try {
      const res = await dataStore.requestPayout(
        userId,
        payoutAmount,
        payoutProvider,
        payoutPhone,
        profile?.full_name
      );
      if (res.success) {
        setPayoutSuccessMsg('Demande de retrait enregistrée ! Elle sera validée sous 24h ouvrées.');
        await loadWalletData();
        setTimeout(() => {
          setShowPayoutModal(false);
          setPayoutSuccessMsg('');
        }, 2000);
      } else {
        setPayoutError(res.error || 'Erreur lors de la demande de retrait.');
      }
    } catch (err: any) {
      setPayoutError(err.message || 'Erreur réseau');
    } finally {
      setIsProcessingPayout(false);
    }
  };

  // Handle Pay Artisan Submit
  const handleConfirmPayArtisan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError('');
    setPaySuccessMsg('');

    if (!selectedPayArtisanId) {
      setPayError('Veuillez sélectionner un artisan.');
      return;
    }
    if (payAmount <= 0) {
      setPayError('Montant invalide.');
      return;
    }
    if ((wallet?.balance_fcfa || 0) < payAmount) {
      setPayError(`Solde insuffisant (${(wallet?.balance_fcfa || 0).toLocaleString('fr-FR')} FCFA). Rechargez votre portefeuille.`);
      return;
    }

    setIsProcessingPay(true);
    try {
      const targetArtisan = artisansList.find(a => a.id === selectedPayArtisanId);
      const desc = payDescription.trim() || `Paiement prestation artisanale - ${targetArtisan?.nom || 'Artisan'}`;
      const res = await dataStore.payArtisanFromWallet(
        userId,
        selectedPayArtisanId,
        payAmount,
        'direct-pay-' + Date.now(),
        desc
      );

      if (res.success) {
        setPaySuccessMsg(`Paiement de ${payAmount.toLocaleString('fr-FR')} FCFA envoyé à ${targetArtisan?.nom || 'l\'artisan'} !`);
        await loadWalletData();
        setTimeout(() => {
          setShowPayArtisanModal(false);
          setPaySuccessMsg('');
          setSelectedPayArtisanId('');
          setPayDescription('');
        }, 1800);
      } else {
        setPayError(res.error || 'Erreur lors du paiement.');
      }
    } catch (err: any) {
      setPayError(err.message || 'Erreur réseau');
    } finally {
      setIsProcessingPay(false);
    }
  };

  const copyRefToClipboard = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 flex flex-col max-h-[78dvh] overflow-hidden">
        
        {/* HEADER */}
        <div className="py-3 px-4 bg-gradient-to-r from-neutral-900 via-neutral-900 to-black text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center shadow-md shadow-[#FF6B00]/30 shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5 leading-tight">
                Mon Portefeuille
                <span className="px-1.5 py-0.5 rounded-full bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/40 text-[9px] font-bold">
                  FCFA Sécurisé
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400 leading-tight">
                Solde, recharges et paiements d'artisan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="p-3.5 overflow-y-auto space-y-3 flex-1 text-xs pb-6">

          {/* MAIN WALLET CARD */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#111111] via-neutral-900 to-[#1a1a1a] text-white shadow-lg relative overflow-hidden border border-neutral-800">
            {/* Background decorative circles */}
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-[#FF6B00]/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Solde Disponible
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-bold text-[10px] bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-800/50">
                <ShieldCheck className="w-3 h-3" />
                Vérifié
              </span>
            </div>

            <div className="my-1.5">
              <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {(wallet?.balance_fcfa || 0).toLocaleString('fr-FR')}
              </span>
              <span className="text-base sm:text-lg font-extrabold text-[#FF6B00] ml-1.5">
                FCFA
              </span>
            </div>

            <div className="text-[10px] text-neutral-400 flex items-center justify-between pt-1.5 border-t border-neutral-800/80">
              <span>Titulaire : <strong className="text-neutral-200">{profile?.full_name || 'Utilisateur'}</strong></span>
              <span>{userCountry}</span>
            </div>

            {/* ACTION BUTTONS */}
            <div className="grid grid-cols-3 gap-1.5 mt-3 pt-1.5">
              <button
                type="button"
                onClick={() => setShowDepositModal(true)}
                className="py-2 px-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-extrabold text-[11px] flex flex-col items-center justify-center gap-0.5 shadow-md shadow-[#FF6B00]/25 transition-all cursor-pointer active:scale-95"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Recharger</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPayArtisanModal(true)}
                className="py-2 px-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-[11px] flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer active:scale-95 border border-white/10"
              >
                <Send className="w-3.5 h-3.5 text-orange-400" />
                <span>Payer Artisan</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPayoutModal(true)}
                className="py-2 px-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-[11px] flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer active:scale-95 border border-white/10"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                <span>Retirer</span>
              </button>
            </div>
          </div>

          {/* NOTICE: MOYENS DE PAIEMENT DU PAYS */}
          <div className="p-3 bg-orange-50/70 border border-orange-200/80 rounded-2xl flex items-center justify-between text-[11px] text-orange-950">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#FF6B00] shrink-0" />
              <span>
                Moyens Mobile Money actifs en <strong>{userCountry}</strong> : Orange Money, MTN MoMo, Moov Money, Wave.
              </span>
            </div>
          </div>

          {/* HISTORIQUE DES TRANSACTIONS */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-neutral-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-neutral-500" />
                Historique des Opérations
              </h3>

              {/* FILTRES */}
              <div className="flex items-center gap-1 text-[11px]">
                <Filter className="w-3.5 h-3.5 text-neutral-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-neutral-100 border border-neutral-200 rounded-lg px-2 py-1 font-bold text-neutral-700 cursor-pointer focus:outline-hidden"
                >
                  <option value="all">Toutes ({transactions.length})</option>
                  <option value="deposit">Recharges</option>
                  <option value="payment">Paiements</option>
                  <option value="payout">Retraits</option>
                  <option value="refund">Remboursements</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-neutral-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#FF6B00]" />
                <p>Chargement des opérations...</p>
              </div>
            ) : filteredTxs.length === 0 ? (
              <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-neutral-200/80 text-neutral-500 space-y-1">
                <Wallet className="w-8 h-8 text-neutral-300 mx-auto" />
                <p className="font-bold text-neutral-800">Aucune opération pour le moment</p>
                <p className="text-[11px]">Vos recharges et paiements apparaîtront ici avec leur reçu complet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTxs.map((tx) => {
                  const isPositive = tx.type === 'deposit' || tx.type === 'refund';
                  return (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="p-3 bg-white border border-neutral-200 hover:border-[#FF6B00]/40 rounded-2xl flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          tx.type === 'deposit'
                            ? 'bg-emerald-50 text-emerald-600'
                            : tx.type === 'payout'
                            ? 'bg-amber-50 text-amber-600'
                            : tx.type === 'refund'
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'bg-orange-50 text-[#FF6B00]'
                        }`}>
                          {tx.type === 'deposit' ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : tx.type === 'payout' ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : tx.type === 'refund' ? (
                            <RefreshCw className="w-4 h-4" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="block font-bold text-xs text-neutral-900 truncate">
                            {tx.description}
                          </span>
                          <span className="text-[10px] text-neutral-400 block truncate">
                            {new Date(tx.created_at).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })} • Réf : {tx.reference}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`block font-extrabold text-xs ${
                          isPositive ? 'text-emerald-600' : 'text-neutral-900'
                        }`}>
                          {isPositive ? '+' : '-'}{tx.amount_fcfa.toLocaleString('fr-FR')} FCFA
                        </span>
                        <span className={`inline-block px-1.5 py-0.2 rounded-md text-[9px] font-bold ${
                          tx.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : tx.status === 'pending'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {tx.status === 'completed' ? 'Validé' : tx.status === 'pending' ? 'En cours' : 'Échoué'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-[11px] text-neutral-500 shrink-0">
          <span className="flex items-center gap-1 text-[#FF6B00] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Transactions chiffrées & certifiées
          </span>
          <button
            onClick={loadWalletData}
            className="flex items-center gap-1 text-neutral-600 hover:text-neutral-900 font-bold cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Actualiser
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1 : RECHARGE PORTEFEUILLE (DEPOSIT)               */}
      {/* ======================================================== */}
      {showDepositModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden flex flex-col max-h-[82vh]">
            <div className="p-3.5 bg-neutral-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-[#FF6B00]" />
                <h3 className="font-extrabold text-sm">Recharger mon portefeuille</h3>
              </div>
              <button
                onClick={() => setShowDepositModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeposit} className="p-3.5 space-y-3 overflow-y-auto">
              {depositSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{depositSuccessMsg}</span>
                </div>
              )}

              {/* Montant prédéfini */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Montant à recharger (FCFA) *
                </label>
                <input
                  type="number"
                  min={100}
                  step={100}
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-black focus:outline-hidden focus:border-[#FF6B00]"
                />
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {[2000, 5000, 10000, 25000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDepositAmount(val)}
                      className={`py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        depositAmount === val
                          ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      {val.toLocaleString('fr-FR')} F
                    </button>
                  ))}
                </div>
              </div>

              {/* Prestataire de paiement Mobile Money */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Moyen de paiement ({userCountry}) *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'geniuspay', label: '⚡ GeniusPay Sandbox', desc: 'Orange, MTN, Moov, Wave (Test sécurisé)' },
                    { id: 'orange_money', label: 'Orange Money' },
                    { id: 'mtn_momo', label: 'MTN MoMo' },
                    { id: 'moov_money', label: 'Moov Money' },
                    { id: 'wave', label: 'Wave' }
                  ].map(prov => (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => setDepositProvider(prov.id as PaymentProvider)}
                      className={`p-2 rounded-xl border text-xs font-extrabold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                        prov.id === 'geniuspay' ? 'col-span-2 py-2.5 bg-orange-50/60' : ''
                      } ${
                        depositProvider === prov.id
                          ? `bg-orange-50 border-[#FF6B00] text-[#FF6B00] ring-2 ring-[#FF6B00]/30 shadow-xs`
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="flex items-center gap-1">{prov.label}</span>
                      {'desc' in prov && <span className="text-[10px] font-medium text-neutral-500">{prov.desc}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notice Sandbox GeniusPay */}
              <div className="p-3 rounded-2xl bg-orange-50/90 border border-[#FF6B00]/40 text-neutral-800 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-black text-[#FF6B00]">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Mode Test Sandbox Sécurisé ({depositProvider.replace('_', ' ').toUpperCase()})</span>
                </div>
                <p className="text-[11px] text-neutral-600 leading-relaxed">
                  Paiement géré par la passerelle <strong>GeniusPay</strong> (Sandbox). Aucun débit bancaire réel n'est effectué. La recharge est créée en statut <strong>pending</strong> et n'est créditée qu'après confirmation serveur avec protection anti-double crédit.
                </p>
                {onOpenDeployer && (
                  <button
                    type="button"
                    onClick={onOpenDeployer}
                    className="mt-1 text-[11px] font-bold text-[#FF6B00] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>⚡ Déployer les fonctions Edge sur Supabase bdsllohfaslkkupwsvyi</span>
                  </button>
                )}
              </div>

              {/* Bloc de suivi et vérification serveur GeniusPay */}
              {geniusPayPendingTx && (
                <div className="p-3.5 rounded-2xl bg-neutral-900 text-white space-y-2.5 border border-neutral-700 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-orange-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      Paiement en attente de vérification
                    </span>
                    <span className="text-xs font-mono font-bold bg-white/10 px-2 py-0.5 rounded-full text-white">
                      {geniusPayPendingTx.amount.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>

                  <div className="text-[11px] text-neutral-300 font-mono break-all bg-black/40 p-2 rounded-xl">
                    Réf: {geniusPayPendingTx.reference}
                  </div>

                  {geniusPayPendingTx.checkoutUrl && (
                    <a
                      href={geniusPayPendingTx.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-[#FF6B00]/30 transition-all"
                    >
                      <span>Ouvrir le guichet {depositProvider === 'wave' ? 'Wave' : depositProvider === 'mtn_momo' ? 'MTN MoMo' : 'GeniusPay'} (Sandbox) ↗</span>
                    </a>
                  )}

                  <button
                    type="button"
                    disabled={isVerifyingGeniusPay}
                    onClick={() => handleVerifyGeniusPay(geniusPayPendingTx.reference, geniusPayPendingTx.amount)}
                    className="w-full py-2.5 px-3 rounded-xl bg-white text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {isVerifyingGeniusPay ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FF6B00]" />
                        <span>Vérification auprès de GeniusPay...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Vérifier la confirmation serveur GeniusPay</span>
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-neutral-400 text-center">
                    Le portefeuille est crédité uniquement après confirmation officielle par GeniusPay.
                  </p>
                </div>
              )}

              {geniusPayStatusMsg && (
                <div className={`p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
                  geniusPayStatusMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : geniusPayStatusMsg.type === 'info'
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{geniusPayStatusMsg.text}</span>
                </div>
              )}

              {/* Numéro de téléphone */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Numéro Mobile Money du payeur *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+225 07..."
                  value={depositPhone}
                  onChange={(e) => setDepositPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              {/* Référence ou code reçu */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Référence du paiement / Reçu (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: MP240508..."
                  value={depositRef}
                  onChange={(e) => setDepositRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isProcessingDeposit}
                  className="w-full py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-[#FF6B00]/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {isProcessingDeposit ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmer la recharge de {depositAmount.toLocaleString('fr-FR')} FCFA</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2 : RETRAIT DES GAINS (PAYOUT)                    */}
      {/* ======================================================== */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden flex flex-col max-h-[82vh]">
            <div className="p-3.5 bg-neutral-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                <h3 className="font-extrabold text-sm">Retirer mes gains</h3>
              </div>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayout} className="p-3.5 space-y-3 overflow-y-auto">
              {payoutError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{payoutError}</span>
                </div>
              )}

              {payoutSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{payoutSuccessMsg}</span>
                </div>
              )}

              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs flex items-center justify-between">
                <span className="text-neutral-500">Solde disponible :</span>
                <span className="font-extrabold text-neutral-900">
                  {(wallet?.balance_fcfa || 0).toLocaleString('fr-FR')} FCFA
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Montant à retirer (FCFA) * (min 1 000 FCFA)
                </label>
                <input
                  type="number"
                  min={1000}
                  step={500}
                  required
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-black focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Recevoir sur le réseau *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'orange_money', label: 'Orange Money' },
                    { id: 'mtn_momo', label: 'MTN MoMo' },
                    { id: 'moov_money', label: 'Moov Money' },
                    { id: 'wave', label: 'Wave' }
                  ].map(prov => (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => setPayoutProvider(prov.id as PaymentProvider)}
                      className={`p-2 rounded-xl border text-xs font-extrabold text-center transition-all cursor-pointer ${
                        payoutProvider === prov.id
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-700 ring-2 ring-emerald-500/30'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {prov.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Numéro bénéficiaire *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+225 07..."
                  value={payoutPhone}
                  onChange={(e) => setPayoutPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isProcessingPayout}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {isProcessingPayout ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Demander le virement de {payoutAmount.toLocaleString('fr-FR')} FCFA</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3 : PAYER UN ARTISAN (DIRECT PAYMENT)              */}
      {/* ======================================================== */}
      {showPayArtisanModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden flex flex-col max-h-[82vh]">
            <div className="p-3.5 bg-neutral-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#FF6B00]" />
                <h3 className="font-extrabold text-sm">Payer un artisan</h3>
              </div>
              <button
                onClick={() => setShowPayArtisanModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayArtisan} className="p-3.5 space-y-3 overflow-y-auto">
              {payError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{payError}</span>
                </div>
              )}

              {paySuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{paySuccessMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Sélectionner l'Artisan bénéficiaire *
                </label>
                <select
                  required
                  value={selectedPayArtisanId}
                  onChange={(e) => setSelectedPayArtisanId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-800 cursor-pointer focus:outline-hidden focus:border-[#FF6B00]"
                >
                  <option value="">-- Choisir un artisan --</option>
                  {artisansList.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nom} • {a.metier} ({a.ville})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Montant de la prestation (FCFA) *
                </label>
                <input
                  type="number"
                  min={500}
                  step={500}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-black focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Description / Objet de l'intervention
                </label>
                <input
                  type="text"
                  placeholder="Ex: Réparation plomberie cuisine, Robinetterie..."
                  value={payDescription}
                  onChange={(e) => setPayDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 text-[11px] text-neutral-600 space-y-1">
                <div className="flex justify-between">
                  <span>Votre solde actuel :</span>
                  <strong>{(wallet?.balance_fcfa || 0).toLocaleString('fr-FR')} FCFA</strong>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Règlement direct :</span>
                  <span>100% sécurisé sans espèces</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isProcessingPay}
                  className="w-full py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-[#FF6B00]/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {isProcessingPay ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Envoyer {payAmount.toLocaleString('fr-FR')} FCFA</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4 : REÇU & DÉTAIL D'UNE TRANSACTION               */}
      {/* ======================================================== */}
      {selectedTx && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-sm">Reçu de Transaction Officiel</h3>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="text-center py-2 border-b border-neutral-200">
                <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold block">
                  Montant Transaction
                </span>
                <span className="text-2xl font-black text-neutral-900">
                  {selectedTx.amount_fcfa.toLocaleString('fr-FR')} FCFA
                </span>
                <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  selectedTx.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedTx.status === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {selectedTx.status === 'completed' ? 'Opération Validée ✅' : 'En Attente de Traitement'}
                </span>
              </div>

              <div className="space-y-2 bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/80">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Type d'opération :</span>
                  <strong className="text-neutral-900 capitalize">{selectedTx.type}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Date et heure :</span>
                  <span className="text-neutral-800 font-semibold">
                    {new Date(selectedTx.created_at).toLocaleString('fr-FR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Réseau / Canal :</span>
                  <span className="text-neutral-800 font-bold uppercase">{selectedTx.provider.replace('_', ' ')}</span>
                </div>
                {selectedTx.provider_ref && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Réf Fournisseur / Tel :</span>
                    <span className="text-neutral-800 font-mono font-semibold">{selectedTx.provider_ref}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-neutral-200">
                  <span className="text-neutral-500">Référence Unique :</span>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#FF6B00]">
                    <span>{selectedTx.reference}</span>
                    <button
                      type="button"
                      onClick={() => copyRefToClipboard(selectedTx.reference)}
                      className="p-1 hover:bg-neutral-200 rounded cursor-pointer"
                      title="Copier la référence"
                    >
                      {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-orange-50 rounded-2xl border border-orange-200/60 text-[11px] text-orange-900 leading-relaxed">
                Ce reçu constitue une preuve irréfutable de paiement émise par la plateforme ArtisanPro Afrique.
              </div>

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Fermer le reçu
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
