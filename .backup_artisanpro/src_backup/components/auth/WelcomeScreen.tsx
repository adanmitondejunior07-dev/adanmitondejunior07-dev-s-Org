import React, { useState } from 'react';
import { Hammer, ShieldCheck, Sparkles, Users, Wrench, ChevronRight } from 'lucide-react';
import { RegisterModal } from './RegisterModal';
import { LoginModal } from './LoginModal';

interface WelcomeScreenProps {
  onNavigateToVerify?: (email: string) => void;
  initialShowLogin?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  onNavigateToVerify,
  initialShowLogin = false
}) => {
  const [showRegister, setShowRegister] = useState(false);
  const [showLogin, setShowLogin] = useState(() => initialShowLogin || window.location.pathname === '/login');
  const [initialRole, setInitialRole] = useState<'client' | 'artisan'>('client');

  const openRegister = (role: 'client' | 'artisan' = 'client') => {
    setInitialRole(role);
    setShowRegister(true);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-neutral-900 flex flex-col justify-between selection:bg-[#FF6B00] selection:text-white">
      {/* Background African geometric subtle pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#FF6B00_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.04] pointer-events-none" />

      {/* Top Header bar with Logo */}
      <header className="relative z-10 px-6 pt-6 pb-2 flex items-center justify-between max-w-md mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8C38] flex items-center justify-center text-white shadow-md shadow-[#FF6B00]/25">
            <Hammer className="w-5 h-5 -rotate-12" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-neutral-900">
              Artisan<span className="text-[#FF6B00]">Pro</span>
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 -mt-1">
              Afrique
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-neutral-200 shadow-xs text-xs font-semibold text-neutral-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Réseau Panafricain</span>
        </div>
      </header>

      {/* Main Hero Card */}
      <main className="relative z-10 px-5 flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-4">
        {/* Visual Hero Badge */}
        <div className="mb-6 relative">
          <div className="relative rounded-3xl overflow-hidden border border-neutral-200/80 bg-white shadow-xl shadow-neutral-900/5">
            <div className="h-44 bg-gradient-to-br from-[#121212] via-[#241a14] to-[#FF6B00]/40 relative overflow-hidden flex items-end p-5">
              <img 
                src="https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=800&q=80" 
                alt="Artisans d'Afrique" 
                className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              
              <div className="relative z-10 text-white">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF6B00] text-[11px] font-bold text-white mb-2 shadow-xs">
                  <Sparkles className="w-3 h-3" />
                  <span>Savoir-faire 100% Africain</span>
                </div>
                <p className="text-xs text-neutral-200 font-medium">
                  Couture, Électricité, Menuiserie, Mécanique, Plomberie & plus
                </p>
              </div>
            </div>

            {/* Content info */}
            <div className="p-6 text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight leading-tight mb-3">
                Bienvenue sur <span className="text-[#FF6B00]">ArtisanPro</span> Afrique
              </h1>
              
              <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-xs mx-auto">
                La plateforme qui connecte les artisans et les clients à travers l'Afrique.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-6 text-center">
          <div className="bg-white p-3 rounded-2xl border border-neutral-200/70 shadow-xs flex flex-col items-center">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B00] flex items-center justify-center mb-1.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-neutral-800">Vérifiés</span>
            <span className="text-[10px] text-neutral-500">Profils fiables</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-neutral-200/70 shadow-xs flex flex-col items-center">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B00] flex items-center justify-center mb-1.5">
              <Wrench className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-neutral-800">10+ Métiers</span>
            <span className="text-[10px] text-neutral-500">Devis directs</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-neutral-200/70 shadow-xs flex flex-col items-center">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B00] flex items-center justify-center mb-1.5">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-neutral-800">Panafricain</span>
            <span className="text-[10px] text-neutral-500">12 pays actifs</span>
          </div>
        </div>

        {/* Action Buttons: S'INSCRIRE et SE CONNECTER */}
        <div className="space-y-3">
          <button
            onClick={() => setShowRegister(true)}
            className="w-full py-4 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-[#FF6B00]/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>S'INSCRIRE</span>
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowLogin(true)}
            className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-neutral-50 active:scale-[0.99] text-neutral-900 border border-neutral-300 font-bold text-base shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>SE CONNECTER</span>
          </button>
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="relative z-10 px-6 py-4 text-center max-w-md mx-auto w-full">
        <p className="text-[11px] text-neutral-500">
          En continuant, vous acceptez les Conditions d'Utilisation d'ArtisanPro Afrique.
        </p>
      </footer>

      {/* Modals */}
      {showRegister && (
        <RegisterModal 
          onClose={() => setShowRegister(false)} 
          onSwitchToLogin={() => {
            setShowRegister(false);
            setShowLogin(true);
          }}
          onRedirectToVerify={(em) => {
            setShowRegister(false);
            if (onNavigateToVerify) onNavigateToVerify(em);
          }}
          initialRole={initialRole}
        />
      )}

      {showLogin && (
        <LoginModal 
          onClose={() => setShowLogin(false)}
          onSwitchToRegister={() => {
            setShowLogin(false);
            setShowRegister(true);
          }}
        />
      )}
    </div>
  );
};
