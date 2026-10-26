import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MapPin, 
  Star, 
  CheckCircle, 
  Phone, 
  MessageSquare, 
  X, 
  ShieldCheck, 
  Sparkles,
  ExternalLink,
  Plus,
  Camera,
  Check,
  Heart,
  Users,
  UserPlus,
  UserCheck,
  AlertTriangle,
  Navigation,
  LocateFixed,
  Trash2,
  Pencil
} from 'lucide-react';
import { Artisan } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { useAuth } from '../../context/AuthContext';
import { METIERS_LIST, PAYS_AFRIQUE, VILLES_PAR_PAYS, ADMIN_EMAIL } from '../../lib/supabase';

interface ArtisansDirectoryProps {
  onOpenChatWith: (artisan: Artisan) => void;
}

export const ArtisansDirectory: React.FC<ArtisansDirectoryProps> = ({ onOpenChatWith }) => {
  const { profile, isAdmin } = useAuth();
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMetier, setSelectedMetier] = useState('Tous');
  const [selectedPays, setSelectedPays] = useState('Tous');
  const [selectedVille, setSelectedVille] = useState('Toutes');
  const [selectedArtisan, setSelectedArtisan] = useState<Artisan | null>(null);

  // Modal Publier profil artisan (+ button)
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newMetier, setNewMetier] = useState<string>(METIERS_LIST[0]);
  const [newVille, setNewVille] = useState('Abidjan');
  const [newPays, setNewPays] = useState('Côte d\'Ivoire');
  const [newTelephone, setNewTelephone] = useState('');
  const [newAdresseMagasin, setNewAdresseMagasin] = useState('');
  const [newRepereRue, setNewRepereRue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTarifMin, setNewTarifMin] = useState('15000');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // GPS capture state for new artisan
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsMessage, setGpsMessage] = useState('');

  // Edit artisan state
  const [editingArtisan, setEditingArtisan] = useState<Artisan | null>(null);
  const [editNom, setEditNom] = useState('');
  const [editMetier, setEditMetier] = useState('');
  const [editVille, setEditVille] = useState('');
  const [editTelephone, setEditTelephone] = useState('');
  const [editAdresseMagasin, setEditAdresseMagasin] = useState('');
  const [editRepereRue, setEditRepereRue] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTarifMin, setEditTarifMin] = useState('15000');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editGpsCoordinates, setEditGpsCoordinates] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [isUpdatingArtisan, setIsUpdatingArtisan] = useState(false);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  const canManageArtisan = (a: Artisan) => {
    const isAdm = Boolean(isAdmin || profile?.role === 'admin' || profile?.email === ADMIN_EMAIL);
    const isMine = Boolean(
      (profile?.id && (a.id === profile.id || a.user_id === profile.id)) ||
      (profile?.full_name && a.nom.toLowerCase() === profile.full_name.toLowerCase())
    );
    return isAdm || isMine;
  };

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsMessage('La géolocalisation n\'est pas supportée par cet appareil.');
      return;
    }
    setIsCapturingGps(true);
    setGpsMessage('Recherche de la position GPS de votre atelier...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsCapturingGps(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGpsCoordinates({ lat, lng, label: newVille || 'Atelier' });
        setGpsMessage(`Position GPS capturée : ${lat.toFixed(4)}, ${lng.toFixed(4)} ✅`);
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
        setEditGpsCoordinates({ lat, lng, label: editVille || 'Atelier' });
      },
      () => {
        setIsCapturingGps(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleOpenEditArtisan = (a: Artisan) => {
    setEditingArtisan(a);
    setEditNom(a.nom);
    setEditMetier(a.metier);
    setEditVille(a.ville);
    setEditTelephone(a.telephone || a.whatsapp || '');
    setEditAdresseMagasin(a.adresse_magasin || '');
    setEditRepereRue(a.repere_rue || '');
    setEditDescription(a.description || '');
    setEditTarifMin((a.tarif_min || 15000).toString());
    setEditPhotoUrl(Array.isArray(a.photos) ? a.photos[0] || '' : a.photos || '');
    if (a.gps_lat && a.gps_lng) {
      setEditGpsCoordinates({ lat: a.gps_lat, lng: a.gps_lng, label: a.gps_label });
    } else {
      setEditGpsCoordinates(null);
    }
  };

  const handleSaveEditArtisan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArtisan || !editNom.trim()) return;
    setIsUpdatingArtisan(true);
    try {
      const updated = await dataStore.updateArtisan(editingArtisan.id, {
        nom: editNom.trim(),
        metier: editMetier,
        ville: editVille,
        telephone: editTelephone.trim(),
        whatsapp: editTelephone.trim(),
        adresse_magasin: editAdresseMagasin.trim() || undefined,
        repere_rue: editRepereRue.trim() || undefined,
        description: editDescription.trim(),
        tarif_min: parseInt(editTarifMin.replace(/[^0-9]/g, '')) || 15000,
        photos: editPhotoUrl ? [editPhotoUrl] : editingArtisan.photos,
        gps_lat: editGpsCoordinates?.lat,
        gps_lng: editGpsCoordinates?.lng,
        gps_label: editGpsCoordinates?.label
      });
      if (updated) {
        setArtisans(prev => prev.map(a => a.id === editingArtisan.id ? { ...a, ...updated } : a));
        if (selectedArtisan && selectedArtisan.id === editingArtisan.id) {
          setSelectedArtisan({ ...selectedArtisan, ...updated });
        }
        setEditingArtisan(null);
      }
    } finally {
      setIsUpdatingArtisan(false);
    }
  };

  const handleDeleteArtisan = async (artisanId: string) => {
    if (!window.confirm('Voulez-vous vraiment retirer ce profil artisan ?')) return;
    await dataStore.deleteArtisan(artisanId);
    setArtisans(prev => prev.filter(a => a.id !== artisanId));
    if (selectedArtisan?.id === artisanId) {
      setSelectedArtisan(null);
    }
  };

  // Followers & Likes tracking for artisans
  const [, setRefreshTrigger] = useState(0);

  const isArtisanFollowed = (id: string) => {
    return dataStore.isUserFollowed(id, profile?.id);
  };

  const isArtisanLiked = (id: string) => {
    return dataStore.isUserLiked(id, profile?.id);
  };

  const getArtisanFollowers = (id: string) => {
    return dataStore.getUserFollowersCount(id);
  };

  const getArtisanLikes = (id: string) => {
    return dataStore.getUserLikesCount(id);
  };

  const handleToggleFollowArtisan = (id: string) => {
    dataStore.toggleFollowUser(id, profile?.id);
    setRefreshTrigger(p => p + 1);
  };

  const handleToggleLikeArtisan = (id: string) => {
    dataStore.toggleUserLike(id, profile?.id);
    setRefreshTrigger(p => p + 1);
  };

  useEffect(() => {
    dataStore.getArtisans().then(list => {
      setArtisans(list);
      setLoading(false);
    });
  }, []);

  const handleCountryChange = (country: string) => {
    setSelectedPays(country);
    setSelectedVille('Toutes');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) setNewPhotoUrl(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleEditPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) setEditPhotoUrl(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreateArtisanProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNom.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await dataStore.addCustomArtisan({
        nom: newNom.trim(),
        metier: newMetier,
        ville: newVille,
        telephone: newTelephone.trim(),
        whatsapp: newTelephone.trim(),
        adresse_magasin: newAdresseMagasin.trim() || undefined,
        repere_rue: newRepereRue.trim() || undefined,
        description: newDescription.trim() || 'Artisan professionnel qualifié et disponible.',
        tarif_min: parseInt(newTarifMin.replace(/[^0-9]/g, '')) || 15000,
        photos: newPhotoUrl ? [newPhotoUrl] : [`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(newNom)}&backgroundColor=FF6B00&fontFamily=Arial&fontSize=42`],
        verifie: true,
        badge_bleu: true,
        badge_vert: true,
        gps_lat: gpsCoordinates?.lat,
        gps_lng: gpsCoordinates?.lng,
        gps_label: gpsCoordinates?.label,
        user_id: profile?.id
      });

      setArtisans(prev => [created, ...prev]);
      setShowPublishModal(false);
      setNewNom('');
      setNewTelephone('');
      setNewAdresseMagasin('');
      setNewRepereRue('');
      setNewDescription('');
      setNewPhotoUrl('');
      setGpsCoordinates(null);
      setGpsMessage('');
    } catch (err) {
      console.error('Error adding artisan:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Authentic avatar generator - ZERO DEMO IMAGES
  const getArtisanPhoto = (artisan: Artisan): string => {
    if (Array.isArray(artisan.photos) && artisan.photos[0] && !artisan.photos[0].includes('photo-1581578731548')) {
      return artisan.photos[0];
    }
    if (typeof artisan.photos === 'string' && artisan.photos && !artisan.photos.includes('photo-1581578731548')) {
      return artisan.photos;
    }
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(artisan.nom)}&backgroundColor=FF6B00&fontFamily=Arial&fontSize=42`;
  };

  const filteredArtisans = artisans.filter(a => {
    const matchesSearch = 
      a.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.metier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesMetier = selectedMetier === 'Tous' || a.metier.toLowerCase() === selectedMetier.toLowerCase();
    const matchesPays = selectedPays === 'Tous' || true; // flexible
    const matchesVille = selectedVille === 'Toutes' || a.ville.toLowerCase() === selectedVille.toLowerCase();

    return matchesSearch && matchesMetier && matchesPays && matchesVille;
  });

  return (
    <div className="pb-24 pt-2">
      {/* Top Header with + Button to publish on artisan page */}
      <div className="w-[92%] mx-auto mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-neutral-900 tracking-tight">
            Place des Artisans
          </h1>
          <p className="text-xs text-neutral-500">
            Profils vérifiés et artisans certifiés d'Afrique
          </p>
        </div>

        {/* Petit bouton + pour publier sur la page d'artisans */}
        <button
          onClick={() => {
            if (profile) {
              setNewNom(profile.full_name || '');
              if (profile.metier) setNewMetier(profile.metier);
              if (profile.ville) setNewVille(profile.ville);
              if (profile.telephone) setNewTelephone(profile.telephone);
              if (profile.avatar_url) setNewPhotoUrl(profile.avatar_url);
            }
            setShowPublishModal(true);
          }}
          className="py-2 px-3.5 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF6B00]/25 transition-all cursor-pointer active:scale-95 shrink-0"
          title="Publier sur la page d'artisans"
        >
          <Plus className="w-4 h-4" />
          <span>+ Publier artisan</span>
        </button>
      </div>

      {/* Top Filter & Search Section */}
      <div className="w-[92%] mx-auto mb-4 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un artisan (électricien, couturier, ville...)"
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-neutral-200/90 text-sm shadow-xs focus:outline-hidden focus:border-[#FF6B00]"
          />
        </div>

        {/* Métiers Pills Horizontal Scroll */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
          <button
            onClick={() => setSelectedMetier('Tous')}
            className={`px-3 py-1.5 rounded-full shrink-0 transition-colors cursor-pointer ${
              selectedMetier === 'Tous'
                ? 'bg-[#FF6B00] text-white shadow-xs'
                : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            Tous les métiers
          </button>
          {METIERS_LIST.map(m => (
            <button
              key={m}
              onClick={() => setSelectedMetier(m)}
              className={`px-3 py-1.5 rounded-full shrink-0 transition-colors cursor-pointer ${
                selectedMetier === m
                  ? 'bg-[#FF6B00] text-white shadow-xs'
                  : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Location Dropdowns */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <select
            value={selectedPays}
            onChange={(e) => handleCountryChange(e.target.value)}
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
              ['Abidjan', 'Dakar', 'Cotonou', 'Lomé', 'Bamako', 'Douala', 'Ouagadougou'].map(v => (
                <option key={v} value={v}>{v}</option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Artisans List Grid */}
      <div className="w-[92%] mx-auto space-y-3.5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-white rounded-2xl p-4 border border-neutral-200 animate-pulse flex gap-3">
                <div className="w-16 h-16 bg-neutral-200 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-4 bg-neutral-200 rounded-sm" />
                  <div className="w-20 h-3 bg-neutral-200 rounded-sm" />
                  <div className="w-full h-3 bg-neutral-200 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredArtisans.length === 0 ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-8 text-center">
            <Sparkles className="w-8 h-8 text-[#FF6B00] mx-auto mb-2" />
            <h3 className="font-bold text-neutral-800 text-sm mb-1">Aucun artisan trouvé</h3>
            <p className="text-xs text-neutral-500">Essayez d'élargir vos filtres de recherche ou de métier.</p>
          </div>
        ) : (
          filteredArtisans.map((artisan) => {
            const photo = getArtisanPhoto(artisan);

            return (
              <div
                key={artisan.id}
                onClick={() => setSelectedArtisan(artisan)}
                className="bg-white rounded-3xl p-4 border border-neutral-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row gap-3.5 group"
              >
                {/* Photo */}
                <div className="relative w-full sm:w-28 h-32 sm:h-28 rounded-2xl overflow-hidden bg-neutral-100 shrink-0">
                  <img
                    src={photo}
                    alt={artisan.nom}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {artisan.verifie && (
                    <span className="absolute top-2 left-2 bg-[#FF6B00] text-white p-1 rounded-full shadow-xs" title="Artisan Vérifié">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-extrabold text-sm sm:text-base text-neutral-900 group-hover:text-[#FF6B00] transition-colors">
                            {artisan.nom}
                          </h3>
                          {artisan.verifie && (
                            <CheckCircle className="w-4 h-4 text-[#FF6B00] shrink-0" />
                          )}
                        </div>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-orange-50 text-[#FF6B00] font-bold text-[11px] mt-0.5">
                          {artisan.metier}
                        </span>
                      </div>

                      {/* Rating */}
                      <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg text-xs font-bold text-amber-700 shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{artisan.note_moyenne || '5.0'}</span>
                        <span className="text-[10px] text-amber-600/80">({artisan.nombre_avis || 1})</span>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-600 line-clamp-2 mt-1 leading-relaxed">
                      {artisan.description || artisan.services || 'Artisan professionnel disponible pour tous travaux.'}
                    </p>
                  </div>

                  {/* LIGNE DROITE AU PROFIL DE L'ARTISAN : NOMBRE D'ABONNÉS + NOMBRE DE LIKE + BOUTON ABONNÉ */}
                  <div 
                    onClick={(e) => e.stopPropagation()} 
                    className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between gap-1 text-[11px]"
                  >
                    {/* Abonnés */}
                    <div className="flex items-center gap-1 text-neutral-600">
                      <Users className="w-3.5 h-3.5 text-[#FF6B00]" />
                      <span className="font-bold text-neutral-900">{getArtisanFollowers(artisan.id)}</span>
                      <span className="text-[10px] text-neutral-400">abonnés</span>
                    </div>

                    {/* Likes */}
                    <button
                      type="button"
                      onClick={() => handleToggleLikeArtisan(artisan.id)}
                      className="flex items-center gap-1 text-neutral-600 hover:text-red-500 cursor-pointer transition-colors"
                      title="Aimer cet artisan"
                    >
                      <Heart className={`w-3.5 h-3.5 ${isArtisanLiked(artisan.id) ? 'fill-red-500 text-red-500' : 'text-neutral-400'}`} />
                      <span className="font-bold text-neutral-900">{getArtisanLikes(artisan.id)}</span>
                    </button>

                    {/* Bouton Abonné */}
                    <button
                      type="button"
                      onClick={() => handleToggleFollowArtisan(artisan.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                        isArtisanFollowed(artisan.id)
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 shadow-xs'
                          : 'bg-orange-50 text-[#FF6B00] hover:bg-orange-100'
                      }`}
                      title={isArtisanFollowed(artisan.id) ? 'Abonné (cliquer pour se désabonner)' : 'S\'abonner'}
                    >
                      {isArtisanFollowed(artisan.id) ? (
                        <>
                          <UserCheck className="w-3 h-3" />
                          <span>Abonné</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" />
                          <span>S'abonner</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Bottom details */}
                  <div className="pt-2 flex items-center justify-between border-t border-neutral-100/60 mt-1.5 text-xs flex-wrap gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-neutral-500 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{artisan.ville}</span>
                      </span>

                      {/* GPS Badge if captured */}
                      {artisan.gps_lat && artisan.gps_lng && (
                        <a
                          href={`https://www.google.com/maps?q=${artisan.gps_lat},${artisan.gps_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors"
                          title="Localisation GPS de l'atelier sur Google Maps"
                        >
                          <LocateFixed className="w-3 h-3 text-emerald-600" />
                          <span>GPS Atelier</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#FF6B00] text-xs">
                        Dès {(artisan.tarif_min || 15000).toLocaleString('fr-FR')} FCFA
                      </span>

                      {/* BOUTONS MODIFIER & SUPPRIMER (RÉSERVÉ À L'ARTISAN OU À L'ADMINISTRATEUR) */}
                      {canManageArtisan(artisan) && (
                        <div 
                          onClick={(e) => e.stopPropagation()} 
                          className="flex items-center gap-1 pl-1 border-l border-neutral-200"
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenEditArtisan(artisan)}
                            className="p-1 text-neutral-400 hover:text-[#FF6B00] hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                            title="Modifier le profil artisan"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteArtisan(artisan.id)}
                            className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title={isAdmin ? "Supprimer l'artisan (Admin)" : "Supprimer mon profil"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ARTISAN DETAIL MODAL */}
      {selectedArtisan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header image banner */}
            <div className="relative h-44 bg-neutral-900 shrink-0">
              <img
                src={getArtisanPhoto(selectedArtisan)}
                alt={selectedArtisan.nom}
                className="w-full h-full object-cover opacity-90"
              />
              <button
                onClick={() => setSelectedArtisan(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                <span className="px-3 py-1 rounded-full bg-[#FF6B00] text-white font-extrabold text-xs shadow-md">
                  {selectedArtisan.metier}
                </span>
                <div className="flex items-center gap-1 bg-white/95 px-2.5 py-1 rounded-xl text-xs font-bold text-neutral-800 shadow-md">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{selectedArtisan.note_moyenne || '5.0'}</span>
                  <span className="text-neutral-500 text-[10px]">({selectedArtisan.nombre_avis || 1} avis)</span>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <h2 className="text-lg font-extrabold text-neutral-900">
                    {selectedArtisan.nom}
                  </h2>
                  {selectedArtisan.verifie && (
                    <span title="Vérifié">
                      <CheckCircle className="w-5 h-5 text-[#FF6B00]" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{selectedArtisan.ville}{selectedArtisan.commune ? `, ${selectedArtisan.commune}` : ''}</span>
                  <span>•</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Disponible immédiatement
                  </span>
                </div>

                {(selectedArtisan.adresse_magasin || selectedArtisan.repere_rue) && (
                  <div className="pt-2">
                    <div className="p-2.5 rounded-2xl bg-orange-50/80 border border-orange-100 flex items-start gap-2 text-xs">
                      <MapPin className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        {selectedArtisan.adresse_magasin && (
                          <p className="font-bold text-neutral-900 leading-snug">
                            {selectedArtisan.adresse_magasin}
                          </p>
                        )}
                        {selectedArtisan.repere_rue && (
                          <p className="text-[11px] text-neutral-600 mt-0.5">
                            <span className="font-semibold text-neutral-800">Repère / Rue :</span> {selectedArtisan.repere_rue}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* LIGNE DROITE AU PROFIL : NOMBRE D'ABONNÉS + NOMBRE DE LIKE + BOUTON ABONNÉ */}
              <div className="py-2.5 px-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/70 flex items-center justify-between gap-2 shadow-xs">
                {/* 1. Nombre d'abonnés */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-100/80 text-[#FF6B00] flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="leading-tight">
                    <span className="block font-black text-sm text-neutral-900 leading-none">
                      {getArtisanFollowers(selectedArtisan.id)}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                      Abonnés
                    </span>
                  </div>
                </div>

                <div className="h-6 w-px bg-neutral-200" />

                {/* 2. Nombre de likes */}
                <button
                  type="button"
                  onClick={() => handleToggleLikeArtisan(selectedArtisan.id)}
                  className="flex items-center gap-2 group cursor-pointer hover:opacity-85 transition-opacity"
                  title="Aimer cet artisan"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isArtisanLiked(selectedArtisan.id) ? 'bg-red-100 text-red-500' : 'bg-white text-neutral-500 border border-neutral-200 group-hover:text-red-500'
                  }`}>
                    <Heart className={`w-4 h-4 transition-transform group-active:scale-125 ${isArtisanLiked(selectedArtisan.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </div>
                  <div className="text-left leading-tight">
                    <span className="block font-black text-sm text-neutral-900 leading-none">
                      {getArtisanLikes(selectedArtisan.id)}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                      J'aime
                    </span>
                  </div>
                </button>

                <div className="h-6 w-px bg-neutral-200" />

                {/* 3. Bouton Abonné */}
                <button
                  type="button"
                  onClick={() => handleToggleFollowArtisan(selectedArtisan.id)}
                  className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 ${
                    isArtisanFollowed(selectedArtisan.id)
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/30'
                      : 'bg-[#FF6B00] hover:bg-[#e05e00] text-white shadow-md shadow-[#FF6B00]/25'
                  }`}
                  title={isArtisanFollowed(selectedArtisan.id) ? 'Abonné (cliquer pour se désabonner)' : 'S\'abonner'}
                >
                  {isArtisanFollowed(selectedArtisan.id) ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Abonné</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>S'abonner</span>
                    </>
                  )}
                </button>
              </div>

              {/* Bio & Services */}
              <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/60 text-xs space-y-2">
                <h4 className="font-bold text-neutral-900 uppercase tracking-wide text-[11px]">
                  À propos & Services
                </h4>
                <p className="text-neutral-700 leading-relaxed">
                  {selectedArtisan.description || 'Artisan passionné et expérimenté, garantissant un travail soigné et dans les délais impartis.'}
                </p>
                {selectedArtisan.services && (
                  <p className="text-neutral-600 pt-1 border-t border-neutral-200/50">
                    <strong className="text-neutral-800">Prestations :</strong> {selectedArtisan.services}
                  </p>
                )}
              </div>

              {/* Tarifs indicatifs */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-orange-50/60 border border-orange-100 text-xs">
                <div>
                  <span className="text-neutral-600 block text-[11px]">Tarif indicatif de départ</span>
                  <span className="text-base font-extrabold text-[#FF6B00]">
                    {(selectedArtisan.tarif_min || 15000).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <span className="text-[10px] text-neutral-500 max-w-[120px] text-right">
                  Devis personnalisé sans engagement
                </span>
              </div>

              {/* GPS Atelier banner if captured */}
              {selectedArtisan.gps_lat && selectedArtisan.gps_lng && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <LocateFixed className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="block font-bold text-xs text-emerald-950">Position GPS de l'Atelier</span>
                      <span className="text-[10px] text-emerald-800 truncate block">
                        {selectedArtisan.gps_lat.toFixed(4)}, {selectedArtisan.gps_lng.toFixed(4)} ({selectedArtisan.gps_label || selectedArtisan.ville})
                      </span>
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${selectedArtisan.gps_lat},${selectedArtisan.gps_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] flex items-center gap-1 shrink-0 shadow-xs"
                    title="Voir l'itinéraire sur Google Maps"
                  >
                    <span>Itinéraire Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Direct Actions */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    const a = selectedArtisan;
                    setSelectedArtisan(null);
                    onOpenChatWith(a);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-bold text-sm shadow-md shadow-[#FF6B00]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Contacter par Chat Interne</span>
                </button>

                {selectedArtisan.whatsapp && (
                  <a
                    href={`https://wa.me/${selectedArtisan.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Bonjour ${selectedArtisan.nom}, je vous contacte depuis ArtisanPro Afrique au sujet d'un devis.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2"
                  >
                    <Phone className="w-4 h-4" />
                    <span>WhatsApp Direct ({selectedArtisan.whatsapp})</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                  </a>
                )}

                {/* BOUTONS MODIFIER & SUPPRIMER (RÉSERVÉ À L'ARTISAN OU À L'ADMINISTRATEUR) */}
                {canManageArtisan(selectedArtisan) && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedArtisan;
                        setSelectedArtisan(null);
                        handleOpenEditArtisan(target);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF6B00] border border-orange-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Modifier le profil</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteArtisan(selectedArtisan.id)}
                      className="py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isAdmin ? "Supprimer (Admin)" : "Supprimer"}</span>
                    </button>
                  </div>
                )}

                {/* RÉSERVÉ STRICTEMENT À L'ADMIN : Bouton pour suspendre le compte si non-respect des règles */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={async () => {
                      const isSusp = dataStore.isUserSuspended(selectedArtisan.id);
                      const promptMsg = isSusp 
                        ? `Voulez-vous réactiver le compte de ${selectedArtisan.nom} ?`
                        : `Voulez-vous suspendre le compte de ${selectedArtisan.nom} pour non-respect des règles de la plateforme ?`;
                      if (window.confirm(promptMsg)) {
                        await dataStore.toggleSuspendUser(selectedArtisan.id, 'Non-respect des règles de la plateforme');
                        alert(isSusp ? 'Compte artisan réactivé.' : 'Compte artisan suspendu pour non-respect des règles.');
                        setSelectedArtisan(null);
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {dataStore.isUserSuspended(selectedArtisan.id) ? 'Réactiver cet artisan (Admin)' : 'Suspendre le compte (Non-respect des règles)'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL : + PUBLIER PROFIL SUR LA PAGE ARTISANS */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-neutral-900">
                    Publier un Profil Artisan
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Visible immédiatement sur la place des artisans
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPublishModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateArtisanProfile} className="p-4 space-y-3 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Nom & Prénom de l'Artisan *
                </label>
                <input
                  type="text"
                  required
                  value={newNom}
                  onChange={(e) => setNewNom(e.target.value)}
                  placeholder="Ex: Amadou Diallo"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Métier *
                  </label>
                  <select
                    value={newMetier}
                    onChange={(e) => setNewMetier(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-neutral-200 text-xs font-medium cursor-pointer"
                  >
                    {METIERS_LIST.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Ville *
                  </label>
                  <input
                    type="text"
                    required
                    value={newVille}
                    onChange={(e) => setNewVille(e.target.value)}
                    placeholder="Ex: Abidjan"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Téléphone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={newTelephone}
                    onChange={(e) => setNewTelephone(e.target.value)}
                    placeholder="+225 07..."
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Tarif départ (FCFA)
                  </label>
                  <input
                    type="number"
                    value={newTarifMin}
                    onChange={(e) => setNewTarifMin(e.target.value)}
                    placeholder="15000"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              {/* BOUTON CAPTURE GPS APRÈS PRIX ET CATÉGORIE / METIER */}
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-[#FF6B00]" />
                    Localisation GPS de l'Atelier
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    disabled={isCapturingGps}
                    className="px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>{isCapturingGps ? 'Capture GPS...' : '📍 Capturer GPS'}</span>
                  </button>
                </div>
                {gpsCoordinates ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span className="truncate">Atelier localisé : {gpsCoordinates.lat.toFixed(4)}, {gpsCoordinates.lng.toFixed(4)} ({gpsCoordinates.label})</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-500">
                    Capturez la position GPS de votre atelier pour permettre aux clients de vous situer et de venir directement sur place.
                  </p>
                )}
                {gpsMessage && !gpsCoordinates && (
                  <p className="text-[11px] text-neutral-600 italic">{gpsMessage}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Adresse complète du magasin / atelier</span>
                </label>
                <input
                  type="text"
                  value={newAdresseMagasin}
                  onChange={(e) => setNewAdresseMagasin(e.target.value)}
                  placeholder="Ex: Rue des Jardins, Immeuble Horizon, Magasin N°4"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Localisation des rues / Repère d'accès</span>
                </label>
                <input
                  type="text"
                  value={newRepereRue}
                  onChange={(e) => setNewRepereRue(e.target.value)}
                  placeholder="Ex: En face de la Pharmacie Centrale, à 50m du grand marché"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Description des prestations
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Décrivez vos compétences, vos garanties et votre expérience..."
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Photo / Portrait de l'Artisan
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center shrink-0">
                    {newPhotoUrl ? (
                      <img src={newPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6 text-neutral-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      ref={photoInputRef}
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="py-1.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{newPhotoUrl ? 'Changer la photo' : 'Importer une photo'}</span>
                    </button>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      Une photo claire donne 3x plus de contacts
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !newNom.trim()}
                  className="w-full py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-[#FF6B00]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Enregistrement en cours...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Publier mon profil artisan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MODIFIER LE PROFIL ARTISAN */}
      {editingArtisan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-neutral-900">
                    Modifier le Profil Artisan
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Mettez à jour vos coordonnées et localisation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingArtisan(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditArtisan} className="p-4 space-y-3 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Nom & Prénom de l'Artisan *
                </label>
                <input
                  type="text"
                  required
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Métier *
                  </label>
                  <select
                    value={editMetier}
                    onChange={(e) => setEditMetier(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-neutral-200 text-xs font-medium cursor-pointer"
                  >
                    {METIERS_LIST.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Ville *
                  </label>
                  <input
                    type="text"
                    required
                    value={editVille}
                    onChange={(e) => setEditVille(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Téléphone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={editTelephone}
                    onChange={(e) => setEditTelephone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Tarif départ (FCFA)
                  </label>
                  <input
                    type="number"
                    value={editTarifMin}
                    onChange={(e) => setEditTarifMin(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              {/* BOUTON CAPTURE GPS EDIT */}
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-[#FF6B00]" />
                    Localisation GPS de l'Atelier
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureEditGps}
                    disabled={isCapturingGps}
                    className="px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>{isCapturingGps ? 'Capture GPS...' : '📍 Capturer GPS'}</span>
                  </button>
                </div>
                {editGpsCoordinates ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span className="truncate">Atelier localisé : {editGpsCoordinates.lat.toFixed(4)}, {editGpsCoordinates.lng.toFixed(4)} ({editGpsCoordinates.label})</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-500">
                    Capturez la position GPS exacte de votre atelier.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Adresse complète du magasin / atelier</span>
                </label>
                <input
                  type="text"
                  value={editAdresseMagasin}
                  onChange={(e) => setEditAdresseMagasin(e.target.value)}
                  placeholder="Ex: Rue des Jardins, Immeuble Horizon"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Localisation des rues / Repère d'accès</span>
                </label>
                <input
                  type="text"
                  value={editRepereRue}
                  onChange={(e) => setEditRepereRue(e.target.value)}
                  placeholder="Ex: En face de la Pharmacie Centrale"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Description des prestations
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Photo / Portrait de l'Artisan
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center shrink-0">
                    {editPhotoUrl ? (
                      <img src={editPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6 text-neutral-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      ref={editPhotoInputRef}
                      accept="image/*"
                      onChange={handleEditPhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => editPhotoInputRef.current?.click()}
                      className="py-1.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{editPhotoUrl ? 'Changer la photo' : 'Importer une photo'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingArtisan(null)}
                  className="py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingArtisan || !editNom.trim()}
                  className="py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-[#FF6B00]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isUpdatingArtisan ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
