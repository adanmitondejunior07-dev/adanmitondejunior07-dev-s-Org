import React from 'react';
import { 
  X, 
  User, 
  Settings, 
  ShieldCheck, 
  HelpCircle, 
  DollarSign, 
  FileText, 
  Lock, 
  AlertTriangle, 
  Info, 
  Trash2, 
  LogOut, 
  ChevronRight, 
  MapPin, 
  Shield,
  Hammer,
  Crown,
  Bot,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface LeftMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSection: (section: 'account' | 'subscriptions' | 'verification' | 'how_it_works' | 'monetization' | 'cgu' | 'privacy' | 'report_problem' | 'about' | 'delete_account' | 'support_chat') => void;
  onNavigateToTab: (tab: 'social' | 'artisan' | 'marketplace' | 'chat' | 'video' | 'profil') => void;
  onOpenAdmin: () => void;
  onOpenSupportChat?: () => void;
}

export const LeftMenuDrawer: React.FC<LeftMenuDrawerProps> = ({
  isOpen,
  onClose,
  onOpenSection,
  onNavigateToTab,
  onOpenAdmin,
  onOpenSupportChat
}) => {
  const { profile, signOut, isAdmin } = useAuth();

  if (!isOpen) return null;

  const isUserAdmin = 
    isAdmin || 
    profile?.role === 'admin' || 
    (profile?.email?.toLowerCase().trim() === 'adanmitondejunior07@gmail.com');

  const handleSelectSection = (section: any) => {
    onClose();
    if (section === 'support_chat') {
      if (onOpenSupportChat) {
        onOpenSupportChat();
      } else {
        onOpenSection('support_chat');
      }
      return;
    }
    onOpenSection(section);
  };

  const handleGoToProfile = () => {
    onClose();
    onNavigateToTab('profil');
  };

  const rawMenuItems = [
    {
      id: 'support_chat',
      label: 'Chat Support Automatique (24/7)',
      icon: Bot,
      highlight: true,
      description: 'Réponse immédiate à n\'importe quelle question'
    },
    {
      id: 'account',
      label: 'Paramètres du compte',
      icon: Settings,
      description: 'Email, mot de passe et sécurité'
    },
    {
      id: 'subscriptions',
      label: 'Abonnements Professionnels',
      icon: Crown,
      description: 'Tarifs GeniusPay 425F, 900F, 1200F'
    },
    ...(!isUserAdmin ? [{
      id: 'verification',
      label: 'Vérification Artisan',
      icon: ShieldCheck,
      description: 'Obtenir le badge certifié officiel'
    }] : []),
    {
      id: 'how_it_works',
      label: 'Comment ça marche ?',
      icon: HelpCircle,
      description: 'Guide pour clients et artisans'
    },
    {
      id: 'monetization',
      label: 'Conditions de monétisation',
      icon: DollarSign,
      description: 'Règles et transparence monétaire'
    },
    {
      id: 'cgu',
      label: 'Conditions d\'Utilisation (CGU)',
      icon: FileText,
      description: 'Règles de bonne conduite'
    },
    {
      id: 'privacy',
      label: 'Politique de Confidentialité',
      icon: Lock,
      description: 'Protection de vos données'
    },
    {
      id: 'report_problem',
      label: 'Signaler un problème ou un bug',
      icon: AlertTriangle,
      description: 'Aidez-nous à améliorer l\'application'
    },
    {
      id: 'about',
      label: 'À propos d\'ArtisanPro Afrique',
      icon: Info,
      description: 'Notre mission, vision & domaines'
    },
    {
      id: 'delete_account',
      label: 'Suppression définitive du compte',
      icon: Trash2,
      danger: true,
      description: 'Procédure et confirmation définitive'
    }
  ];

  const menuItems = rawMenuItems;

  return (
    <div className="fixed inset-0 z-50 flex animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
      />

      {/* Drawer Panel */}
      <div className="relative w-[85%] max-w-xs bg-white h-full shadow-2xl z-10 flex flex-col justify-between overflow-hidden animate-in slide-in-from-left duration-300">
        {/* Drawer Header */}
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/80">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8C38] flex items-center justify-center text-white shadow-xs">
                <Hammer className="w-4 h-4 -rotate-12" />
              </div>
              <span className="font-extrabold text-base tracking-tight text-neutral-900">
                Menu Principal
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-200/60 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User Profile Card */}
          <div 
            onClick={handleGoToProfile}
            className="p-3 bg-white rounded-2xl border border-neutral-200/80 shadow-xs flex items-center gap-3 cursor-pointer hover:border-[#FF6B00] transition-colors"
          >
            <img
              src={
                profile?.avatar_url ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile?.full_name || 'Moi')}&backgroundColor=FF6B00`
              }
              alt={profile?.full_name || 'Profil'}
              className="w-11 h-11 rounded-full object-cover border border-neutral-100 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs text-neutral-900 truncate">
                {profile?.full_name || 'Mon Profil'}
              </h4>
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 mt-0.5">
                <span className={`px-1.5 py-0.5 rounded-md font-extrabold uppercase text-[9px] ${
                  isUserAdmin
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : profile?.role === 'artisan'
                    ? 'bg-orange-50 text-[#FF6B00]'
                    : 'bg-neutral-100 text-neutral-700'
                }`}>
                  {isUserAdmin ? 'Administrateur' : profile?.role === 'artisan' ? 'Artisan' : 'Client'}
                </span>
                <span className="truncate flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5 text-neutral-400" />
                  {profile?.ville || 'Abidjan'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-400" />
          </div>
        </div>

        {/* Scrollable Menu Items */}
        <div className="p-3 overflow-y-auto flex-1 space-y-1">
          {/* Quick shortcut to profile */}
          <button
            onClick={handleGoToProfile}
            className="w-full p-2.5 rounded-2xl flex items-center justify-between text-neutral-800 hover:bg-neutral-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B00] flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs block text-neutral-900">Voir mon profil</span>
                <span className="text-[10px] text-neutral-400">Modifier photo, bio et publications</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-300" />
          </button>

          {/* BOUTON D'ABONNEMENT COMPACT (LARGEUR ET LONGUEUR RÉDUITES) */}
          <button
            type="button"
            onClick={() => handleSelectSection('subscriptions')}
            className="w-full my-1.5 px-3 py-2 bg-gradient-to-r from-neutral-900 via-neutral-900 to-black hover:border-[#FF6600] text-white rounded-xl border border-orange-500/40 shadow-xs flex items-center justify-between gap-2 cursor-pointer transition-all active:scale-[0.99] group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#FF6600] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Crown className="w-3.5 h-3.5" />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[11px] text-white tracking-tight truncate">Abonnements Pro</span>
                  <span className="px-1 py-0.2 rounded-md bg-[#FF6600] text-white text-[8px] font-black uppercase">
                    Dès 425F
                  </span>
                </div>
                <span className="text-[9px] text-neutral-400 block truncate">
                  Badge Bleu Pro • GeniusPay
                </span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-orange-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* BOUTON CHAT SUPPORT AUTOMATIQUE (RÉPOND À TOUTES LES QUESTIONS) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenSupportChat) {
                onOpenSupportChat();
              } else {
                handleSelectSection('support_chat');
              }
            }}
            className="w-full my-1 px-3 py-2 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 hover:bg-orange-100 text-neutral-900 rounded-xl border border-orange-200/90 shadow-2xs flex items-center justify-between gap-2 cursor-pointer transition-all active:scale-[0.99] group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#FF6B00] to-[#FF8C38] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[11px] text-neutral-900 tracking-tight truncate">Support Automatique</span>
                  <span className="px-1 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase">
                    24/7
                  </span>
                </div>
                <span className="text-[9px] text-neutral-500 block truncate">
                  Réponse instantanée à toute question
                </span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#FF6B00] shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <div className="my-2 border-t border-neutral-100" />

          {/* PWA Mobile Installation Button */}
          <PWAInstallButton variant="menu" />

          <div className="my-2 border-t border-neutral-100" />

          {/* Settings & Information Items */}
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectSection(item.id)}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-colors cursor-pointer text-left ${
                  item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-neutral-800 hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    item.danger ? 'bg-red-100 text-red-600' : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-xs block truncate">{item.label}</span>
                    <span className="text-[10px] text-neutral-400 block truncate">{item.description}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0 ml-1" />
              </button>
            );
          })}

          {/* Super Admin Secret Item (ONLY for adanmitondejunior07@gmail.com) */}
          {isAdmin && (
            <>
              <div className="my-2 border-t border-amber-200" />
              <button
                onClick={() => {
                  onClose();
                  onOpenAdmin();
                }}
                className="w-full p-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 flex items-center justify-between transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs block text-amber-900">Espace Super-Admin</span>
                    <span className="text-[10px] text-amber-700">Gestion complète de la plateforme</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-600" />
              </button>
            </>
          )}
        </div>

        {/* Footer Logout */}
        <div className="p-4 border-t border-neutral-100 bg-neutral-50/50">
          <button
            onClick={() => {
              onClose();
              signOut();
            }}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            <span>Se déconnecter</span>
          </button>
          <div className="text-center mt-2">
            <span className="text-[10px] text-neutral-400 font-medium">
              ArtisanPro Afrique v2.4.0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
