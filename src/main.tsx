// Preamble fallback for React Fast Refresh
if (typeof window !== 'undefined') {
  (window as any).$RefreshReg$ = (window as any).$RefreshReg$ || function () {};
  (window as any).$RefreshSig$ = (window as any).$RefreshSig$ || function () { return function (type: any) { return type; }; };
  (window as any).__vite_plugin_react_preamble_installed__ = true;
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Enregistrement unique et gestion proactive du cycle de vie du Service Worker PWA
if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('ArtisanPro: Nouveau Service Worker activé, actualisation automatique');
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Si un nouveau worker est déjà en attente
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('ArtisanPro: Nouvelle version prête, activation');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

        // Vérifier les mises à jour lorsque l'utilisateur revient sur l'application (mobile tab switch)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });
      })
      .catch((err) => {
        console.warn('PWA Service Worker note:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
