import React from 'react';
import { Users, ShoppingBag, MessageSquare, User, Navigation, Globe, Film } from 'lucide-react';

export type TabType = 'request' | 'artisan' | 'marketplace' | 'chat' | 'wallet' | 'profil' | 'social' | 'video';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadChatCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  unreadChatCount = 0
}) => {
  const tabs = [
    { id: 'social' as TabType, label: 'Social', icon: Globe },
    { id: 'video' as TabType, label: 'Vidéo', icon: Film },
    { id: 'artisan' as TabType, label: 'Artisans', icon: Users },
    { id: 'request' as TabType, label: 'Demander', icon: Navigation, isSpecial: true },
    { id: 'marketplace' as TabType, label: 'Boutique', icon: ShoppingBag },
    { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare, badge: unreadChatCount },
    { id: 'profil' as TabType, label: 'Profil', icon: User }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-neutral-200/90 shadow-lg">
      <div className="max-w-md mx-auto px-0.5 py-1 flex items-center justify-between">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isSpecial) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="flex-1 flex flex-col items-center justify-center py-0.5 px-0.5 transition-all relative cursor-pointer select-none group min-w-0"
                title="Demander un Artisan GPS (Normal ou Urgent)"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FF6B1A] text-white flex items-center justify-center shadow-md shadow-[#FF6B1A]/30 group-active:scale-95 transition-transform">
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
                <span className="text-[9px] tracking-tight font-extrabold text-[#FF6B1A] mt-0.5 leading-none truncate max-w-full">
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all relative cursor-pointer select-none min-w-0 ${
                isActive
                  ? 'text-[#FF6B1A] font-bold'
                  : 'text-neutral-500 hover:text-neutral-800 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-4 h-4 transition-transform duration-150 ${
                    isActive ? 'scale-110 stroke-[2.4px]' : 'stroke-[1.8px]'
                  }`}
                />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-1.5 bg-[#FF6B1A] text-white text-[7px] font-extrabold w-3 h-3 rounded-full flex items-center justify-center border-2 border-white">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[9px] tracking-tight mt-0.5 leading-none truncate max-w-full ${isActive ? 'font-bold' : 'font-normal'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[#FF6B1A] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
