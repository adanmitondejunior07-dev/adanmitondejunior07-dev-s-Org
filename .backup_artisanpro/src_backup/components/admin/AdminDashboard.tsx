import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Users, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign, 
  Activity, 
  X, 
  Search, 
  Lock, 
  Trash2, 
  Check, 
  Eye, 
  Bell, 
  Send, 
  Image as ImageIcon,
  AlertCircle,
  FileCheck2,
  XCircle,
  Building2,
  Award,
  IdCard,
  User as UserIcon,
  CreditCard,
  ExternalLink,
  Crown,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_EMAIL } from '../../lib/supabase';
import { dataStore } from '../../lib/dataStore';
import { UserProfile, Publication, ProblemReport, ArtisanVerificationRequest, SubscriptionPaymentProof } from '../../types';

interface AdminDashboardProps {
  onClose: () => void;
}

type AdminTab = 'users' | 'messages' | 'subscriptions' | 'verifications' | 'broadcast' | 'posts' | 'reports';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  
  // Data state - ONLY REAL REGISTERED USERS & ACTUAL DATA
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [postsList, setPostsList] = useState<Publication[]>([]);
  const [reportsList, setReportsList] = useState<ProblemReport[]>([]);
  const [verificationsList, setVerificationsList] = useState<ArtisanVerificationRequest[]>([]);
  const [subscriptionsList, setSubscriptionsList] = useState<SubscriptionPaymentProof[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalArtisans: 0,
    totalPublications: 0,
    totalReports: 0,
    pendingVerifications: 0,
    pendingSubscriptions: 0
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [suspendedMap, setSuspendedMap] = useState<Record<string, boolean>>({});
  const [userFilter, setUserFilter] = useState<'all' | 'artisans' | 'clients' | 'suspended'>('all');
  const [suspendModalUser, setSuspendModalUser] = useState<UserProfile | null>(null);
  const [suspendReasonChoice, setSuspendReasonChoice] = useState('Non-respect des règles de la plateforme');

  // Chat conversations monitoring state
  const [conversationsList, setConversationsList] = useState<any[]>([]);
  const [selectedAdminConv, setSelectedAdminConv] = useState<any | null>(null);
  const [searchConvQuery, setSearchConvQuery] = useState('');

  // Image preview modal for documents
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState('');

  // Rejection modal KYC
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Rejection modal Subscriptions
  const [rejectingSubProofId, setRejectingSubProofId] = useState<string | null>(null);
  const [subRejectionReason, setSubRejectionReason] = useState('');

  // Broadcast notification state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Strict Security Check: ONLY adanmitondejunior07@gmail.com
  const isAuthorized = 
    isAdmin || 
    (user?.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim());

  const loadData = async () => {
    const list = await dataStore.getAllUsers();
    setUsersList(list);
    const map: Record<string, boolean> = {};
    list.forEach(u => {
      map[u.id] = dataStore.isUserSuspended(u.id);
    });
    setSuspendedMap(map);

    const pubs = await dataStore.getPublications();
    setPostsList(pubs);

    const convs = await dataStore.getAllConversationsForAdmin();
    setConversationsList(convs);

    const verifs = await dataStore.getVerificationRequests();
    setVerificationsList(verifs);

    const subs = await dataStore.getSubscriptionProofs();
    setSubscriptionsList(subs);

    const st = await dataStore.getAdminStats();
    setStats(st);

    const reps = (dataStore as any).getStored?.('admin_reports', []) || [];
    setReportsList(reps);
  };

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-red-200">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-extrabold text-neutral-900 mb-2">Accès Refusé (403)</h3>
          <p className="text-xs text-neutral-600 mb-6 leading-relaxed">
            Ce tableau de bord est strictement réservé au Super Administrateur <strong>{ADMIN_EMAIL}</strong>.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-neutral-900 text-white font-bold text-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const handleToggleSuspend = async (userId: string) => {
    const isCurrentlySusp = suspendedMap[userId];
    if (isCurrentlySusp) {
      if (confirm('Voulez-vous réactiver ce compte utilisateur ? Il pourra à nouveau publier et échanger.')) {
        await dataStore.toggleSuspendUser(userId);
        setSuspendedMap(prev => ({ ...prev, [userId]: false }));
        showToast('Compte réactivé avec succès');
      }
      return;
    }
    const target = usersList.find(u => u.id === userId);
    if (target) {
      setSuspendModalUser(target);
    }
  };

  const handleConfirmAdminSuspend = async () => {
    if (!suspendModalUser) return;
    await dataStore.toggleSuspendUser(suspendModalUser.id, suspendReasonChoice);
    setSuspendedMap(prev => ({ ...prev, [suspendModalUser.id]: true }));
    showToast(`Compte de ${suspendModalUser.full_name || suspendModalUser.email} suspendu pour non-respect des règles.`);
    setSuspendModalUser(null);
  };

  const handleDeletePost = async (postId: string) => {
    if (confirm('Supprimer définitivement cette publication ?')) {
      await dataStore.deletePublication(postId);
      setPostsList(prev => prev.filter(p => p.id !== postId));
      showToast('Publication supprimée.');
    }
  };

  const handleDeleteUser = async (u: UserProfile) => {
    if (confirm(`Supprimer définitivement l'utilisateur ${u.full_name || u.email} ?`)) {
      await dataStore.deleteUser(u.id);
      setUsersList(prev => prev.filter(user => user.id !== u.id));
      showToast(`Utilisateur ${u.full_name || u.email} supprimé.`);
    }
  };

  // VALIDATION ARTISAN (VALIDER ✅)
  const handleValidateVerification = async (req: ArtisanVerificationRequest) => {
    await dataStore.reviewVerificationRequest(req.id, 'verified');
    showToast(`Dossier de ${req.artisan_name} validé ! Badge bleu officiel attribué.`);
    await loadData();
  };

  // REFUS ARTISAN (REFUSER ❌)
  const handleOpenRejectModal = (requestId: string) => {
    setRejectingRequestId(requestId);
    setRejectionReason('Pièce d\'identité ou justificatif non conforme ou illisible.');
  };

  const handleConfirmRejection = async () => {
    if (!rejectingRequestId) return;
    await dataStore.reviewVerificationRequest(rejectingRequestId, 'rejected', rejectionReason.trim());
    showToast('Dossier refusé. Notification envoyée à l\'artisan.');
    setRejectingRequestId(null);
    setRejectionReason('');
    await loadData();
  };

  // SUBSCRIPTION PROOFS HANDLERS (GENIUSPAY)
  const handleValidateSubscription = async (proof: SubscriptionPaymentProof) => {
    const ok = await dataStore.validateSubscriptionProof(proof.id);
    if (ok) {
      showToast(`Abonnement ${proof.plan_name} validé pour ${proof.artisan_name} ! Badge bleu activé.`);
      await loadData();
    }
  };

  const handleOpenRejectSubModal = (id: string) => {
    setRejectingSubProofId(id);
    setSubRejectionReason('Capture de paiement illisible, incomplète ou non vérifiable sur GeniusPay.');
  };

  const handleConfirmRejectSubscription = async () => {
    if (!rejectingSubProofId) return;
    const ok = await dataStore.rejectSubscriptionProof(rejectingSubProofId, subRejectionReason.trim());
    if (ok) {
      showToast('Preuve d\'abonnement refusée. Notification envoyée.');
      setRejectingSubProofId(null);
      setSubRejectionReason('');
      await loadData();
    }
  };

  // SEND BROADCAST NOTIFICATION TO ALL USERS
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    setIsSendingBroadcast(true);
    try {
      const reachedCount = await dataStore.broadcastNotification(
        broadcastTitle,
        broadcastMessage,
        ADMIN_EMAIL
      );
      setBroadcastSuccess(`Notification diffusée avec succès à ${reachedCount} utilisateur(s) !`);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setTimeout(() => setBroadcastSuccess(''), 4000);
      showToast(`Notification envoyée à tous les utilisateurs !`);
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-60 bg-neutral-900 text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-2xl border border-neutral-700 animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Top Secret Header */}
        <div className="p-4 sm:p-5 bg-neutral-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6B00] text-white flex items-center justify-center shadow-md">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg tracking-tight">
                  Espace Administration Central
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-neutral-900 text-[10px] font-extrabold uppercase">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Connecté : <strong className="text-white">{ADMIN_EMAIL}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Statistics Cards - ONLY REAL DATA */}
        <div className="p-3 bg-neutral-50 border-b border-neutral-200 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center shrink-0">
          <div className="bg-white p-2.5 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[10px] text-neutral-500 font-semibold block">Vrais Membres</span>
            <span className="text-base font-extrabold text-neutral-900">{usersList.length}</span>
          </div>
          <div className="bg-white p-2.5 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[10px] text-neutral-500 font-semibold block">Artisans</span>
            <span className="text-base font-extrabold text-[#FF6B00]">
              {usersList.filter(u => u.role === 'artisan').length}
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[10px] text-neutral-500 font-semibold block">Discussions Chat</span>
            <span className="text-base font-extrabold text-indigo-600">
              {conversationsList.length}
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[10px] text-neutral-500 font-semibold block">Abonnements</span>
            <span className="text-base font-extrabold text-[#FF6600]">
              {subscriptionsList.filter(s => s.status === 'pending').length} attente
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[10px] text-neutral-500 font-semibold block">En attente KYC</span>
            <span className="text-base font-extrabold text-amber-600">
              {verificationsList.filter(v => v.status === 'pending').length}
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[10px] text-neutral-500 font-semibold block">Posts Actifs</span>
            <span className="text-base font-extrabold text-neutral-900">{postsList.length}</span>
          </div>
        </div>

        {/* Horizontal Navigation Tabs */}
        <div className="flex border-b border-neutral-200 bg-white overflow-x-auto text-xs font-bold shrink-0">
          {[
            { id: 'users' as AdminTab, label: `Utilisateurs (${usersList.length})`, icon: Users },
            { id: 'messages' as AdminTab, label: `💬 Discussions Chat (${conversationsList.length})`, icon: MessageSquare },
            { 
              id: 'subscriptions' as AdminTab, 
              label: `Abonnements GeniusPay (${subscriptionsList.filter(s => s.status === 'pending').length})`, 
              icon: CreditCard 
            },
            { 
              id: 'verifications' as AdminTab, 
              label: `Vérifications KYC (${verificationsList.filter(v => v.status === 'pending').length})`, 
              icon: FileCheck2 
            },
            { id: 'broadcast' as AdminTab, label: '📢 Alerte Générale', icon: Bell },
            { id: 'posts' as AdminTab, label: `Publications (${postsList.length})`, icon: FileText },
            { id: 'reports' as AdminTab, label: `Signalements (${reportsList.length})`, icon: AlertTriangle }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-3 flex items-center gap-1.5 shrink-0 border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[#FF6B00] text-[#FF6B00] bg-orange-50/40'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 text-xs">
          {/* TAB 1: REAL USERS LIST (ZERO DEMO USERS) */}
          {activeTab === 'users' && (
            <div className="space-y-3">
              {/* BANNIÈRE RÈGLES ADMIN : SEUL L'ADMIN PEUT SUSPENDRE OU SUPPRIMER */}
              <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900 shadow-xs">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="flex-1 leading-snug">
                  <span className="font-extrabold text-amber-950">Privilèges Administrateur exclusifs ✅ :</span> Seul l'administrateur a le droit de suspendre ou supprimer un compte pour non-respect des règles. Les utilisateurs ordinaires n'ont pas accès à ces actions ❌.
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer parmi les utilisateurs enregistrés..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-xs"
                  />
                </div>
                <button
                  onClick={() => setActiveTab('broadcast')}
                  className="px-3 py-2.5 rounded-xl bg-orange-50 text-[#FF6B00] font-bold border border-orange-200 flex items-center gap-1 shrink-0 cursor-pointer hover:bg-orange-100"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Alerte tous</span>
                </button>
              </div>

              <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                {usersList
                  .filter(u =>
                    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (u.metier || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (u.ville || '').toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(u => {
                    const isSusp = suspendedMap[u.id];
                    return (
                      <div key={u.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/80 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <img
                            src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.full_name)}&backgroundColor=FF6B00`}
                            alt={u.full_name}
                            className="w-9 h-9 rounded-full object-cover border border-neutral-200 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-neutral-900 text-xs">{u.full_name}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                u.role === 'admin'
                                  ? 'bg-amber-100 text-amber-900'
                                  : u.role === 'artisan'
                                  ? 'bg-orange-100 text-[#FF6B00]'
                                  : 'bg-neutral-100 text-neutral-700'
                              }`}>
                                {u.role}
                              </span>
                              {u.is_verified && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Certifié
                                </span>
                              )}
                              {isSusp && (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Suspendu (Non-respect des règles)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                              <span>{u.email}</span>
                              {u.telephone && <span> • 📞 {u.telephone}</span>}
                              {u.metier && <span> • {u.metier}</span>}
                              {u.ville && <span> • {u.ville} ({u.pays || 'Afrique'})</span>}
                            </div>
                          </div>
                        </div>

                        {u.role !== 'admin' && (
                          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap justify-start sm:justify-end">
                            {/* BOUTON OFFICIEL : Suspendre le compte (Non-respect des règles) OU Réactiver le compte */}
                            <button
                              type="button"
                              onClick={() => handleToggleSuspend(u.id)}
                              className={`px-3 py-2 rounded-xl font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                                isSusp
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600'
                                  : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                              }`}
                              title={isSusp ? "Réactiver ce compte" : "Suspendre le compte (Non-respect des règles)"}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>{isSusp ? 'Réactiver le compte' : 'Suspendre le compte (Non-respect des règles)'}</span>
                            </button>

                            {/* BOUTON OFFICIEL : Supprimer le compte (Admin uniquement) */}
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              title="Supprimer définitivement ce compte (Admin uniquement)"
                              className="px-2.5 py-2 rounded-xl bg-neutral-100 hover:bg-red-600 hover:text-white text-neutral-600 border border-neutral-200 hover:border-red-600 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="hidden sm:inline">Supprimer le compte</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 2: CHAT DISCUSSIONS AUDIT & MONITORING */}
          {activeTab === 'messages' && (
            <div className="space-y-3">
              {/* Privacy and Moderation notice */}
              <div className="p-3 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl flex items-start gap-2.5 text-indigo-950">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-extrabold text-xs block">
                    Audit et Surveillance des Échanges Privés
                  </span>
                  <p className="text-[11px] text-indigo-900 leading-relaxed">
                    Les discussions entre clients et artisans sont strictement privées dans leur interface. Cette vue centrale permet à l'administration d'auditer les messages échangés pour garantir la sécurité, vérifier les litiges et prévenir toute fraude.
                  </p>
                </div>
              </div>

              {/* Search discussions */}
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchConvQuery}
                  onChange={(e) => setSearchConvQuery(e.target.value)}
                  placeholder="Rechercher par nom de participant ou mot-clé..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              {conversationsList
                .filter(c => {
                  if (!searchConvQuery) return true;
                  const q = searchConvQuery.toLowerCase();
                  const nameA = (c.userA?.full_name || '').toLowerCase();
                  const nameB = (c.userB?.full_name || '').toLowerCase();
                  const lastMsg = (c.lastMessage?.text || '').toLowerCase();
                  return nameA.includes(q) || nameB.includes(q) || lastMsg.includes(q);
                })
                .length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-neutral-200 text-neutral-500">
                  <MessageSquare className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="font-bold text-neutral-800">Aucune discussion enregistrée</p>
                  <p className="text-[11px]">Dès qu'un client ou artisan démarre un chat ou envoie un message, il apparaîtra ici en temps réel.</p>
                </div>
              ) : (
                conversationsList
                  .filter(c => {
                    if (!searchConvQuery) return true;
                    const q = searchConvQuery.toLowerCase();
                    const nameA = (c.userA?.full_name || '').toLowerCase();
                    const nameB = (c.userB?.full_name || '').toLowerCase();
                    const lastMsg = (c.lastMessage?.text || '').toLowerCase();
                    return nameA.includes(q) || nameB.includes(q) || lastMsg.includes(q);
                  })
                  .map(conv => (
                    <div
                      key={conv.id}
                      className="p-3.5 bg-white border border-neutral-200/90 rounded-2xl shadow-xs space-y-2 hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* User A */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <img
                              src={conv.userA.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(conv.userA.full_name)}&backgroundColor=FF6B00`}
                              alt={conv.userA.full_name}
                              className="w-7 h-7 rounded-full object-cover border border-neutral-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-neutral-900 block truncate">{conv.userA.full_name}</span>
                              <span className="text-[9px] text-neutral-500 block uppercase font-bold">{conv.userA.role || 'Client'}</span>
                            </div>
                          </div>

                          <span className="text-neutral-400 font-bold px-1 text-xs shrink-0">↔</span>

                          {/* User B */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <img
                              src={conv.userB.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(conv.userB.full_name)}&backgroundColor=FF6B00`}
                              alt={conv.userB.full_name}
                              className="w-7 h-7 rounded-full object-cover border border-neutral-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-neutral-900 block truncate">{conv.userB.full_name}</span>
                              <span className="text-[9px] text-[#FF6B00] block uppercase font-bold">{conv.userB.role === 'artisan' ? (conv.userB.metier || 'Artisan') : 'Client'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 text-[10px] font-bold">
                            {conv.messagesCount} msg{conv.messagesCount > 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={async () => {
                              if (confirm('Supprimer cette conversation et tous ses messages ?')) {
                                await dataStore.deleteConversationForAdmin(conv.id);
                                setConversationsList(prev => prev.filter(c => c.id !== conv.id));
                                showToast('Discussion supprimée');
                              }
                            }}
                            className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg cursor-pointer transition-colors"
                            title="Supprimer la conversation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Last message preview */}
                      {conv.lastMessage && (
                        <div className="p-2 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-between text-[11px]">
                          <span className="text-neutral-600 truncate flex-1 pr-2">
                            <strong className="text-neutral-800">{conv.lastMessage.sender_name} :</strong> {conv.lastMessage.text}
                          </span>
                          <span className="text-[10px] text-neutral-400 shrink-0 font-medium">
                            {conv.lastMessageTime}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-neutral-400 font-mono truncate max-w-[180px]">
                          ID: {conv.id}
                        </span>
                        <button
                          onClick={() => setSelectedAdminConv(conv)}
                          className="px-3 py-1 rounded-xl bg-neutral-900 hover:bg-black text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Eye className="w-3 h-3 text-[#FF6B00]" />
                          <span>Inspecter ({conv.messagesCount})</span>
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* TAB: ABONNEMENTS GENIUSPAY (PREUVES DE PAIEMENT) */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 text-neutral-800 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <Crown className="w-4 h-4 text-[#FF6B00]" />
                  <p className="font-extrabold text-orange-950">Abonnements GeniusPay & Badges Bleus Pro :</p>
                </div>
                <p className="text-[11px] text-orange-900 leading-relaxed">
                  Vérifiez le reçu Mobile Money (Wave, Orange Money, MTN, Moov). Dès que vous cliquez sur <strong>Valider ✅</strong>, le <strong>Badge Bleu Pro</strong> et la protection sont automatiquement activés pour l'artisan avec sa date d'expiration (+1 mois ou +1 an).
                </p>
              </div>

              {subscriptionsList.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-neutral-200 text-neutral-500">
                  <CreditCard className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="font-bold text-neutral-800">Aucune preuve d'abonnement en attente</p>
                  <p className="text-[11px]">Les artisans effectuent leur paiement sur GeniusPay puis envoient leur reçu ici.</p>
                </div>
              ) : (
                subscriptionsList.map(proof => {
                  const isPending = proof.status === 'pending';
                  const isVal = proof.status === 'validated';
                  const isRej = proof.status === 'rejected';

                  return (
                    <div
                      key={proof.id}
                      className={`p-4 bg-white border rounded-2xl space-y-3.5 shadow-xs ${
                        isPending ? 'border-orange-300 ring-2 ring-orange-100' : 'border-neutral-200'
                      }`}
                    >
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-neutral-900 text-sm">{proof.artisan_name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              isVal ? 'bg-emerald-100 text-emerald-800' :
                              isRej ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-900'
                            }`}>
                              {isVal ? 'Validé ✅' : isRej ? 'Refusé ❌' : 'En attente ⏳'}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            {proof.artisan_email}
                          </p>
                        </div>

                        <span className="text-[10px] text-neutral-400 shrink-0 font-medium">
                          {new Date(proof.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {/* Plan Details & GeniusPay Link */}
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-black text-xs text-neutral-900">
                            <Crown className="w-3.5 h-3.5 text-[#FF6B00]" />
                            <span>{proof.plan_name} ({proof.period.toUpperCase()})</span>
                            <span className="text-[#FF6B00]">• {proof.amount_fcfa.toLocaleString('fr-FR')} FCFA</span>
                          </div>
                          {proof.transaction_ref && (
                            <p className="text-[10px] text-neutral-500 font-mono">
                              Réf transaction : <strong className="text-neutral-700">{proof.transaction_ref}</strong>
                            </p>
                          )}
                          {proof.notes && (
                            <p className="text-[10px] text-neutral-600 italic">
                              Note : "{proof.notes}"
                            </p>
                          )}
                        </div>

                        {proof.product_url && (
                          <a
                            href={proof.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-[#FF6B00] font-extrabold text-[11px] transition-colors self-start sm:self-center"
                          >
                            <span>Lien GeniusPay cliqué</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Payment Proof Screenshot */}
                      <div>
                        <span className="font-bold text-neutral-700 text-[11px] block mb-1.5">
                          📸 Capture d'écran du reçu GeniusPay :
                        </span>
                        {proof.payment_proof_url ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewImageUrl(proof.payment_proof_url);
                              setPreviewImageTitle(`Reçu de paiement - ${proof.artisan_name} (${proof.plan_name})`);
                            }}
                            className="group relative rounded-xl overflow-hidden border border-neutral-300 block max-w-xs h-32 cursor-pointer bg-neutral-100"
                          >
                            <img
                              src={proof.payment_proof_url}
                              alt="Preuve GeniusPay"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity gap-1">
                              <Eye className="w-4 h-4" /> Agrandir le reçu
                            </div>
                          </button>
                        ) : (
                          <span className="text-xs text-red-500 font-medium">Reçu manquant ❌</span>
                        )}
                      </div>

                      {/* Expiration date if validated */}
                      {isVal && proof.expires_at && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Badge bleu actif • Expire le <strong>{new Date(proof.expires_at).toLocaleDateString('fr-FR')}</strong>
                          </span>
                        </div>
                      )}

                      {/* Rejection notice if rejected */}
                      {isRej && proof.rejection_reason && (
                        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px]">
                          <strong>Motif du refus :</strong> {proof.rejection_reason}
                        </div>
                      )}

                      {/* Action Buttons for Pending */}
                      {isPending && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                          <button
                            type="button"
                            onClick={() => handleOpenRejectSubModal(proof.id)}
                            className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Refuser ❌</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleValidateSubscription(proof)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm shadow-emerald-600/30"
                          >
                            <Check className="w-4 h-4" />
                            <span>Valider l'abonnement ✅</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: VERIFICATION REQUESTS WITH THE 4 REQUIRED PIECES & BUTTONS VALIDER ✅ / REFUSER ❌ */}
          {activeTab === 'verifications' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200 text-neutral-800 text-xs">
                <p className="font-semibold mb-1 text-orange-950">📋 Contrôle des 4 pièces obligatoires pour certification :</p>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-orange-900">
                  <span>1. 🪪 CNI ou Passeport</span>
                  <span>2. 👤 Photo de l'artisan</span>
                  <span>3. 🏭 Photo de l'atelier</span>
                  <span>4. 📜 Attestation / diplôme</span>
                </div>
              </div>

              {verificationsList.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-neutral-200 text-neutral-500">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-neutral-800">Aucun dossier de vérification en attente</p>
                  <p className="text-[11px]">Les artisans déposent leur dossier depuis les paramètres de leur compte.</p>
                </div>
              ) : (
                verificationsList.map(req => {
                  const isPending = req.status === 'pending';
                  const isVerified = req.status === 'verified';
                  const isRejected = req.status === 'rejected';

                  return (
                    <div 
                      key={req.id} 
                      className={`p-4 bg-white border rounded-2xl space-y-3.5 shadow-xs ${
                        isPending ? 'border-amber-300 ring-2 ring-amber-100' : 'border-neutral-200'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-neutral-900 text-sm">{req.artisan_name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              isVerified ? 'bg-emerald-100 text-emerald-800' :
                              isRejected ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-900'
                            }`}>
                              {isVerified ? 'Validé ✅' : isRejected ? 'Refusé ❌' : 'En attente ⏳'}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            {req.artisan_email} • <strong>{req.metier}</strong> à {req.ville} ({req.pays || 'Afrique'})
                          </p>
                          {req.cni_number && (
                            <p className="text-[11px] text-neutral-600 font-mono mt-0.5">
                              N° Document : {req.cni_number}
                            </p>
                          )}
                          {req.notes && (
                            <p className="text-[11px] text-neutral-600 italic mt-0.5">
                              Note artisan : "{req.notes}"
                            </p>
                          )}
                        </div>

                        <span className="text-[10px] text-neutral-400 shrink-0 font-medium">
                          {new Date(req.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>

                      {/* LES 4 PIÈCES À FOURNIR OBLIGATOIRES */}
                      <div>
                        <span className="font-bold text-neutral-700 text-[11px] block mb-2">
                          Les 4 pièces justificatives fournies :
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {/* 1. CNI OU PASSEPORT */}
                          <div className="border border-neutral-200 rounded-xl p-2 bg-neutral-50 text-center flex flex-col justify-between">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-neutral-700 mb-1">
                              <IdCard className="w-3.5 h-3.5 text-[#FF6B00]" />
                              <span>1. CNI / Passeport</span>
                            </div>
                            {req.cni_url ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewImageUrl(req.cni_url);
                                  setPreviewImageTitle(`CNI / Passeport - ${req.artisan_name}`);
                                }}
                                className="group relative rounded-lg overflow-hidden border border-neutral-300 block w-full h-20 cursor-pointer"
                              >
                                <img src={req.cni_url} alt="CNI" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                                  <Eye className="w-3.5 h-3.5 mr-1" /> Agrandir
                                </div>
                              </button>
                            ) : (
                              <span className="text-[10px] text-red-500 font-medium py-4 block">Non fournie ❌</span>
                            )}
                          </div>

                          {/* 2. PHOTO DE VOUS */}
                          <div className="border border-neutral-200 rounded-xl p-2 bg-neutral-50 text-center flex flex-col justify-between">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-neutral-700 mb-1">
                              <UserIcon className="w-3.5 h-3.5 text-[#FF6B00]" />
                              <span>2. Photo de vous</span>
                            </div>
                            {req.selfie_url ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewImageUrl(req.selfie_url);
                                  setPreviewImageTitle(`Photo de l'artisan - ${req.artisan_name}`);
                                }}
                                className="group relative rounded-lg overflow-hidden border border-neutral-300 block w-full h-20 cursor-pointer"
                              >
                                <img src={req.selfie_url} alt="Selfie" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                                  <Eye className="w-3.5 h-3.5 mr-1" /> Agrandir
                                </div>
                              </button>
                            ) : (
                              <span className="text-[10px] text-red-500 font-medium py-4 block">Non fournie ❌</span>
                            )}
                          </div>

                          {/* 3. PHOTO DE VOTRE ATELIER */}
                          <div className="border border-neutral-200 rounded-xl p-2 bg-neutral-50 text-center flex flex-col justify-between">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-neutral-700 mb-1">
                              <Building2 className="w-3.5 h-3.5 text-[#FF6B00]" />
                              <span>3. Photo Atelier</span>
                            </div>
                            {req.atelier_url ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewImageUrl(req.atelier_url);
                                  setPreviewImageTitle(`Atelier de travail - ${req.artisan_name}`);
                                }}
                                className="group relative rounded-lg overflow-hidden border border-neutral-300 block w-full h-20 cursor-pointer"
                              >
                                <img src={req.atelier_url} alt="Atelier" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                                  <Eye className="w-3.5 h-3.5 mr-1" /> Agrandir
                                </div>
                              </button>
                            ) : (
                              <span className="text-[10px] text-red-500 font-medium py-4 block">Non fournie ❌</span>
                            )}
                          </div>

                          {/* 4. ATTESTATION DIPLOME OU CERTIFICAT */}
                          <div className="border border-neutral-200 rounded-xl p-2 bg-neutral-50 text-center flex flex-col justify-between">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-neutral-700 mb-1">
                              <Award className="w-3.5 h-3.5 text-[#FF6B00]" />
                              <span>4. Attestation / Diplôme</span>
                            </div>
                            {req.diplome_url ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewImageUrl(req.diplome_url);
                                  setPreviewImageTitle(`Diplôme / Attestation - ${req.artisan_name}`);
                                }}
                                className="group relative rounded-lg overflow-hidden border border-neutral-300 block w-full h-20 cursor-pointer"
                              >
                                <img src={req.diplome_url} alt="Diplome" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                                  <Eye className="w-3.5 h-3.5 mr-1" /> Agrandir
                                </div>
                              </button>
                            ) : (
                              <span className="text-[10px] text-red-500 font-medium py-4 block">Non fournie ❌</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Rejection notice if rejected */}
                      {req.rejection_reason && (
                        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px]">
                          <strong>Motif du refus :</strong> {req.rejection_reason}
                        </div>
                      )}

                      {/* LES 2 BOUTONS EXCLUSIFS : REFUSER ❌ ET VALIDER ✅ */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                        <button
                          type="button"
                          onClick={() => handleOpenRejectModal(req.id)}
                          className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Refuser ❌</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleValidateVerification(req)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm shadow-emerald-600/30"
                        >
                          <Check className="w-4 h-4" />
                          <span>Valider ✅</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: BROADCAST NOTIFICATION TO ALL USERS */}
          {activeTab === 'broadcast' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500 to-[#FF6B00] text-white">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="w-5 h-5" />
                  <h3 className="font-extrabold text-sm sm:text-base">Diffusion d'une notification à tous les utilisateurs</h3>
                </div>
                <p className="text-xs text-white/90 leading-relaxed">
                  Envoyez une annonce officielle ou une alerte directe à chaque membre inscrit sur la plateforme ArtisanPro Afrique.
                </p>
              </div>

              {broadcastSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>{broadcastSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSendBroadcast} className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    Titre de la notification *
                  </label>
                  <input
                    type="text"
                    required
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="Ex: Mise à jour majeure ou Nouvelle opportunité pour les artisans"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    Message complet *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Rédigez le message qui sera immédiatement reçu par tous les utilisateurs..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00] leading-relaxed"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSendingBroadcast || !broadcastTitle.trim() || !broadcastMessage.trim()}
                    className="w-full py-3 px-4 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-40 text-white font-extrabold text-xs shadow-md shadow-[#FF6B00]/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {isSendingBroadcast ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Envoyer la notification à tous les utilisateurs ({usersList.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: POSTS MODERATION */}
          {activeTab === 'posts' && (
            <div className="space-y-3">
              {/* BANNIÈRE RÈGLES SUPPRESSION ADMIN */}
              <div className="p-3 bg-red-50/90 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-950">
                <Trash2 className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-extrabold block">
                    Modération et Suppression des Publications (Droits Administrateur)
                  </span>
                  <p className="text-[11px] text-red-900 leading-relaxed">
                    Chaque utilisateur ordinaire ne peut supprimer que sa propre publication ❌. En tant qu'<strong>Administrateur ✅</strong>, vous avez le droit de supprimer <strong>n'importe quelle publication</strong> directement ici ou sur le fil d'actualité.
                  </p>
                </div>
              </div>

              {postsList.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-neutral-200 text-neutral-500">
                  <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="font-bold text-neutral-800">Aucune publication active</p>
                  <p className="text-[11px]">Toutes les publications démo ont été nettoyées.</p>
                </div>
              ) : (
                postsList.map(p => (
                  <div key={p.id} className="p-3.5 bg-white border border-neutral-200 rounded-2xl flex items-start justify-between gap-3 shadow-xs">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-neutral-900">{p.artisan_name}</span>
                        <span className="text-[10px] text-neutral-400">{p.location || 'Afrique'}</span>
                        <span className="text-[10px] text-neutral-400">• {new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
                        {p.media_type === 'video' && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#FF6B00] text-[9px] font-extrabold uppercase">
                            Vidéo
                          </span>
                        )}
                      </div>
                      <p className="text-neutral-700 text-xs line-clamp-2 leading-relaxed">{p.content}</p>
                      {p.media_url && (
                        <div className="mt-2 w-20 h-16 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 flex items-center justify-center">
                          {p.media_type === 'video' ? (
                            <video src={p.media_url} className="w-full h-full object-cover" />
                          ) : (
                            <img src={p.media_url} alt="Media" className="w-full h-full object-cover" />
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePost(p.id)}
                      className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs"
                      title="Supprimer définitivement cette publication (Droit Admin)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer 🗑</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 5: REPORTS (SIGNALEMENTS) */}
          {activeTab === 'reports' && (
            <div className="space-y-3">
              {reportsList.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-neutral-200 text-neutral-500">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-neutral-800">Aucun signalement</p>
                  <p className="text-[11px]">Tout est en ordre dans la communauté.</p>
                </div>
              ) : (
                reportsList.map(r => (
                  <div key={r.id} className="p-3.5 bg-white border border-neutral-200 rounded-2xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-red-600 uppercase text-[10px] tracking-wide bg-red-50 px-2 py-0.5 rounded-md">
                        {r.category}
                      </span>
                      <span className="text-neutral-400 text-[10px]">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p className="text-neutral-800 text-xs">{r.description}</p>
                    <p className="text-neutral-400 text-[10px]">Signalé par : {r.user_email}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* FULLSIZE IMAGE PREVIEW MODAL */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative max-w-xl w-full bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl p-3 flex flex-col items-center">
            <div className="w-full flex items-center justify-between p-2 text-white border-b border-neutral-800 mb-2">
              <span className="font-bold text-xs truncate">{previewImageTitle}</span>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img 
              src={previewImageUrl} 
              alt="Aperçu document" 
              className="max-h-[75vh] w-auto object-contain rounded-2xl" 
            />
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingRequestId && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-red-200 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-6 h-6" />
              <h3 className="font-extrabold text-base text-neutral-900">Refuser la certification ❌</h3>
            </div>
            <p className="text-xs text-neutral-600">
              Veuillez spécifier la raison du refus qui sera notifiée à l'artisan pour lui permettre de corriger son dossier :
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-red-500"
              placeholder="Ex: Photo d'atelier manquante ou CNI illisible..."
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingRequestId(null)}
                className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 font-bold text-xs cursor-pointer text-neutral-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 font-extrabold text-xs text-white cursor-pointer"
              >
                Confirmer le refus ❌
              </button>
            </div>
          </div>
        </div>
      )}
      {/* REJECTION REASON MODAL FOR SUBSCRIPTION PROOF */}
      {rejectingSubProofId && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-red-200 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-6 h-6" />
              <h3 className="font-extrabold text-base text-neutral-900">Refuser le reçu d'abonnement ❌</h3>
            </div>
            <p className="text-xs text-neutral-600">
              Veuillez spécifier la raison du refus (capture illisible, transaction introuvable sur GeniusPay, etc.) qui sera notifiée à l'artisan :
            </p>
            <textarea
              rows={3}
              value={subRejectionReason}
              onChange={(e) => setSubRejectionReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-red-500"
              placeholder="Ex: Reçu GeniusPay illisible ou montant incorrect..."
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingSubProofId(null)}
                className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 font-bold text-xs cursor-pointer text-neutral-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectSubscription}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 font-extrabold text-xs text-white cursor-pointer"
              >
                Confirmer le refus ❌
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT DISCUSSION MODAL FOR ADMIN */}
      {selectedAdminConv && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-lg w-full shadow-2xl border border-neutral-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-neutral-900 truncate">
                  <span>{selectedAdminConv.userA.full_name}</span>
                  <span className="text-neutral-400">↔</span>
                  <span>{selectedAdminConv.userB.full_name}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-neutral-500 mt-0.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Discussion Privée • Surveillance Sécurité Admin</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAdminConv(null)}
                className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {selectedAdminConv.messages.length === 0 ? (
                <div className="text-center text-xs text-neutral-400 py-8">
                  Aucun message texte dans cette discussion.
                </div>
              ) : (
                selectedAdminConv.messages.map((m: any) => (
                  <div key={m.id} className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-neutral-500">
                      <span className="font-extrabold text-[#FF6B00]">{m.sender_name}</span>
                      <span>{new Date(m.created_at).toLocaleString('fr-FR')}</span>
                    </div>
                    <p className="text-xs text-neutral-900 whitespace-pre-line leading-relaxed font-normal">
                      {m.text}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
              <span className="text-[10px] text-neutral-400">
                Total : {selectedAdminConv.messagesCount} message(s)
              </span>
              <button
                onClick={() => setSelectedAdminConv(null)}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black text-white font-bold text-xs cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUSPENSION DE COMPTE POUR ADMIN (NON-RESPECT DES RÈGLES) */}
      {suspendModalUser && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-red-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-11 h-11 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-neutral-900 leading-tight">
                  Suspendre le compte (Non-respect des règles)
                </h3>
                <span className="text-[10px] text-red-600 font-extrabold uppercase tracking-wider">
                  Action réservée à l'administrateur
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Êtes-vous sûr de vouloir suspendre le compte de <strong className="text-neutral-900 font-bold">{suspendModalUser.full_name || suspendModalUser.email}</strong> ?
              Ce compte ne pourra plus publier d'offres ni échanger de messages tant que la suspension reste active.
            </p>

            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                Motif de la suspension :
              </label>
              <select
                value={suspendReasonChoice}
                onChange={(e) => setSuspendReasonChoice(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-red-500 bg-neutral-50 font-medium"
              >
                <option value="Non-respect des règles de la plateforme">Non-respect des règles de la plateforme</option>
                <option value="Comportement inapproprié, insultes ou harcèlement">Comportement inapproprié, insultes ou harcèlement</option>
                <option value="Suspicion de fraude ou arnaque aux devis">Suspicion de fraude ou arnaque aux devis</option>
                <option value="Prestations non honorées répétées">Prestations non honorées répétées</option>
                <option value="Usurpation d'identité ou faux profil">Usurpation d'identité ou faux profil</option>
                <option value="Spam ou publicités répétées non autorisées">Spam ou publicités répétées non autorisées</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSuspendModalUser(null)}
                className="px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 font-bold text-xs cursor-pointer text-neutral-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmAdminSuspend}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 font-extrabold text-xs text-white cursor-pointer shadow-md shadow-red-600/20"
              >
                Confirmer la suspension ❌
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
