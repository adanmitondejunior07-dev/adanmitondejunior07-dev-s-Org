import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  MapPin, 
  MessageCircle, 
  ShieldCheck, 
  Hammer, 
  ShoppingBag,
  ArrowRight,
  User,
  Star
} from 'lucide-react';
import { dataStore } from '../../lib/dataStore';
import { Artisan, MarketplaceItem } from '../../types';

interface SearchModalProps {
  onClose: () => void;
  onOpenArtisanChat: (artisan: Artisan) => void;
  onSelectProduct: (item: MarketplaceItem) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  onClose,
  onOpenArtisanChat,
  onSelectProduct
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dataStore.getArtisans(),
      dataStore.getMarketplaceItems()
    ]).then(([arts, items]) => {
      setArtisans(arts);
      setMarketplaceItems(items);
      setLoading(false);
    });
  }, []);

  const trades = [
    'Tous',
    'Menuiserie',
    'Couture',
    'Plomberie',
    'Électricité',
    'Coiffure',
    'Mécanique',
    'Maçonnerie'
  ];

  const q = query.trim().toLowerCase();

  const filteredArtisans = artisans.filter((art) => {
    const matchesCategory = 
      selectedCategory === 'all' || 
      selectedCategory === 'Tous' ||
      art.metier.toLowerCase().includes(selectedCategory.toLowerCase());

    if (!matchesCategory) return false;
    if (!q) return true;

    return (
      art.nom.toLowerCase().includes(q) ||
      art.metier.toLowerCase().includes(q) ||
      art.ville.toLowerCase().includes(q) ||
      (art.commune || '').toLowerCase().includes(q) ||
      (art.description || '').toLowerCase().includes(q)
    );
  });

  const filteredProducts = marketplaceItems.filter((item) => {
    if (!q) return false; // Show products only when querying
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.artisan_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden mt-6 max-h-[88vh] flex flex-col">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-neutral-100 bg-white flex items-center gap-2.5 sticky top-0 z-10">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#FF6B00] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un artisan, un métier, une ville..."
              className="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-neutral-100 border border-transparent focus:border-[#FF6B00] focus:bg-white text-xs outline-hidden text-neutral-900 transition-all font-medium"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Filter Categories */}
        <div className="px-3.5 py-2 border-b border-neutral-100 bg-neutral-50/70 overflow-x-auto flex items-center gap-1.5 scrollbar-none shrink-0">
          {trades.map((trade) => {
            const isSel = selectedCategory === (trade === 'Tous' ? 'all' : trade);
            return (
              <button
                key={trade}
                onClick={() => setSelectedCategory(trade === 'Tous' ? 'all' : trade)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 transition-colors cursor-pointer ${
                  isSel
                    ? 'bg-[#FF6B00] text-white shadow-xs'
                    : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {trade}
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div className="p-3.5 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="p-8 text-center text-neutral-400">
              <span className="w-6 h-6 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin inline-block mb-2" />
              <p className="text-[11px]">Recherche en cours...</p>
            </div>
          ) : (
            <>
              {/* Artisans Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500 uppercase tracking-wider px-1">
                  <span>Artisans qualifiés ({filteredArtisans.length})</span>
                </div>

                {filteredArtisans.length === 0 ? (
                  <div className="p-6 text-center bg-neutral-50 rounded-2xl text-neutral-500 text-xs">
                    Aucun artisan trouvé pour "{query}".
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredArtisans.map((artisan) => (
                      <div
                        key={artisan.id}
                        className="p-3 bg-white hover:bg-orange-50/30 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <img
                              src={
                                Array.isArray(artisan.photos) && artisan.photos[0]
                                  ? artisan.photos[0]
                                  : typeof artisan.photos === 'string' && artisan.photos
                                  ? artisan.photos
                                  : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(artisan.nom)}&backgroundColor=FF6B00`
                              }
                              alt={artisan.nom}
                              className="w-10 h-10 rounded-full object-cover border border-neutral-200"
                            />
                            {artisan.badge_bleu && (
                              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px]">
                                ✓
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-extrabold text-neutral-900 truncate text-xs">
                                {artisan.nom}
                              </h4>
                              <span className="px-1.5 py-0.2 rounded-md bg-orange-100 text-[#FF6B00] font-black text-[9px] uppercase">
                                {artisan.metier}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5 text-neutral-400" />
                                {artisan.ville}
                              </span>
                              {artisan.note_moyenne && (
                                <span className="flex items-center gap-0.5 font-bold text-amber-600">
                                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                  {artisan.note_moyenne.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenArtisanChat(artisan);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shrink-0 shadow-xs shadow-[#FF6B00]/20"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Contacter</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Products Section (if any matched) */}
              {filteredProducts.length > 0 && (
                <div className="pt-2 border-t border-neutral-100 space-y-2">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider px-1 block">
                    Créations Marketplace ({filteredProducts.length})
                  </span>

                  <div className="space-y-2">
                    {filteredProducts.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          onClose();
                          onSelectProduct(item);
                        }}
                        className="p-2.5 bg-neutral-50 hover:bg-neutral-100 rounded-2xl border border-neutral-200 flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.image_url && (
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="w-10 h-10 rounded-xl object-cover shrink-0 border border-neutral-200"
                            />
                          )}
                          <div className="min-w-0">
                            <h5 className="font-bold text-neutral-900 truncate text-xs">{item.title}</h5>
                            <p className="text-[10px] text-neutral-500">Par {item.artisan_name}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-[#FF6B00] text-xs block">
                            {item.price_fcfa?.toLocaleString('fr-FR')} FCFA
                          </span>
                          <span className="text-[9px] text-neutral-400">Voir l'offre →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
