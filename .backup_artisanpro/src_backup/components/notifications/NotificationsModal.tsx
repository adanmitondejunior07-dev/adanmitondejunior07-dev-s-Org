import React, { useState, useEffect } from 'react';
import { X, Bell, CheckCircle, Heart, MessageCircle, ShieldCheck, Sparkles, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AppNotification } from '../../types';
import { dataStore } from '../../lib/dataStore';

interface NotificationsModalProps {
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filterUnread, setFilterUnread] = useState(false);
  const userId = user?.id || 'me';

  useEffect(() => {
    dataStore.getNotifications(userId).then(setNotifications);
  }, [userId]);

  const handleMarkAsRead = async (notifId: string) => {
    await dataStore.markNotificationAsRead(userId, notifId);
    setNotifications(prev =>
      prev.map(n => (n.id === notifId ? { ...n, is_read: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await dataStore.markAllNotificationsRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
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
        return <ShieldCheck className="w-4 h-4 text-[#FF6B00]" />;
      default:
        return <Sparkles className="w-4 h-4 text-[#FF6B00]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-neutral-900 leading-tight">
                Notifications
              </h3>
              <p className="text-[11px] text-neutral-500">
                Vos alertes et actualités en temps réel
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

        {/* Filter & Action bar */}
        <div className="px-5 py-2.5 bg-white border-b border-neutral-100 flex items-center justify-between text-xs">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterUnread(false)}
              className={`px-3 py-1 rounded-full font-bold text-[11px] transition-colors cursor-pointer ${
                !filterUnread
                  ? 'bg-[#FF6B00] text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Toutes ({notifications.length})
            </button>
            <button
              onClick={() => setFilterUnread(true)}
              className={`px-3 py-1 rounded-full font-bold text-[11px] transition-colors cursor-pointer ${
                filterUnread
                  ? 'bg-[#FF6B00] text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Non lues ({notifications.filter(n => !n.is_read).length})
            </button>
          </div>

          <button
            onClick={handleMarkAllRead}
            className="text-[11px] text-[#FF6B00] font-bold hover:underline flex items-center gap-1 cursor-pointer"
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
            filteredNotifs.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleMarkAsRead(notif.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 items-start ${
                  notif.is_read
                    ? 'bg-white border-neutral-200/80 hover:bg-neutral-50'
                    : 'bg-orange-50/60 border-orange-200/80 shadow-xs'
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
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    {notif.message}
                  </p>
                </div>

                {!notif.is_read && (
                  <span className="w-2 h-2 rounded-full bg-[#FF6B00] shrink-0 mt-1.5" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
