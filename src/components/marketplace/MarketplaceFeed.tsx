import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  MapPin, 
  MessageSquare, 
  X, 
  Search, 
  ShieldCheck, 
  Sparkles,
  Tag,
  Navigation,
  LocateFixed,
  Trash2,
  Pencil,
  CheckCircle,
  ExternalLink,
  Wallet,
  ArrowRight,
  LayoutGrid,
  Hammer,
  Scissors,
  Building2,
  Droplets,
  Zap,
  Flame,
  Paintbrush,
  Palette,
  Star
} from 'lucide-react';
import { MarketplaceItem } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { useAuth } from '../../context/AuthContext';
import { METIERS_LIST, PAYS_AFRIQUE, VILLES_PAR_PAYS, ADMIN_EMAIL } from '../../lib/supabase';
import { compressImageFile } from '../../lib/mediaCompressor';

interface MarketplaceFeedProps {
  onContactSeller: (item: MarketplaceItem) => void;
  onOpenServiceRequest?: () => void;
  onOpenWallet?: () => void;
}

export const MarketplaceFeed: React.FC<MarketplaceFeedProps> = ({ 
  onContactSeller,
  onOpenServiceRequest,
  onOpenWallet
}) => {
  const { profile, user } = useAuth();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [selectedPays, setSelectedPays] = useState('Tous');
  const [selectedVille, setSelectedVille] = useState('Toutes');

  // Modal create
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState<string>(METIERS_LIST[0]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const itemImageInputRef = useRef<HTMLInputElement>(null);

  // GPS capture state for new offer
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsMessage, setGpsMessage] = useState('');

  // Edit item state
  const [editingItem, setEditingItem] = useState<MarketplaceItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState<string>(METIERS_LIST[0]);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editGpsCoordinates, setEditGpsCoordinates] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [isUpdatingItem, setIsUpdatingItem] = useState(false);
  const editImageInputRef = useRef<HTMLInputElement>(null);

  const canManageItem = (item: MarketplaceItem) => {
    const isAdmin = profile?.role === 'admin' || user?.email === ADMIN_EMAIL;
    const isMyItem = Boolean(
      (user?.id && item.artisan_id === user.id) ||
      (profile?.full_name && item.artisan_name === profile.full_name)
    );
    return isAdmin || isMyItem;
  };

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsMessage('La géolocalisation n\'est pas supportée par cet appareil.');
      return;
    }
    setIsCapturingGps(true);
    setGpsMessage('Recherche de votre position GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsCapturingGps(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const locLabel = profile?.ville ? `${profile.ville}` : 'Position GPS';
        setGpsCoordinates({ lat, lng, label: locLabel });
        setGpsMessage(`Position capturée : ${lat.toFixed(4)}, ${lng.toFixed(4)} ✅`);
      },
      () => {
        setIsCapturingGps(false);
        setGpsMessage('Impossible de capturer la position GPS (veuillez autoriser la géolocalisation).');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleCaptureEditGps = () => {
    if (!navigator.geolocation) return;
    setIsCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsCapturingGps(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setEditGpsCoordinates({ lat, lng, label: profile?.ville || 'Position GPS' });
      },
      () => {
        setIsCapturingGps(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleOpenEditItem = (item: MarketplaceItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditPrice(item.price_fcfa.toString());
    setEditCategory(item.category);
    setEditImageUrl(item.image_url);
    if (item.gps_lat && item.gps_lng) {
      setEditGpsCoordinates({ lat: item.gps_lat, lng: item.gps_lng, label: item.gps_label });
    } else {
      setEditGpsCoordinates(null);
    }
  };

  const handleSaveEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editTitle.trim() || !editPrice) return;
    setIsUpdatingItem(true);
    const numPrice = parseInt(editPrice.replace(/[^0-9]/g, '')) || 10000;
    try {
      const updated = await dataStore.updateMarketplaceItem(editingItem.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        price_fcfa: numPrice,
        category: editCategory,
        image_url: editImageUrl.trim() || editingItem.image_url,
        gps_lat: editGpsCoordinates?.lat,
        gps_lng: editGpsCoordinates?.lng,
        gps_label: editGpsCoordinates?.label
      });
      if (updated) {
        setItems(prev => prev.map(it => it.id === editingItem.id ? { ...it, ...updated } : it));
        setEditingItem(null);
      }
    } finally {
      setIsUpdatingItem(false);
    }
  };

  const handleDeleteMarketplaceItem = async (itemId: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet article de la marketplace ?')) return;
    await dataStore.deleteMarketplaceItem(itemId);
    setItems(prev => prev.filter(it => it.id !== itemId));
  };

  const MARKETPLACE_PRESETS = [
    { label: 'Salon Bois', url: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=600&q=80' },
    { label: 'Tenue Wax', url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=600&q=80' },
    { label: 'Sac Cuir', url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80' },
    { label: 'Déco Fer', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80' }
  ];

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const dataUrl = await compressImageFile(file, 1000, 0.82);
    if (dataUrl) setNewImageUrl(dataUrl);
    e.target.value = '';
  };

  const handleEditImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const dataUrl = await compressImageFile(file, 1000, 0.82);
    if (dataUrl) setEditImageUrl(dataUrl);
    e.target.value = '';
  };

  // Detail Modal
  const [detailItem, setDetailItem] = useState<MarketplaceItem | null>(null);

  const loadItems = async () => {
    try {
      const data = await dataStore.getMarketplaceItems();
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const EXPLORER_CATEGORIES = [
    { id: 'Tous', label: 'Tout voir', icon: LayoutGrid },
    { id: 'Menuiserie', label: 'Menuiserie', icon: Hammer },
    { id: 'Couture', label: 'Couture', icon: Scissors },
    { id: 'Coiffure', label: 'Coiffure', icon: Sparkles },
    { id: 'Maconnerie', label: 'Maçonnerie', icon: Building2 },
    { id: 'Plomberie', label: 'Plomberie', icon: Droplets },
    { id: 'Electricite', label: 'Électricité', icon: Zap },
    { id: 'Soudure', label: 'Soudure', icon: Flame },
    { id: 'Peinture', label: 'Peinture', icon: Paintbrush },
    { id: 'Decoration', label: 'Décoration', icon: Palette }
  ];

  const isCategoryMatch = (itemCat: string, targetId: string) => {
    if (targetId === 'Tous') return true;
    const ic = (itemCat || '').toLowerCase().trim();
    const tk = targetId.toLowerCase().trim();
    if (ic === tk || ic.includes(tk) || tk.includes(ic)) return true;
    if (tk === 'menuiserie') return ic.includes('menuis') || ic.includes('bois');
    if (tk === 'couture') return ic.includes('coutur') || ic.includes('stylis') || ic.includes('tailleur');
    if (tk === 'coiffure') return ic.includes('coiff') || ic.includes('esthét');
    if (tk === 'maconnerie' || tk === 'maçonnerie') return ic.includes('maçon') || ic.includes('macon') || ic.includes('bâti') || ic.includes('carrel');
    if (tk === 'plomberie') return ic.includes('plomb') || ic.includes('sanit');
    if (tk === 'electricite' || tk === 'électricité') return ic.includes('électr') || ic.includes('electr');
    if (tk === 'soudure') return ic.includes('soud') || ic.includes('métal') || ic.includes('ferron');
    if (tk === 'peinture') return ic.includes('peint');
    if (tk === 'decoration' || tk === 'décoration') return ic.includes('décor') || ic.includes('decor');
    return false;
  };

  const getCategoryCount = (catId: string) => {
    if (catId === 'Tous') return items.length;
    return items.filter(it => isCategoryMatch(it.category, catId)).length;
  };

  const filteredItems = items.filter(it => {
    const matchesSearch = 
      it.title.toLowerCase().includes(search.toLowerCase()) ||
      it.description.toLowerCase().includes(search.toLowerCase()) ||
      it.artisan_name.toLowerCase().includes(search.toLowerCase());

    const matchesCat = isCategoryMatch(it.category, selectedCategory);
    const matchesPays = selectedPays === 'Tous' || it.pays.toLowerCase() === selectedPays.toLowerCase();
    const matchesVille = selectedVille === 'Toutes' || it.ville.toLowerCase() === selectedVille.toLowerCase();

    return matchesSearch && matchesCat && matchesPays && matchesVille;
  });

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPrice) return;

    setIsSubmitting(true);
    const sellerName = profile?.full_name || 'Artisan Vendeur';
    const numPrice = parseInt(newPrice.replace(/[^0-9]/g, '')) || 10000;

    try {
      const created = await dataStore.createMarketplaceItem({
        title: newTitle.trim(),
        description: newDescription.trim(),
        price_fcfa: numPrice,
        artisan_id: user?.id || 'artisan-local',
        artisan_name: sellerName,
        artisan_avatar: profile?.avatar_url,
        telephone: profile?.telephone,
        category: newCategory,
        pays: profile?.pays || 'Côte d\'Ivoire',
        ville: profile?.ville || 'Abidjan',
        image_url: newImageUrl.trim() || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80',
        gps_lat: gpsCoordinates?.lat,
        gps_lng: gpsCoordinates?.lng,
        gps_label: gpsCoordinates?.label
      });

      setItems(prev => [created, ...prev]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewPrice('');
      setNewImageUrl('');
      setGpsCoordinates(null);
      setGpsMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] pb-24 pt-2">
      {/* Top search & publish banner */}
      <div className="w-[92%] mx-auto mb-4 space-y-3">
        {/* Anti-Scam / Direct Contact Banner */}
        <div className="p-3 rounded-2xl bg-orange-50/80 border border-orange-200/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FF6B1A] shrink-0" />
            <span className="text-neutral-700 font-medium">
              Mise en relation directe avec l'artisan • <strong className="text-neutral-900">Zéro faux frais</strong>
            </span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-2.5 py-1 rounded-xl bg-[#FF6B1A] hover:bg-[#e05e00] text-white font-bold text-[11px] shrink-0 cursor-pointer flex items-center gap-1 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Vendre</span>
          </button>
        </div>

        {/* Barre de recherche: blanche, arrondie full (pill), icone loupe orange #FF7A00 à gauche, placeholder gris */}
        <div className="relative w-full">
          <Search className="w-5 h-5 text-[#FF7A00] absolute left-4 top-1/2 -translate-y-1/2 stroke-[2.2px] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un artisan, un produit, un service..."
            className="w-full pl-12 pr-10 py-3 rounded-full bg-white border border-neutral-200/90 text-sm text-neutral-900 placeholder:text-neutral-400 shadow-xs focus:outline-hidden focus:border-[#FF7A00] transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Titre section: "Explorer par categorie" en gras noir, 20px */}
        <div className="pt-2">
          <h2 className="text-[20px] font-bold text-neutral-900 tracking-tight">
            Explorer par categorie
          </h2>
        </div>

        {/* Grille de cartes: 3 colonnes sur mobile, 2 colonnes sur très petit écran, gap 12px */}
        <div className="grid grid-cols-2 min-[360px]:grid-cols-3 gap-3">
          {EXPLORER_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id || (cat.id === 'Tous' && (selectedCategory === 'Tous' || !selectedCategory));
            const count = getCategoryCount(cat.id);

            return (
              <div
                key={cat.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCategory(cat.id)}
                className={`relative bg-white rounded-[20px] p-3 pt-4 pb-3 shadow-xs hover:shadow-sm flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                  isActive
                    ? 'border-2 border-[#FF7A00]'
                    : 'border border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {/* Petit badge rond jaune clair en haut à droite avec chiffre "0" gris */}
                <span className="absolute top-2.5 right-2.5 min-w-[20px] h-5 px-1 rounded-full bg-[#FEF9C3] text-neutral-500 text-[10px] font-semibold flex items-center justify-center border border-amber-200/60 shadow-2xs">
                  {count}
                </span>

                {/* Icone line orange en haut centre, taille 32px, style outline minimaliste */}
                <div className="w-8 h-8 flex items-center justify-center text-[#FF7A00] mb-2">
                  <Icon className="w-8 h-8 stroke-[1.8px]" />
                </div>

                {/* Texte noir en dessous, 14px semi-bold, centré */}
                <span className="text-[14px] font-semibold text-neutral-900 text-center leading-tight tracking-tight">
                  {cat.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Country & City Filter */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <select
            value={selectedPays}
            onChange={(e) => {
              setSelectedPays(e.target.value);
              setSelectedVille('Toutes');
            }}
            className="w-full px-3 py-2 rounded-xl bg-white border border-neutral-200 text-neutral-700 font-medium cursor-pointer"
          >
            <option value="Tous">Tous les pays</option>
            {PAYS_AFRIQUE.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            value={selectedVille}
            onChange={(e) => setSelectedVille(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white border border-neutral-200 text-neutral-700 font-medium cursor-pointer"
          >
            <option value="Toutes">Toutes les villes</option>
            {selectedPays !== 'Tous' && VILLES_PAR_PAYS[selectedPays] ? (
              VILLES_PAR_PAYS[selectedPays].map(v => (
                <option key={v} value={v}>{v}</option>
              ))
            ) : (
              ['Abidjan', 'Dakar', 'Cotonou', 'Lomé', 'Bamako', 'Douala'].map(v => (
                <option key={v} value={v}>{v}</option>
              ))
            )}
          </select>
        </div>

        {/* Titre "Annonces Premium" avec 2 etoiles orange */}
        <div className="flex items-center gap-2 pt-3 pb-1">
          <Star className="w-5 h-5 text-[#FF7A00] fill-[#FF7A00] shrink-0" />
          <h2 className="text-[20px] font-bold text-neutral-900 tracking-tight">
            Annonces Premium
          </h2>
          <Star className="w-5 h-5 text-[#FF7A00] fill-[#FF7A00] shrink-0" />
        </div>
      </div>

      {/* Grid of Marketplace Cards */}
      <div className="w-[92%] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading ? (
          [1, 2, 3, 4].map(n => (
            <div key={n} className="bg-white rounded-3xl p-3 border border-neutral-200 animate-pulse space-y-2">
              <div className="h-40 bg-neutral-200 rounded-2xl w-full" />
              <div className="h-4 bg-neutral-200 rounded-sm w-3/4" />
              <div className="h-4 bg-neutral-200 rounded-sm w-1/2" />
            </div>
          ))
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full bg-white rounded-3xl border border-neutral-200 p-8 text-center">
            <Sparkles className="w-8 h-8 text-[#FF6B1A] mx-auto mb-2" />
            <h3 className="font-bold text-neutral-800 text-sm mb-1">Aucune offre disponible</h3>
            <p className="text-xs text-neutral-500 mb-4">Soyez le premier artisan à publier une offre sur la marketplace !</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="py-2.5 px-5 rounded-xl bg-[#FF6B1A] text-white font-bold text-xs"
            >
              Publier une offre
            </button>
          </div>
        ) : (
          filteredItems.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between group"
            >
              <div
                onClick={() => setDetailItem(item)}
                className="cursor-pointer"
              >
                {/* Photo & Category Tag */}
                <div className="relative h-44 bg-neutral-100 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold">
                    {item.category}
                  </span>
                </div>

                {/* Details */}
                <div className="p-4 pb-2">
                  <div className="flex items-baseline justify-between gap-1 mb-1">
                    <span className="text-base font-extrabold text-[#FF6B1A]">
                      {item.price_fcfa.toLocaleString('fr-FR')} FCFA
                    </span>
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-neutral-400" />
                      {item.ville}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-neutral-900 line-clamp-1 group-hover:text-[#FF6B1A] transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs text-neutral-500 line-clamp-2 mt-1 leading-relaxed">
                    {item.description}
                  </p>

                  {/* GPS Badge if captured */}
                  {item.gps_lat && item.gps_lng && (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <a
                        href={`https://www.google.com/maps?q=${item.gps_lat},${item.gps_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors"
                        title="Voir la position GPS sur Google Maps"
                      >
                        <LocateFixed className="w-3 h-3 text-emerald-600" />
                        <span>GPS vérifié</span>
                        <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Artisan Seller & Action Buttons */}
              <div className="p-4 pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={
                      item.artisan_avatar ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.artisan_name)}&backgroundColor=FF6B1A`
                    }
                    alt={item.artisan_name}
                    className="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                  <span className="text-xs font-semibold text-neutral-700 truncate">
                    {item.artisan_name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* BOUTONS MODIFIER & SUPPRIMER (RÉSERVÉ À L'AUTEUR OU À L'ADMINISTRATEUR) */}
                  {canManageItem(item) && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditItem(item)}
                        className="p-1.5 text-neutral-400 hover:text-[#FF6B1A] hover:bg-orange-50 rounded-xl transition-colors cursor-pointer"
                        title="Modifier l'article"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMarketplaceItem(item.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title={profile?.role === 'admin' ? "Supprimer l'article (Admin)" : "Supprimer mon article"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => onContactSeller(item)}
                    className="px-3 py-1.5 rounded-xl bg-[#FF6B1A] hover:bg-[#e05e00] text-white text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1 shadow-xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Contacter</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DETAIL MODAL */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="relative h-56 bg-neutral-100 shrink-0">
              <img
                src={detailItem.image_url}
                alt={detailItem.title}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setDetailItem(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <span className="absolute bottom-3 left-4 px-3 py-1 rounded-full bg-[#FF6B1A] text-white text-xs font-bold shadow-md">
                {detailItem.category}
              </span>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div>
                <div className="text-xl font-extrabold text-[#FF6B1A] mb-1">
                  {detailItem.price_fcfa.toLocaleString('fr-FR')} FCFA
                </div>
                <h2 className="text-lg font-bold text-neutral-900 leading-snug">
                  {detailItem.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{detailItem.ville}, {detailItem.pays}</span>
                </div>
              </div>

              <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/60 text-xs space-y-1">
                <span className="font-bold text-neutral-800 uppercase tracking-wide text-[10px] block">
                  Description de l'article
                </span>
                <p className="text-neutral-700 leading-relaxed whitespace-pre-line">
                  {detailItem.description}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/60 text-xs text-amber-900">
                <strong>Règle de sécurité ArtisanPro :</strong> Échangez directement avec l'artisan pour fixer le rendez-vous ou la livraison. Aucun prélèvement bancaire automatique.
              </div>

              <button
                onClick={() => {
                  const it = detailItem;
                  setDetailItem(null);
                  onContactSeller(it);
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#FF6B1A] hover:bg-[#e05e00] text-white font-bold text-sm shadow-md shadow-[#FF6B1A]/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Discuter avec l'artisan vendeur</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE OFFER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-[#FF6B1A]" />
                Publier une offre sur la Marketplace
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOffer} className="p-5 space-y-3.5 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Titre de l'article ou de l'offre *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Salon 6 places en bois de Teck massif"
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B1A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Prix (en FCFA) *
                  </label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="25000"
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B1A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B1A] bg-white cursor-pointer"
                  >
                    {METIERS_LIST.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* BOUTON CAPTURE GPS APRÈS PRIX ET CATÉGORIE */}
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-[#FF6B1A]" />
                    Localisation GPS de l'article
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    disabled={isCapturingGps}
                    className="px-3 py-1.5 rounded-xl bg-[#FF6B1A] hover:bg-[#e05e00] text-white text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>{isCapturingGps ? 'Capture GPS...' : '📍 Capturer GPS'}</span>
                  </button>
                </div>
                {gpsCoordinates ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span className="truncate">Position capturée : {gpsCoordinates.lat.toFixed(4)}, {gpsCoordinates.lng.toFixed(4)} ({gpsCoordinates.label})</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-500">
                    Cliquez sur « Capturer GPS » pour enregistrer l'endroit exact et faciliter la tâche des clients.
                  </p>
                )}
                {gpsMessage && !gpsCoordinates && (
                  <p className="text-[11px] text-neutral-600 italic">{gpsMessage}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Description détaillée
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Matériaux, dimensions, état, options sur-mesure..."
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B1A] resize-none"
                />
              </div>

              {/* Hidden file input for product photo */}
              <input
                ref={itemImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Photo de l'article (depuis votre galerie)
                </label>

                <button
                  type="button"
                  onClick={() => itemImageInputRef.current?.click()}
                  className="w-full py-3.5 px-4 rounded-2xl bg-orange-50 hover:bg-orange-100 border-2 border-dashed border-[#FF6B1A]/50 text-[#FF6B1A] text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs mb-2"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Choisir une photo depuis ma galerie</span>
                </button>

                {newImageUrl ? (
                  <div className="relative rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200 h-36">
                    <img src={newImageUrl} alt="Aperçu article" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setNewImageUrl('')}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] text-neutral-400 font-medium block mb-1">
                      Ou choisissez une photo type en 1 clic :
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {MARKETPLACE_PRESETS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setNewImageUrl(p.url)}
                          className="relative rounded-xl overflow-hidden aspect-square border border-neutral-200 hover:border-[#FF6B1A] transition-all cursor-pointer group"
                        >
                          <img src={p.url} alt={p.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] font-bold text-center py-0.5 truncate px-0.5">
                            {p.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim() || !newPrice}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#FF6B1A] hover:bg-[#e05e00] disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-[#FF6B1A]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? 'Publication en cours...' : 'Mettre en vente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MARKETPLACE OFFER MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-1.5">
                <Pencil className="w-4 h-4 text-[#FF6B1A]" />
                Modifier l'offre Marketplace
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditItem} className="p-5 space-y-3.5 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Titre de l'article *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Titre de l'article..."
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B1A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Prix (FCFA) *
                  </label>
                  <input
                    type="number"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="25000"
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B1A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B1A] bg-white cursor-pointer"
                  >
                    {METIERS_LIST.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* BOUTON CAPTURE GPS DANS LA MODIFICATION */}
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-[#FF6B1A]" />
                    Position GPS
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureEditGps}
                    disabled={isCapturingGps}
                    className="px-3 py-1.5 rounded-xl bg-[#FF6B1A] hover:bg-[#e05e00] text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>{isCapturingGps ? 'Capture...' : '📍 Mettre à jour GPS'}</span>
                  </button>
                </div>
                {editGpsCoordinates ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>GPS enregistré : {editGpsCoordinates.lat.toFixed(4)}, {editGpsCoordinates.lng.toFixed(4)}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-neutral-500 block">Aucune coordonnée GPS enregistrée.</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Description détaillée
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B1A] resize-none"
                />
              </div>

              <input
                ref={editImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleEditImageFileChange}
                className="hidden"
              />

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-neutral-700">Photo de l'article</label>
                  <button
                    type="button"
                    onClick={() => editImageInputRef.current?.click()}
                    className="text-xs font-bold text-[#FF6B1A] hover:underline cursor-pointer"
                  >
                    Changer l'image
                  </button>
                </div>
                {editImageUrl && (
                  <div className="relative h-28 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200">
                    <img src={editImageUrl} alt="Aperçu" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingItem || !editTitle.trim() || !editPrice}
                  className="py-2.5 px-4 rounded-xl bg-[#FF6B1A] hover:bg-[#e05e00] text-white font-bold text-xs shadow-md shadow-[#FF6B1A]/20 cursor-pointer"
                >
                  {isUpdatingItem ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
