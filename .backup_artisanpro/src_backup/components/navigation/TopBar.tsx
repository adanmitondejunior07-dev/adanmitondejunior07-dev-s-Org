import React from 'react';
import { Hammer, Bell, Shield, Menu, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TopBarProps {
  onOpenMenu: () => void;
  onOpenNotifications: () => void;
  onOpenAdmin: () => void;
  onOpenSearch?: () => void;
  unreadNotificationsCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenMenu,
  onOpenNotifications,
  onOpenAdmin,
  onOpenSearch,
  unreadNotificationsCount = 0
}) => {
  const { profile, isAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 px-3 py-2">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Left Side: Hamburger Menu & Brand Name "Artisans Pro Africa" */}
        <div className="flex items-center gap-2">
          {/* Hamburger Menu Button */}
          <button
            onClick={onOpenMenu}
            className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Ouvrir le menu"
            title="Menu principal"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo & Artisans Pro Africa */}
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={onOpenMenu}>
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8C38] flex items-center justify-center text-white shadow-xs shrink-0">
              <Hammer className="w-3.5 h-3.5 -rotate-12" />
            </div>
            <div className="leading-tight">
              <span className="font-extrabold text-sm sm:text-base text-neutral-900 tracking-tight">
                Artisans Pro <span className="text-[#FF6B00]">Africa</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: [🔍 Recherche] + [Admin] + [Bell Notifications] */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* BOUTON RECHERCHE 🔍 */}
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              className="w-9 h-9 rounded-full border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center transition-colors cursor-pointer shadow-xs shrink-0"
              aria-label="Recherche rapide"
              title="Rechercher des artisans et produits"
            >
              <Search className="w-4 h-4 text-neutral-700" />
            </button>
          )}

          {/* ADMIN SECRET BADGE (si super admin) */}
          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              title="Tableau de bord Administrateur Supérieur"
              className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-700 border border-amber-300 hover:bg-amber-500/20 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <Shield className="w-4 h-4 text-amber-600 fill-amber-500/20" />
            </button>
          )}

          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifications}
            className="relative w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Notifications"
            title="Mes notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#FF6B00] border-2 border-white ring-1 ring-[#FF6B00]/40 animate-pulse" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
