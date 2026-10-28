// Preamble fallback for React Fast Refresh
if (typeof window !== 'undefined') {
  (window as any).$RefreshReg$ = (window as any).$RefreshReg$ || function () {};
  (window as any).$RefreshSig$ = (window as any).$RefreshSig$ || function () { return function (type: any) { return type; }; };
  (window as any).__vite_plugin_react_preamble_installed__ = true;
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
