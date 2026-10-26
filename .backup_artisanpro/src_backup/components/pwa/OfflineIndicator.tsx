import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-neutral-900/90 text-white px-4 py-2 text-xs font-semibold shadow-2xl backdrop-blur-md border border-white/10 animate-in fade-in slide-in-from-bottom-2">
      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
      <span>Mode hors-ligne — Données en cache utilisées</span>
    </div>
  );
};
