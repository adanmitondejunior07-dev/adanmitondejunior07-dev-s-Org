import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  CheckCircle, 
  Heart, 
  MessageCircle, 
  ShieldCheck, 
  Sparkles, 
  CheckCheck,
  Wallet,
  Navigation,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AppNotification } from '../../types';
import { dataStore } from '../../lib/dataStore';

interface NotificationsModalProps {
  onClose: () => void;
  onOpenVerification?: () => void;
  onOpenWallet?: () => void;
  onOpenAdmin?: () => void;
  onOpenChat?: (targetId?: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ 
  onClose,
  onOpenVerification,
  onOpenWallet,
  onOpenAdmin,
  onOpenChat
}) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filterUnread, setFilterUnread] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);
  const userId = user?.id || 'me';

  const refreshNotifications = () => {
    dataStore.getNotifications(userId).then(setNotifications);
  };

  useEffect(() => {
    refreshNotifications();
  }, [userId]);

  const handleMarkAsRead = async (notifId: string) => {
    await dataStore.markNotificationAsRead(userId, notifId);
    setNotifications(prev =>
      prev.map(n => (n.id === notifId ? { ...n, is_read: true } : n))
    );
    if (selectedNotif && selectedNotif.id === notifId) {
      setSelectedNotif(prev => prev ? { ...prev, is_read: true } : null);
    }
  };

  const handleMarkAllRead = async () => {
    await dataStore.markAllNotificationsRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    if (selectedNotif) {
      setSelectedNotif(prev => prev ? { ...prev, is_read: true } : null);
    }
  };

  const handleOpenPageFromNotif = (notif: AppNotification) => {
    handleMarkAsRead(notif.id);
    onClose();

    if (notif.target_page === 'verification' || notif.type === 'verification') {
      onOpenVerification?.();
      return;
    }
    if (notif.target_page === 'admin') {
      onOpenAdmin?.();
      return;
    }
    if (notif.target_page === 'wallet' || notif.type === 'wallet') {
      onOpenWallet?.();
      return;
    }
    if (notif.target_page === 'chat' || notif.type === 'message') {
      onOpenChat?.(notif.target_id);
      return;
    }
  };

  const filteredNotifs = filterUnread
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const getNotifIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'verification':
        return <ShieldCheck className="w-4 h-4 text-[#FF6B1A]" />;
      case 'wallet':
        return <Wallet className="w-4 h-4 text-emerald-600" />;
      case 'mission':
        return <Navigation className="w-4 h-4 text-amber-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-[#FF6B1A]" />;
    }
  };

  const getNotifBadgeLabel = (type: AppNotification['type']) => {
    switch (type) {
      case 'verification':
        return 'Vérification Officielle';
      case 'wallet':
        return 'Portefeuille';
      case 'mission':
        return 'Mission GPS';
      case 'message':
        return 'Message';
      case 'comment':
        return 'Commentaire';
      case 'like':
        return 'J\'aime';
      default:
        return 'Information';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            {selectedNotif ? (
              <button
                type="button"
                onClick={() => setSelectedNotif(null)}
                className="w-9 h-9 rounded-xl bg-white border border-neutral-200 text-neutral-700 hover:text-neutral-900 flex items-center justify-center cursor-pointer shadow-xs transition-colors"
                title="Retour à la liste"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#FF6B1A] flex items-center justify-center shadow-xs">
                <Bell className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="font-extrabold text-base text-neutral-900 leading-tight">
                {selectedNotif ? 'Détail de la notification' : 'Centre de Notifications'}
              </h3>
              <p className="text-[11px] text-neutral-500">
                {selectedNotif ? 'Informations et actions directes' : 'Vos alertes et actualités en temps réel'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-200/60 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* VUE DÉTAILLÉE DE LA NOTIFICATION SÉLECTIONNÉE                     */}
        {/* ------------------------------------------------------------------ */}
        {selectedNotif ? (
          <div className="p-5 overflow-y-auto space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Type Badge & Date */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-[#FF6B1A] border border-orange-200 text-[11px] font-extrabold">
                  {getNotifIcon(selectedNotif.type)}
                  <span>{getNotifBadgeLabel(selectedNotif.type)}</span>
                </span>
                <span className="text-[11px] text-neutral-400 font-medium">
                  {new Date(selectedNotif.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {/* Title & Full Message */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                <h2 className="font-extrabold text-sm sm:text-base text-neutral-900 leading-snug">
                  {selectedNotif.title}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                  {selectedNotif.message}
                </p>
              </div>

              {/* Status pill */}
              <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
                <span>Statut de lecture :</span>
                <span className={`font-bold ${selectedNotif.is_read ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {selectedNotif.is_read ? 'Lue ✅' : 'Non lue 🔔'}
                </span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-3 border-t border-neutral-100">
              {/* Direct Deep link Button */}
              {(selectedNotif.target_page || selectedNotif.type === 'verification' || selectedNotif.type === 'wallet' || selectedNotif.type === 'message') && (
                <button
                  type="button"
                  onClick={() => handleOpenPageFromNotif(selectedNotif)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#FF6B1A] hover:bg-[#e05e00] text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-[#FF6B1A]/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {selectedNotif.target_page === 'verification' || selectedNotif.type === 'verification' ? (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Accéder à mon dossier de vérification</span>
                    </>
                  ) : selectedNotif.target_page === 'admin' ? (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Ouvrir le panneau Administrateur</span>
                    </>
                  ) : selectedNotif.target_page === 'wallet' || selectedNotif.type === 'wallet' ? (
                    <>
                      <Wallet className="w-4 h-4" />
                      <span>Ouvrir mon Portefeuille</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4" />
                      <span>Accéder à la messagerie</span>
                    </>
                  )}
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedNotif(null)}
                className="w-full py-2.5 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs transition-colors cursor-pointer text-center"
              >
                Retour aux notifications
              </button>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------------ */
          /* LISTE PRINCIPALE DES NOTIFICATIONS                                 */
          /* ------------------------------------------------------------------ */
          <>
            {/* Filter & Action bar */}
            <div className="px-5 py-2.5 bg-white border-b border-neutral-100 flex items-center justify-between text-xs shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterUnread(false)}
                  className={`px-3 py-1 rounded-full font-bold text-[11px] transition-colors cursor-pointer ${
                    !filterUnread
                      ? 'bg-[#FF6B1A] text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  Toutes ({notifications.length})
                </button>
                <button
                  onClick={() => setFilterUnread(true)}
                  className={`px-3 py-1 rounded-full font-bold text-[11px] transition-colors cursor-pointer ${
                    filterUnread
                      ? 'bg-[#FF6B1A] text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  Non lues ({notifications.filter(n => !n.is_read).length})
                </button>
              </div>

              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-[#FF6B1A] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tout marquer lu</span>
              </button>
            </div>

            {/* List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {filteredNotifs.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-neutral-800 text-sm mb-1">
                    Aucune notification
                  </h4>
                  <p className="text-xs text-neutral-500">
                    Vous êtes parfaitement à jour !
                  </p>
                </div>
              ) : (
                filteredNotifs.map((notif) => {
                  return (
                    <div
                      key={notif.id}
                      onClick={() => {
                        handleMarkAsRead(notif.id);
                        setSelectedNotif(notif);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 items-start group ${
                        notif.is_read
                          ? 'bg-white border-neutral-200/80 hover:bg-neutral-50'
                          : 'bg-orange-50/60 border-orange-200/80 shadow-xs hover:bg-orange-50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-white border border-neutral-200/70 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        {getNotifIcon(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className={`text-xs ${notif.is_read ? 'font-semibold text-neutral-800' : 'font-extrabold text-neutral-900'}`}>
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-neutral-400 font-medium shrink-0 ml-2">
                            {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600 leading-relaxed line-clamp-2">
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-neutral-100/60">
                          <span className="text-[10px] text-neutral-400 font-semibold">
                            {getNotifBadgeLabel(notif.type)}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-[#FF6B1A] font-bold group-hover:underline">
                            <span>Voir détails</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>

                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#FF6B1A] shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
