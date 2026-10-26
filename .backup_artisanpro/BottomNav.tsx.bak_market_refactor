import React from 'react';
import { Newspaper, Users, ShoppingBag, MessageSquare, PlaySquare, User } from 'lucide-react';

export type TabType = 'social' | 'artisan' | 'marketplace' | 'chat' | 'video' | 'profil';

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
    { id: 'social' as TabType, label: 'Social', icon: Newspaper },
    { id: 'artisan' as TabType, label: 'Artisans', icon: Users },
    { id: 'marketplace' as TabType, label: 'Marketplace', icon: ShoppingBag },
    { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare, badge: unreadChatCount },
    { id: 'video' as TabType, label: 'Vidéos', icon: PlaySquare },
    { id: 'profil' as TabType, label: 'Profil', icon: User }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-neutral-200/90 shadow-lg">
      <div className="max-w-md mx-auto px-1 py-1 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all relative cursor-pointer select-none ${
                isActive
                  ? 'text-[#FF6B00] font-bold'
                  : 'text-neutral-500 hover:text-neutral-800 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 stroke-[2.4px]' : 'stroke-[1.8px]'
                  }`}
                />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 bg-[#FF6B00] text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[10px] tracking-tight mt-0.5 ${isActive ? 'font-bold' : 'font-normal'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[#FF6B00] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
