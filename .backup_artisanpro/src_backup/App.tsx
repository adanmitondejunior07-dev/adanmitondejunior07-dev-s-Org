import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WelcomeScreen } from './components/auth/WelcomeScreen';
import { VerifyCodeView } from './components/auth/VerifyCodeView';
import { ForgotPasswordView } from './components/auth/ForgotPasswordView';
import { VerifyResetView } from './components/auth/VerifyResetView';
import { NewPasswordView } from './components/auth/NewPasswordView';
import { router } from './lib/router';
import { TopBar } from './components/navigation/TopBar';
import { BottomNav, TabType } from './components/navigation/BottomNav';
import { LeftMenuDrawer } from './components/navigation/LeftMenuDrawer';
import { NotificationsModal } from './components/notifications/NotificationsModal';
import { SocialFeed } from './components/social/SocialFeed';
import { ArtisansDirectory } from './components/artisans/ArtisansDirectory';
import { MarketplaceFeed } from './components/marketplace/MarketplaceFeed';
import { ChatView } from './components/chat/ChatView';
import { VideoFeed } from './components/video/VideoFeed';
import { ProfileView } from './components/profile/ProfileView';
import { SettingsModal } from './components/settings/SettingsModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { SearchModal } from './components/search/SearchModal';
import { SupportChatModal } from './components/support/SupportChatModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { Artisan, MarketplaceItem } from './types';
import { Hammer } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('social');

  // Lightweight routing for /verify-code and /dashboard
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
  const [verifyEmail, setVerifyEmail] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('email') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      try {
        const p = new URLSearchParams(window.location.search);
        const em = p.get('email');
        if (em) setVerifyEmail(em);
      } catch {}
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);
  
  // Modals & Drawers
  const [showLeftMenu, setShowLeftMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSettingsSection, setSelectedSettingsSection] = useState<any>('menu');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSupportChat, setShowSupportChat] = useState(false);
  
  // Chat interaction routing
  const [activeChatContactId, setActiveChatContactId] = useState<string | null>(null);

  // 1. Loading Splash Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8C38] flex items-center justify-center text-white shadow-xl shadow-[#FF6B00]/25 animate-bounce mb-3">
          <Hammer className="w-7 h-7 -rotate-12" />
        </div>
        <span className="font-extrabold text-lg text-neutral-900 tracking-tight">
          Artisan<span className="text-[#FF6B00]">Pro</span> Afrique
        </span>
        <span className="text-xs text-neutral-500 mt-1 font-medium">Chargement sécurisé...</span>
      </div>
    );
  }

  // 2. FORGOT PASSWORD ROUTES: Accessible anytime
  if (
    currentPath === '/mot-de-passe-oublie' || 
    currentPath === '/forgot-password' ||
    window.location.search.includes('mot-de-passe-oublie')
  ) {
    return (
      <ForgotPasswordView
        onBack={() => {
          setCurrentPath('/login');
          router.push('/login');
        }}
        onNavigateToRegister={() => {
          setCurrentPath('/');
          router.push('/');
        }}
      />
    );
  }

  // 3. /verify-reset ROUTE: Code OTP 6 digits verification
  if (
    currentPath === '/verify-reset' || 
    window.location.search.includes('verify-reset')
  ) {
    return (
      <VerifyResetView
        initialEmail={verifyEmail}
        onSuccess={() => {
          setCurrentPath('/nouveau-mot-de-passe');
          router.push('/nouveau-mot-de-passe');
        }}
        onBack={() => {
          setCurrentPath('/mot-de-passe-oublie');
          router.push('/mot-de-passe-oublie');
        }}
      />
    );
  }

  // 4. /nouveau-mot-de-passe ROUTE: Set new password
  if (
    currentPath === '/nouveau-mot-de-passe' || 
    currentPath === '/reset-password' ||
    window.location.search.includes('nouveau-mot-de-passe')
  ) {
    return (
      <NewPasswordView
        onSuccess={() => {
          setCurrentPath('/login');
          router.push('/login');
        }}
      />
    );
  }

  // 5. /verify-code ROUTE: Accessible if user navigated there or clicked email magic link
  const hasMagicLinkParams = 
    window.location.search.includes('token_hash') ||
    window.location.search.includes('type=magiclink') ||
    window.location.search.includes('type=recovery') ||
    window.location.hash.includes('access_token') ||
    window.location.hash.includes('type=magiclink');

  if (currentPath === '/verify-code' || window.location.search.includes('verify-code') || (!user && hasMagicLinkParams)) {
    return (
      <VerifyCodeView
        initialEmail={verifyEmail}
        onSuccess={() => {
          setCurrentPath('/dashboard');
          router.push('/dashboard');
        }}
        onBack={() => {
          setCurrentPath('/');
          router.push('/');
        }}
      />
    );
  }

  // 6. /login ROUTE: Direct login view
  if (currentPath === '/login') {
    return (
      <WelcomeScreen
        initialShowLogin={true}
        onNavigateToVerify={(em) => {
          setVerifyEmail(em);
          setCurrentPath('/verify-code');
          router.push(`/verify-code?email=${encodeURIComponent(em)}`);
        }}
      />
    );
  }

  // 3. AUTH GATE: If no session, show WelcomeScreen
  if (!user) {
    return (
      <WelcomeScreen
        onNavigateToVerify={(em) => {
          setVerifyEmail(em);
          setCurrentPath('/verify-code');
        }}
      />
    );
  }

  // Action handlers
  const handleOpenChatWithArtisan = (artisan: Artisan) => {
    setActiveChatContactId(artisan.id);
    setActiveTab('chat');
  };

  const handleContactSeller = (item: MarketplaceItem) => {
    setActiveChatContactId(item.artisan_id);
    setActiveTab('chat');
  };

  const handleOpenSectionFromMenu = (section: any) => {
    if (section === 'support_chat') {
      setShowSupportChat(true);
      return;
    }
    setSelectedSettingsSection(section);
    setShowSettings(true);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-neutral-900 flex flex-col max-w-md mx-auto shadow-2xl relative overflow-x-hidden selection:bg-[#FF6B00] selection:text-white">
      {/* Top Header with Hamburger Menu on the Left and Notifications on the Right */}
      <TopBar
        onOpenMenu={() => setShowLeftMenu(true)}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenAdmin={() => setShowAdmin(true)}
        onOpenSearch={() => setShowSearch(true)}
        unreadNotificationsCount={1}
      />

      {/* Main Tab View */}
      <main className="flex-1 overflow-x-hidden">
        {activeTab === 'social' && <SocialFeed />}
        {activeTab === 'artisan' && (
          <ArtisansDirectory onOpenChatWith={handleOpenChatWithArtisan} />
        )}
        {activeTab === 'marketplace' && (
          <MarketplaceFeed onContactSeller={handleContactSeller} />
        )}
        {activeTab === 'chat' && (
          <ChatView
            initialActiveConversationId={
              activeChatContactId ? `conv-${activeChatContactId}` : null
            }
          />
        )}
        {activeTab === 'video' && <VideoFeed />}
        {activeTab === 'profil' && (
          <ProfileView
            onOpenSettings={() => {
              setSelectedSettingsSection('menu');
              setShowSettings(true);
            }}
            onOpenSubscriptions={() => {
              setSelectedSettingsSection('subscriptions');
              setShowSettings(true);
            }}
            onOpenAdmin={() => setShowAdmin(true)}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation with 6 tabs */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== 'chat') {
            setActiveChatContactId(null);
          }
        }}
        unreadChatCount={0}
      />

      {/* Left Menu Drawer */}
      <LeftMenuDrawer
        isOpen={showLeftMenu}
        onClose={() => setShowLeftMenu(false)}
        onOpenSection={handleOpenSectionFromMenu}
        onNavigateToTab={(tab) => setActiveTab(tab)}
        onOpenAdmin={() => setShowAdmin(true)}
        onOpenSupportChat={() => setShowSupportChat(true)}
      />

      {/* Automated Support Chat Modal (answers any questions) */}
      <SupportChatModal
        isOpen={showSupportChat}
        onClose={() => setShowSupportChat(false)}
        onOpenSubscriptions={() => {
          setSelectedSettingsSection('subscriptions');
          setShowSettings(true);
        }}
        onOpenDirectory={() => setActiveTab('artisan')}
      />

      {/* Standalone Notifications Modal (ONLY contains notifications) */}
      {showNotifications && (
        <NotificationsModal onClose={() => setShowNotifications(false)} />
      )}

      {/* Instant Search Modal (Artisans & Marketplace) */}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onOpenArtisanChat={handleOpenChatWithArtisan}
          onSelectProduct={handleContactSeller}
        />
      )}

      {/* Settings Modal (opened via Left Menu or Profile) */}
      {showSettings && (
        <SettingsModal
          initialSection={selectedSettingsSection}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Secret Admin Dashboard (Invisible to ordinary users, strictly validated) */}
      {showAdmin && isAdmin && (
        <AdminDashboard onClose={() => setShowAdmin(false)} />
      )}

      {/* Connectivity Status Indicator */}
      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
