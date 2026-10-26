import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Share2, PlusSquare, X, Smartphone, Check } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'header' | 'menu' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'menu' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running as an installed PWA in standalone mode, suppress
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 3000);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Fallback guide if browser doesn't expose beforeinstallprompt yet
      setShowIOSGuide(true);
    }
  };

  // Header mini button variant
  if (variant === 'header') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-orange-50 hover:bg-orange-100 text-[#FF6B00] border border-orange-200/80 text-[11px] font-bold transition-all cursor-pointer shadow-xs active:scale-95"
          title="Installer ArtisanPro sur votre appareil"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Installer l'application</span>
          <span className="sm:hidden">Installer</span>
        </button>

        {showIOSGuide && (
          <IOSInstallModal onClose={() => setShowIOSGuide(false)} />
        )}
      </>
    );
  }

  // Banner variant
  if (variant === 'banner') {
    return (
      <>
        <div className="w-[92%] mx-auto mb-3 p-3.5 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/15 border border-[#FF6B00]/30 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-extrabold text-xs text-neutral-900 truncate">Installer l'application</h4>
              <p className="text-[10px] text-neutral-600 truncate">Accès rapide sur l'écran d'accueil & hors-ligne</p>
            </div>
          </div>

          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-xs"
          >
            Installer
          </button>
        </div>

        {showIOSGuide && (
          <IOSInstallModal onClose={() => setShowIOSGuide(false)} />
        )}
      </>
    );
  }

  // Menu button variant (inside LeftMenuDrawer or Settings)
  return (
    <>
      <button
        onClick={handleInstallClick}
        className="w-full p-2.5 rounded-2xl bg-orange-50/80 hover:bg-orange-100 text-[#FF6B00] border border-orange-200/80 flex items-center justify-between transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center shrink-0 shadow-xs">
            {justInstalled ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          </div>
          <div>
            <span className="font-extrabold text-xs block text-neutral-900">
              {justInstalled ? 'Application installée !' : "Installer l'application mobile"}
            </span>
            <span className="text-[10px] text-neutral-500">
              Ajouter ArtisanPro sur votre écran d'accueil
            </span>
          </div>
        </div>
      </button>

      {showIOSGuide && (
        <IOSInstallModal onClose={() => setShowIOSGuide(false)} />
      )}
    </>
  );
};

// Guided instructions modal for iOS Safari and other browsers
const IOSInstallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-neutral-100 text-neutral-900 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-sm text-neutral-900">
              Installer ArtisanPro Afrique
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-neutral-700">
          <p className="text-neutral-600 font-medium leading-relaxed">
            Pour installer l'application sur votre écran d'accueil comme une application native :
          </p>

          <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/70 space-y-2">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#FF6B00] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div>
                Appuyez sur le bouton <strong>Partager</strong> <Share2 className="w-3.5 h-3.5 inline mx-1 text-blue-600" /> dans la barre de votre navigateur.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#FF6B00] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div>
                Faites défiler vers le bas et sélectionnez <strong className="text-neutral-900">« Sur l'écran d'accueil »</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-neutral-700" />.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#FF6B00] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <div>
                Touchez <strong>Ajouter</strong> en haut à droite pour finaliser l'installation.
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white font-bold text-xs transition-colors cursor-pointer"
        >
          J'ai compris
        </button>
      </div>
    </div>
  );
};
