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
import { WalletModal } from './components/wallet/WalletModal';
import { ServiceRequestModal } from './components/missions/ServiceRequestModal';
import { MissionTrackingModal } from './components/missions/MissionTrackingModal';
import { EdgeFunctionsDeployerModal } from './components/admin/EdgeFunctionsDeployerModal';
import { VerificationModal } from './components/verification/VerificationModal';
import { Artisan, MarketplaceItem, ServiceRequest, AppNotification } from './types';
import { dataStore } from './lib/dataStore';
import { Hammer, Bell, ShieldCheck, ChevronRight, X } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('marketplace');

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
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSettingsSection, setSelectedSettingsSection] = useState<any>('menu');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSupportChat, setShowSupportChat] = useState(false);

  // Live Notification System & In-App Toast
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [toastNotification, setToastNotification] = useState<AppNotification | null>(null);

  const refreshNotifications = async () => {
    if (!user) return;
    try {
      const notifs = await dataStore.getNotifications(user.id);
      const unread = notifs.filter(n => !n.is_read).length;
      setUnreadNotificationsCount(unread);
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    refreshNotifications();

    // Setup SSE stream for realtime notifications
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/notifications/stream?userId=${encodeURIComponent(user.id)}`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.notification) {
            const notif = data.notification;
            if (notif.user_id === user.id || notif.user_id === 'all') {
              setToastNotification(notif);
              refreshNotifications();
              setTimeout(() => {
                setToastNotification(prev => (prev?.id === notif.id ? null : prev));
              }, 6000);
            }
          }
        } catch {}
      };
      eventSource.onerror = () => {
        // SSE reconnects automatically
      };
    } catch {}

    // Polling fallback every 20 seconds
    const interval = setInterval(refreshNotifications, 20000);

    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, [user]);
  
  // Wallet & GPS Missions Modals
  const [showWallet, setShowWallet] = useState(false);
  const [showDeployer, setShowDeployer] = useState<boolean>(() => {
    try {
      return window.location.search.includes('deploy');
    } catch {
      return false;
    }
  });
  const [showServiceRequest, setShowServiceRequest] = useState(false);
  const [activeMission, setActiveMission] = useState<ServiceRequest | null>(null);
  
  // Chat interaction routing
  const [activeChatContactId, setActiveChatContactId] = useState<string | null>(null);

  // 1. Loading Splash Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-[#FF6B1A] flex items-center justify-center text-white shadow-xl shadow-[#FF6B1A]/25 animate-bounce mb-3">
          <Hammer className="w-7 h-7 -rotate-12" />
        </div>
        <span className="font-extrabold text-lg text-neutral-900 tracking-tight">
          Artisan<span className="text-[#FF6B1A]">Pro</span> Afrique
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
          setCurrentPath('/login');
          router.push('/login');
        }}
      />
    );
  }

  // 6. /login ROUTE: Direct login view
  if (currentPath === '/login' && !user) {
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
          router.push(`/verify-code?email=${encodeURIComponent(em)}`);
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
        onOpenWallet={() => setShowWallet(true)}
        onOpenServiceRequest={() => setShowServiceRequest(true)}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* Main Tab View */}
      <main className="flex-1 overflow-x-hidden">
        {activeTab === 'social' && <SocialFeed />}
        {activeTab === 'artisan' && (
          <ArtisansDirectory onOpenChatWith={handleOpenChatWithArtisan} />
        )}
        {activeTab === 'marketplace' && (
          <MarketplaceFeed
            onContactSeller={handleContactSeller}
            onOpenServiceRequest={() => setShowServiceRequest(true)}
            onOpenWallet={() => setShowWallet(true)}
          />
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
            onOpenWallet={() => setShowWallet(true)}
            onOpenServiceRequest={() => setShowServiceRequest(true)}
            onOpenVerification={() => setShowVerificationModal(true)}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation with 6 tabs */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'request') {
            setShowServiceRequest(true);
            return;
          }
          if (tab === 'wallet') {
            setShowWallet(true);
            return;
          }
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
        onOpenWallet={() => setShowWallet(true)}
        onOpenServiceRequest={() => setShowServiceRequest(true)}
        onOpenDeployer={() => setShowDeployer(true)}
      />

      {/* Wallet Modal (Client & Artisan, FCFA, Real Mobile Money) */}
      <WalletModal
        isOpen={showWallet}
        onClose={() => setShowWallet(false)}
        onOpenDeployer={() => setShowDeployer(true)}
        onOpenArtisanChat={(artId) => {
          setShowWallet(false);
          setActiveChatContactId(artId);
          setActiveTab('chat');
        }}
      />

      {/* Service Request Creation Modal (Normal free or Urgent GPS priority) */}
      <ServiceRequestModal
        isOpen={showServiceRequest}
        onClose={() => setShowServiceRequest(false)}
        onRequestCreated={(newReq) => {
          setActiveMission(newReq);
        }}
        onOpenWallet={() => {
          setShowServiceRequest(false);
          setShowWallet(true);
        }}
      />

      {/* Real-time GPS Mission Tracking Modal */}
      {activeMission && (
        <MissionTrackingModal
          isOpen={!!activeMission}
          onClose={() => setActiveMission(null)}
          request={activeMission}
          onOpenChatWith={handleOpenChatWithArtisan}
          onOpenWallet={() => {
            setActiveMission(null);
            setShowWallet(true);
          }}
          onRequestUpdated={(updatedReq) => {
            setActiveMission(updatedReq);
          }}
        />
      )}

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
        <NotificationsModal
          onClose={() => {
            setShowNotifications(false);
            refreshNotifications();
          }}
          onOpenVerification={() => setShowVerificationModal(true)}
          onOpenWallet={() => setShowWallet(true)}
          onOpenAdmin={() => setShowAdmin(true)}
          onOpenChat={(contactId) => {
            if (contactId) setActiveChatContactId(contactId);
            setActiveTab('chat');
          }}
        />
      )}

      {/* Profile Verification Modal (4 official documents & tracking timeline) */}
      {showVerificationModal && (
        <VerificationModal
          onClose={() => {
            setShowVerificationModal(false);
            refreshNotifications();
          }}
          onOpenAdmin={() => setShowAdmin(true)}
        />
      )}

      {/* Real-time In-App Notification Toast Banner */}
      {toastNotification && (
        <div className="fixed top-3 left-4 right-4 z-50 max-w-sm mx-auto bg-neutral-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-neutral-700 animate-in slide-in-from-top-4 duration-300 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center shrink-0 mt-0.5">
            <Bell className="w-4 h-4" />
          </div>
          <div 
            className="flex-1 min-w-0 cursor-pointer" 
            onClick={() => {
              const notif = toastNotification;
              setToastNotification(null);
              if (notif.target_page === 'verification' || notif.type === 'verification') {
                setShowVerificationModal(true);
              } else if (notif.target_page === 'admin') {
                setShowAdmin(true);
              } else if (notif.target_page === 'wallet' || notif.type === 'wallet') {
                setShowWallet(true);
              } else {
                setShowNotifications(true);
              }
            }}
          >
            <h5 className="font-extrabold text-xs text-white leading-tight">
              {toastNotification.title}
            </h5>
            <p className="text-[11px] text-neutral-300 mt-0.5 leading-snug line-clamp-2">
              {toastNotification.message}
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] text-[#FF6B00] font-bold mt-1">
              <span>Voir le détail</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            className="p-1 text-neutral-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
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

      {/* Supabase Edge Functions Secure Deployer Modal (Strictly Admin only) */}
      {isAdmin && (
        <EdgeFunctionsDeployerModal
          isOpen={showDeployer}
          onClose={() => setShowDeployer(false)}
        />
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
