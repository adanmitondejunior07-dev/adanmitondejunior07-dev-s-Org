// Simple lightweight SPA router for ArtisanPro Afrique
export const router = {
  push: (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  },
  replace: (path: string) => {
    window.history.replaceState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  },
  back: () => {
    window.history.back();
  }
};
