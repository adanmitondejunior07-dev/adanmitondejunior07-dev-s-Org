import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  LogOut, 
  Edit3, 
  CheckCircle, 
  MapPin, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Shield, 
  Briefcase, 
  Newspaper, 
  X,
  Camera,
  Upload,
  Plus,
  Image as ImageIcon,
  Crown,
  ChevronRight,
  Heart,
  Users,
  UserCheck,
  UserPlus,
  Check,
  Wallet,
  Navigation,
  WifiOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { Publication, UserWallet, ArtisanVerificationRequest } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { METIERS_LIST, PAYS_AFRIQUE, ADMIN_EMAIL } from '../../lib/supabase';
import { PostText } from '../social/PostText';
import { VerificationModal } from '../verification/VerificationModal';

interface ProfileViewProps {
  onOpenSettings: () => void;
  onOpenSubscriptions?: () => void;
  onOpenAdmin: () => void;
  onOpenWallet?: () => void;
  onOpenServiceRequest?: () => void;
  onOpenVerification?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onOpenSettings,
  onOpenSubscriptions,
  onOpenAdmin,
  onOpenWallet,
  onOpenServiceRequest,
  onOpenVerification
}) => {
  const { profile, user, signOut, updateProfile, isAdmin } = useAuth();
  const isOnline = useOnlineStatus();
  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'about'>('posts');
  const [myPosts, setMyPosts] = useState<Publication[]>([]);
  const [verifRequest, setVerifRequest] = useState<ArtisanVerificationRequest | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Hidden avatar input for device gallery / photo picker
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  // Edit Profile modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState(profile?.full_name || '');
  const [editTelephone, setEditTelephone] = useState(profile?.telephone || '');
  const [editPays, setEditPays] = useState(profile?.pays || 'Côte d\'Ivoire');
  const [editVille, setEditVille] = useState(profile?.ville || 'Abidjan');
  const [editAdresseMagasin, setEditAdresseMagasin] = useState(profile?.adresse_magasin || '');
  const [editRepereRue, setEditRepereRue] = useState(profile?.repere_rue || '');
  const [editMetier, setEditMetier] = useState(profile?.metier || 'Couturier');
  const [editBio, setEditBio] = useState(profile?.bio || '');
  const [editAvatar, setEditAvatar] = useState(profile?.avatar_url || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Followers & Likes state on profile - REAL DATA ONLY (0 by default)
  const [followersCount, setFollowersCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [wallet, setWallet] = useState<UserWallet | null>(null);

  useEffect(() => {
    if (profile) {
      setEditFullName(profile.full_name && profile.full_name !== 'Nouvel Artisan' ? profile.full_name : '');
      setEditTelephone(profile.telephone || '');
      setEditPays(profile.pays && profile.pays !== 'Afrique 🌍' && profile.pays !== 'Afrique' ? profile.pays : 'Côte d\'Ivoire');
      setEditVille(profile.ville && profile.ville !== 'Afrique 🌍' && profile.ville !== 'Afrique' ? profile.ville : 'Abidjan');
      setEditAdresseMagasin(profile.adresse_magasin || '');
      setEditRepereRue(profile.repere_rue || '');
      setEditMetier(profile.metier && profile.metier !== 'Membre' && profile.metier !== 'Nouvel Artisan' ? profile.metier : (profile.role === 'artisan' ? 'Couturier' : 'Membre'));
      setEditBio(profile.bio || '');
      setEditAvatar(profile.avatar_url || '');

      const profId = profile.id || user?.id || 'me';
      setFollowersCount(dataStore.getUserFollowersCount(profId, profile.full_name));
      setIsFollowed(dataStore.isUserFollowed(profId, user?.id));
      setIsLiked(dataStore.isUserLiked(profId, user?.id));

      // Charge le portefeuille
      dataStore.getWallet(profId).then(setWallet);

      // Charge le statut de vérification KYC
      dataStore.getVerificationRequestForUser(profId).then(setVerifRequest);

      // LE COMPTEUR DE LIKES DU PROFIL AFFICHE LES LIKES REÇUS SUR LES PUBLICATIONS
      dataStore.getUserPublicationLikesCount(profId, profile.full_name).then(cnt => {
        setLikesCount(cnt);
      });
    }

    // Load my posts
    dataStore.getPublications().then(all => {
      const mine = all.filter(
        p => (profile?.full_name && p.artisan_name?.toLowerCase().trim() === profile.full_name.toLowerCase().trim()) || 
             (profile?.id && p.user_id === profile.id) ||
             (user?.id && p.user_id === user.id)
      );
      setMyPosts(mine);
      if (mine.length > 0) {
        const totalPubLikes = mine.reduce((sum, p) => sum + (p.likes_count || 0), 0);
        setLikesCount(totalPubLikes);
      }
    });
  }, [profile, user]);

  useEffect(() => {
    const handleFollowersUpdated = () => {
      if (profile) {
        const profId = profile.id || user?.id || 'me';
        setFollowersCount(dataStore.getUserFollowersCount(profId, profile.full_name));
      }
    };
    window.addEventListener('artisanpro_followers_updated', handleFollowersUpdated);
    return () => {
      window.removeEventListener('artisanpro_followers_updated', handleFollowersUpdated);
    };
  }, [profile, user]);

  const handleToggleFollow = () => {
    const profId = profile?.id || user?.id || 'me';
    if (user?.id && (profId === user.id || profile?.id === user.id)) {
      showToast('Vous ne pouvez pas suivre votre propre profil');
      return;
    }
    const res = dataStore.toggleFollowUser(profId, user?.id, profile?.full_name, 'Un visiteur');
    setIsFollowed(res.isFollowed);
    setFollowersCount(res.followersCount);
    showToast(res.isFollowed ? 'Vous suivez désormais cet artisan !' : 'Vous ne suivez plus cet artisan');
  };

  const handleToggleLike = () => {
    const profId = profile?.id || user?.id || 'me';
    const res = dataStore.toggleUserLike(profId, user?.id);
    setIsLiked(res.isLiked);
    setLikesCount(res.likesCount);
    showToast(res.isLiked ? 'Profil ajouté à vos favoris !' : 'J\'aime retiré');
  };

  // Compress image to ensure reliable localStorage storage without quota bugs
  const compressAvatar = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 360;
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Direct Gallery Photo Picker Handler
  const handleDirectAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawDataUrl = event.target?.result as string;
      if (rawDataUrl) {
        const optimized = await compressAvatar(rawDataUrl);
        setEditAvatar(optimized);
        await updateProfile({ avatar_url: optimized });
        showToast('Photo de profil enregistrée avec succès !');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateSuccess(false);

    try {
      const res = await updateProfile({
        full_name: editFullName.trim(),
        telephone: editTelephone.trim(),
        pays: editPays,
        ville: editVille.trim(),
        adresse_magasin: editAdresseMagasin.trim() || undefined,
        repere_rue: editRepereRue.trim() || undefined,
        metier: !isAdmin && profile?.role === 'artisan' ? editMetier : undefined,
        bio: editBio.trim(),
        avatar_url: editAvatar.trim() || undefined
      });

      if (res.success) {
        setUpdateSuccess(true);
        showToast('Profil enregistré avec succès !');
        setTimeout(() => {
          setShowEditModal(false);
          setUpdateSuccess(false);
        }, 800);
      } else if (res.error) {
        showToast(res.error);
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsUpdating(false);
    }
  };

  const isUserAdmin = 
    isAdmin || 
    profile?.role === 'admin' || 
    (profile?.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) ||
    (user?.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim());

  // Quick preset avatars for 1-click selection without needing to copy any URL
  const AVATAR_PRESETS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?auto=format&fit=crop&w=200&q=80'
  ];

  return (
    <div className="pb-24 pt-2">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* Hidden file input for native device gallery / photo picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleDirectAvatarUpload}
        className="hidden"
      />

      <div className="w-[92%] mx-auto space-y-4">
        {/* Profile Header Card */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-start justify-between mb-4">
            {/* Avatar with little + badge -> Opens device gallery directly without copying link */}
            <div className="relative group">
              <img
                src={
                  profile?.avatar_url ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile?.full_name || 'Utilisateur')}&backgroundColor=FF6B00`
                }
                alt={profile?.full_name || 'Profil'}
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-orange-100 shadow-xs cursor-pointer group-hover:opacity-90 transition-opacity"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-[#FF6B00] hover:bg-[#e05e00] text-white flex items-center justify-center shadow-md cursor-pointer border-2 border-white transition-colors"
                title="Ajouter une photo depuis la galerie (+)"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowEditModal(true)}
                className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Modifier</span>
              </button>

              <button
                onClick={onOpenSettings}
                className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center cursor-pointer transition-colors"
                title="Paramètres"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* User Name & Role */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold text-neutral-900 tracking-tight">
                {profile?.full_name || 'Utilisateur ArtisanPro'}
              </h2>
              {profile?.is_verified && (
                <span title="Profil vérifié">
                  <CheckCircle className="w-4 h-4 text-[#FF6B00]" />
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {/* STRICT RULE: ADMIN NEVER SHOWS COMPTE CLIENT NOR ARTISAN */}
              {isUserAdmin ? (
                <span className="px-3 py-1 rounded-full font-extrabold text-xs uppercase tracking-wide bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 shadow-xs">
                  <Shield className="w-3.5 h-3.5 fill-amber-500 text-amber-700" />
                  <span>Super Administrateur & Fondateur</span>
                </span>
              ) : profile?.role === 'artisan' ? (
                <span className="px-2.5 py-0.5 rounded-full font-bold text-xs uppercase tracking-wide bg-orange-50 text-[#FF6B00] border border-orange-200">
                  Artisan • {profile?.metier || 'Professionnel'}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full font-bold text-xs uppercase tracking-wide bg-neutral-100 text-neutral-700">
                  Compte Client
                </span>
              )}

              <span className="text-xs text-neutral-500 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-neutral-400" />
                {profile?.ville || 'Abidjan'}, {profile?.pays || 'Afrique'}
              </span>

              {!isOnline && (
                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <WifiOff className="w-2.5 h-2.5 text-amber-600" />
                  <span>Mode hors-connexion (données locales)</span>
                </span>
              )}
            </div>

            {/* Localisation des rues ou adresse complète du magasin */}
            {(profile?.adresse_magasin || profile?.repere_rue) && (
              <div className="pt-2">
                <div className="p-2.5 rounded-2xl bg-orange-50/80 border border-orange-100 flex items-start gap-2 text-xs">
                  <MapPin className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    {profile.adresse_magasin && (
                      <p className="font-bold text-neutral-900 leading-snug">
                        {profile.adresse_magasin}
                      </p>
                    )}
                    {profile.repere_rue && (
                      <p className="text-[11px] text-neutral-600 mt-0.5">
                        <span className="font-semibold text-neutral-800">Repère / Rue :</span> {profile.repere_rue}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bio */}
            <p className="text-xs text-neutral-600 pt-2 leading-relaxed">
              {profile?.bio || 'Bienvenue sur mon espace ArtisanPro Afrique !'}
            </p>
          </div>

          {/* LIGNE DROITE AU PROFIL : NOMBRE D'ABONNÉS + NOMBRE DE LIKE + BOUTON ABONNÉ */}
          <div className="mt-3.5 py-2.5 px-3.5 bg-neutral-50/90 rounded-2xl border border-neutral-200/70 flex items-center justify-between gap-2 shadow-xs">
            {/* 1. Nombre d'abonnés */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-100/80 text-[#FF6B00] flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <span className="block font-black text-sm text-neutral-900 leading-none">
                  {followersCount}
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
              onClick={handleToggleLike}
              className="flex items-center gap-2 group cursor-pointer hover:opacity-85 transition-opacity"
              title="Aimer ce profil"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                isLiked ? 'bg-red-100 text-red-500' : 'bg-white text-neutral-500 border border-neutral-200 group-hover:text-red-500'
              }`}>
                <Heart className={`w-4 h-4 transition-transform group-active:scale-125 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
              </div>
              <div className="text-left leading-tight">
                <span className="block font-black text-sm text-neutral-900 leading-none">
                  {likesCount}
                </span>
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                  J'aime
                </span>
              </div>
            </button>

            <div className="h-6 w-px bg-neutral-200" />

            {/* 3. Bouton Statut Compte Personnel */}
            <div
              className="py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-neutral-100 text-neutral-700 border border-neutral-200 shrink-0"
              title="Votre profil personnel"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>Mon Compte</span>
            </div>
          </div>

          {/* Contact details mini bar */}
          <div className="mt-3.5 pt-3 border-t border-neutral-100 grid grid-cols-2 gap-2 text-[11px] text-neutral-600">
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="truncate">{profile?.email}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="truncate">{profile?.telephone || 'Non renseigné'}</span>
            </div>
          </div>

          {/* SECRET ADMIN BUTTON - ONLY VISIBLE TO adanmitondejunior07@gmail.com */}
          {isUserAdmin && (
            <div className="mt-4 pt-3 border-t border-amber-200/80">
              <button
                onClick={onOpenAdmin}
                className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Shield className="w-4 h-4 fill-white/20" />
                <span>Accès Dashboard Super-Admin</span>
              </button>
            </div>
          )}
        </div>

        {/* CARTE STATUT DE VÉRIFICATION OFFICIELLE (KYC 4 PIÈCES) */}
        {(() => {
          const currentStatus = isUserAdmin 
            ? 'verified' 
            : (profile?.is_verified ? 'verified' : (verifRequest?.status || profile?.verification_status || 'unverified'));

          return (
            <div className={`p-4 rounded-3xl border shadow-xs transition-all ${
              currentStatus === 'verified'
                ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border-emerald-200'
                : currentStatus === 'in_review'
                ? 'bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-white border-blue-200'
                : currentStatus === 'pending'
                ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-white border-amber-200'
                : currentStatus === 'rejected'
                ? 'bg-gradient-to-br from-red-500/10 via-rose-500/5 to-white border-red-200'
                : 'bg-white border-neutral-200'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                    currentStatus === 'verified'
                      ? 'bg-emerald-500 text-white'
                      : currentStatus === 'in_review'
                      ? 'bg-blue-600 text-white'
                      : currentStatus === 'pending'
                      ? 'bg-amber-500 text-white'
                      : currentStatus === 'rejected'
                      ? 'bg-red-500 text-white'
                      : 'bg-orange-100 text-[#FF6B00]'
                  }`}>
                    {currentStatus === 'verified' && <CheckCircle className="w-5 h-5" />}
                    {currentStatus === 'in_review' && <ShieldCheck className="w-5 h-5 animate-pulse" />}
                    {currentStatus === 'pending' && <Shield className="w-5 h-5" />}
                    {currentStatus === 'rejected' && <Shield className="w-5 h-5" />}
                    {currentStatus === 'unverified' && <ShieldCheck className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-xs text-neutral-900">
                        {currentStatus === 'verified' && 'Profil Certifié & Vérifié ✅'}
                        {currentStatus === 'in_review' && 'Vérification en cours d\'examen 🔍'}
                        {currentStatus === 'pending' && 'Dossier de vérification en attente ⏳'}
                        {currentStatus === 'rejected' && 'Dossier non validé ❌'}
                        {currentStatus === 'unverified' && 'Certification officielle'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        currentStatus === 'verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : currentStatus === 'in_review'
                          ? 'bg-blue-100 text-blue-800'
                          : currentStatus === 'pending'
                          ? 'bg-amber-100 text-amber-900'
                          : currentStatus === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        {currentStatus === 'verified' ? 'Vérifié' : currentStatus === 'in_review' ? 'En examen' : currentStatus === 'pending' ? 'En attente' : currentStatus === 'rejected' ? 'Refusé' : 'Non vérifié'}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-600 mt-1 leading-snug">
                      {currentStatus === 'verified' && 'Votre identité et vos qualifications professionnelles sont confirmées par ArtisanPro Afrique.'}
                      {currentStatus === 'in_review' && 'Un administrateur examine actuellement vos 4 pièces justificatives (CNI, selfie, atelier, diplôme).'}
                      {currentStatus === 'pending' && 'Vos 4 pièces justificatives ont été reçues. L\'administration traite les dossiers dans les meilleurs délais.'}
                      {currentStatus === 'rejected' && (verifRequest?.rejection_reason || 'Votre dossier nécessite des corrections sur les pièces justificatives.')}
                      {currentStatus === 'unverified' && 'Fournissez vos 4 pièces obligatoires (CNI, selfie, atelier, attestation) pour obtenir le badge certifié.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between gap-2">
                <span className="text-[10px] text-neutral-400 font-medium">
                  {currentStatus === 'verified'
                    ? 'Badge bleu actif sur votre profil'
                    : '4 pièces officielles requises'}
                </span>

                <button
                  type="button"
                  onClick={() => setShowVerificationModal(true)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                    currentStatus === 'verified'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      : currentStatus === 'rejected'
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
                      : currentStatus === 'in_review' || currentStatus === 'pending'
                      ? 'bg-neutral-900 hover:bg-black text-white shadow-xs'
                      : 'bg-[#FF6B00] hover:bg-[#e05e00] text-white shadow-xs'
                  }`}
                >
                  <span>
                    {currentStatus === 'verified' && 'Consulter mon dossier'}
                    {currentStatus === 'in_review' && 'Suivre l\'examen'}
                    {currentStatus === 'pending' && 'Suivre mon dossier'}
                    {currentStatus === 'rejected' && 'Corriger mon dossier'}
                    {currentStatus === 'unverified' && 'Faire vérifier mon profil'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* MON PORTEFEUILLE & MISSIONS GPS CARD */}
        <div className="p-4 bg-gradient-to-br from-neutral-900 to-[#1a1a1a] rounded-3xl text-white shadow-lg border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#FF6B00] text-white flex items-center justify-center shadow-xs">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block">
                  Mon Portefeuille
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-white">
                    {(wallet?.balance_fcfa || 0).toLocaleString('fr-FR')}
                  </span>
                  <span className="text-xs font-bold text-[#FF6B00]">FCFA</span>
                </div>
              </div>
            </div>

            {onOpenWallet && (
              <button
                type="button"
                onClick={onOpenWallet}
                className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer border border-white/10 active:scale-95"
              >
                <span>Gérer</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#FF6B00]" />
              </button>
            )}
          </div>

          {/* Quick buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-800 text-xs">
            <button
              type="button"
              onClick={onOpenWallet}
              className="py-2 px-3 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-extrabold text-[11px] flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Recharger / Payer</span>
            </button>

            {onOpenServiceRequest && (
              <button
                type="button"
                onClick={onOpenServiceRequest}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-[11px] flex items-center justify-center gap-1.5 border border-white/10 cursor-pointer transition-all active:scale-95"
              >
                <Navigation className="w-3.5 h-3.5 text-orange-400" />
                <span>Demande GPS</span>
              </button>
            )}
          </div>
        </div>

        {/* Banner Abonnement Pro GeniusPay */}
        <div 
          onClick={onOpenSubscriptions || onOpenSettings}
          className="p-4 bg-gradient-to-r from-orange-500 via-[#FF6600] to-amber-500 rounded-3xl text-white shadow-md shadow-orange-500/20 cursor-pointer flex items-center justify-between group active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs sm:text-sm">
                  {profile?.subscription_plan 
                    ? `Forfait ${profile.subscription_plan.toUpperCase()} Actif`
                    : 'Abonnements Professionnels GeniusPay'}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-white text-[#FF6600] text-[9px] font-black uppercase">
                  Dès 425F
                </span>
              </div>
              <p className="text-[11px] text-white/90">
                Active ton Badge Bleu Pro avec Wave, OM, MTN ou Moov
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform shrink-0" />
        </div>

        {/* Sub Tabs: Mes Publications / À Propos */}
        <div className="bg-white rounded-3xl border border-neutral-200/80 p-1 shadow-xs flex">
          <button
            onClick={() => setActiveSubTab('posts')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubTab === 'posts'
                ? 'bg-[#FF6B00] text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5" />
            <span>Mes publications ({myPosts.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('about')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubTab === 'about'
                ? 'bg-[#FF6B00] text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Coordonnées & Infos</span>
          </button>
        </div>

        {/* Sub tab content */}
        {activeSubTab === 'posts' ? (
          <div className="space-y-3">
            {myPosts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-neutral-200 p-8 text-center">
                <Newspaper className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <h4 className="font-bold text-neutral-800 text-sm mb-1">Aucune publication pour l'instant</h4>
                <p className="text-xs text-neutral-500">
                  Partagez vos réalisations ou posez une question dans l'onglet Social.
                </p>
              </div>
            ) : (
              myPosts.map(p => (
                <div key={p.id} className="bg-white rounded-2xl p-4 border border-neutral-200/80 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                    <span>{new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
                    <span className="font-semibold text-neutral-700">{p.location}</span>
                  </div>
                  <PostText content={p.content} className="mb-2" textClassName="text-xs text-neutral-800" />
                  {p.media_url && (
                    <div className="rounded-xl overflow-hidden max-h-48 bg-neutral-100">
                      <img src={p.media_url} alt="Publication" className="w-full h-48 object-cover" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-neutral-200/80 p-5 space-y-3 text-xs">
            <h4 className="font-bold text-neutral-900 text-sm mb-2">Informations enregistrées</h4>
            <div className="flex justify-between py-1.5 border-b border-neutral-100">
              <span className="text-neutral-500">Rôle sur la plateforme</span>
              <span className="font-extrabold text-amber-900 uppercase">
                {isUserAdmin ? 'SUPER ADMINISTRATEUR & FONDATEUR' : profile?.role === 'artisan' ? 'ARTISAN PROFESSIONNEL' : 'COMPTE CLIENT'}
              </span>
            </div>
            {isUserAdmin ? (
              <div className="flex justify-between py-1.5 border-b border-neutral-100">
                <span className="text-neutral-500">Statut officiel</span>
                <span className="font-bold text-amber-800">Fondateur & Direction Générale</span>
              </div>
            ) : profile?.role === 'artisan' ? (
              <div className="flex justify-between py-1.5 border-b border-neutral-100">
                <span className="text-neutral-500">Métier</span>
                <span className="font-bold text-neutral-800">{profile?.metier}</span>
              </div>
            ) : null}
            <div className="flex justify-between py-1.5 border-b border-neutral-100">
              <span className="text-neutral-500">Pays</span>
              <span className="font-bold text-neutral-800">{profile?.pays}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-100">
              <span className="text-neutral-500">Ville</span>
              <span className="font-bold text-neutral-800">{profile?.ville}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-100">
              <span className="text-neutral-500">Téléphone</span>
              <span className="font-bold text-neutral-800">{profile?.telephone || 'Non renseigné'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-neutral-500">Date d'inscription</span>
              <span className="font-bold text-neutral-800">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR') : 'Récemment'}
              </span>
            </div>
          </div>
        )}

        {/* Logout Button - DIRECT LOGOUT WITHOUT BLOCKING */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full py-3.5 px-4 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            <span>Se déconnecter de mon compte</span>
          </button>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base">Modifier mon profil</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-5 space-y-3.5 overflow-y-auto">
              {updateSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  Profil mis à jour avec succès !
                </div>
              )}

              {/* Photo Picker with Native Gallery Selector (+ button) */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Photo de profil (depuis votre galerie)
                </label>
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="relative">
                    <img
                      src={editAvatar || 'https://api.dicebear.com/7.x/initials/svg?seed=Profil&backgroundColor=FF6B00'}
                      alt="Aperçu"
                      className="w-14 h-14 rounded-2xl object-cover border border-neutral-200 shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => modalFileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FF6B00] text-white flex items-center justify-center shadow-xs"
                    >
                      <Plus className="w-3 h-3 stroke-[3]" />
                    </button>
                  </div>
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string;
                        if (dataUrl) {
                          setEditAvatar(dataUrl);
                          showToast('Photo chargée depuis votre galerie !');
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => modalFileInputRef.current?.click()}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF6B00] border-2 border-dashed border-[#FF6B00]/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>+ Ouvrir ma galerie</span>
                  </button>
                </div>

                {/* Quick avatar selection presets - 1 click without copying URL */}
                <div>
                  <span className="text-[10px] text-neutral-400 font-medium block mb-1">
                    Ou choisissez un avatar rapide en 1 clic :
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditAvatar(preset)}
                        className={`w-9 h-9 rounded-xl overflow-hidden shrink-0 border-2 transition-transform hover:scale-105 cursor-pointer ${
                          editAvatar === preset ? 'border-[#FF6B00] ring-2 ring-[#FF6B00]/30' : 'border-neutral-200'
                        }`}
                      >
                        <img src={preset} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Nom complet affiché *
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Téléphone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={editTelephone}
                  onChange={(e) => setEditTelephone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              {!isUserAdmin && profile?.role === 'artisan' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Métier
                  </label>
                  <select
                    value={editMetier}
                    onChange={(e) => setEditMetier(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00] bg-white cursor-pointer"
                  >
                    {METIERS_LIST.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Pays
                  </label>
                  <select
                    value={editPays}
                    onChange={(e) => setEditPays(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00] bg-white cursor-pointer"
                  >
                    {PAYS_AFRIQUE.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Ville
                  </label>
                  <input
                    type="text"
                    value={editVille}
                    onChange={(e) => setEditVille(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Adresse complète du magasin / atelier</span>
                </label>
                <input
                  type="text"
                  value={editAdresseMagasin}
                  onChange={(e) => setEditAdresseMagasin(e.target.value)}
                  placeholder="Ex: Rue des Jardins, Immeuble Horizon, Magasin N°4"
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Localisation des rues / Repère d'accès</span>
                </label>
                <input
                  type="text"
                  value={editRepereRue}
                  onChange={(e) => setEditRepereRue(e.target.value)}
                  placeholder="Ex: En face de la Pharmacie Centrale, à 50m du grand marché"
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Biographie / Présentation
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00] resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-[#FF6B00]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isUpdating ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE VÉRIFICATION OFFICIELLE DU PROFIL */}
      {showVerificationModal && (
        <VerificationModal
          onClose={() => {
            setShowVerificationModal(false);
            const profId = profile?.id || user?.id || 'me';
            dataStore.getVerificationRequestForUser(profId).then(setVerifRequest);
          }}
          onOpenAdmin={onOpenAdmin}
        />
      )}
    </div>
  );
};
