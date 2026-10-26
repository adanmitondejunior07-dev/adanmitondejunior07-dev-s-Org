import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  CheckCircle, 
  Heart, 
  Users, 
  UserPlus, 
  UserCheck, 
  MessageSquare, 
  Phone, 
  ExternalLink,
  ShieldCheck, 
  Star,
  AlertTriangle
} from 'lucide-react';
import { dataStore } from '../../lib/dataStore';
import { useAuth } from '../../context/AuthContext';

export interface PublicUserTarget {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  role?: string;
  metier?: string;
  ville?: string;
  pays?: string;
  adresse_magasin?: string;
  repere_rue?: string;
  bio?: string;
  is_verified?: boolean;
  telephone?: string;
  whatsapp?: string;
  tarif_min?: number;
}

interface UserProfileModalProps {
  user: PublicUserTarget | null;
  onClose: () => void;
  onOpenChatWith?: (user: PublicUserTarget) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  onClose,
  onOpenChatWith
}) => {
  const { profile: currentProfile, isAdmin } = useAuth();
  const [followersCount, setFollowersCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('Non-respect des règles de la plateforme');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    if (!user) return;
    const targetId = user.id || user.full_name;
    const myId = currentProfile?.id || 'me';

    setFollowersCount(dataStore.getUserFollowersCount(targetId, user.full_name));
    setIsFollowed(dataStore.isUserFollowed(targetId, myId));
    setIsLiked(dataStore.isUserLiked(targetId, myId));
    setIsSuspended(dataStore.isUserSuspended(targetId));

    // Calculate publication likes for user counter
    dataStore.getUserPublicationLikesCount(targetId, user.full_name).then(cnt => {
      setLikesCount(cnt);
    });
  }, [user, currentProfile]);

  useEffect(() => {
    const handleFollowersUpdated = () => {
      if (user) {
        const targetId = user.id || user.full_name;
        setFollowersCount(dataStore.getUserFollowersCount(targetId, user.full_name));
      }
    };
    window.addEventListener('artisanpro_followers_updated', handleFollowersUpdated);
    return () => {
      window.removeEventListener('artisanpro_followers_updated', handleFollowersUpdated);
    };
  }, [user]);

  if (!user) return null;

  const targetId = user.id || user.full_name;
  const myId = currentProfile?.id || 'me';
  const isSelf = Boolean(
    (currentProfile?.id && (currentProfile.id === user.id || currentProfile.id === targetId)) ||
    (currentProfile?.full_name && user.full_name && currentProfile.full_name.trim().toLowerCase() === user.full_name.trim().toLowerCase())
  );

  const handleToggleFollow = () => {
    if (isSelf) {
      showToast('Vous ne pouvez pas vous suivre vous-même');
      return;
    }
    const res = dataStore.toggleFollowUser(targetId, myId, user.full_name, currentProfile?.full_name || 'Un client');
    setIsFollowed(res.isFollowed);
    setFollowersCount(res.followersCount);
    showToast(res.isFollowed ? `Vous suivez désormais ${user.full_name} !` : `Vous ne suivez plus ${user.full_name}`);
  };

  const handleToggleLike = () => {
    const res = dataStore.toggleUserLike(targetId, myId);
    setIsLiked(res.isLiked);
    setLikesCount(res.likesCount);
    showToast(res.isLiked ? 'Profil ajouté à vos favoris !' : 'J\'aime retiré');
  };

  const handleToggleSuspendUser = async () => {
    const res = await dataStore.toggleSuspendUser(targetId, suspendReason);
    setIsSuspended(res);
    setShowSuspendModal(false);
    showToast(res ? 'Compte suspendu pour non-respect des règles !' : 'Compte réactivé avec succès !');
  };

  const avatar = user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.full_name)}&backgroundColor=FF6B00`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-60 bg-neutral-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl">
          {toast}
        </div>
      )}

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150">
        {/* Banner with avatar */}
        <div className="relative h-28 bg-gradient-to-r from-orange-500 to-[#FF6B00] shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar positioned over banner */}
        <div className="px-5 pt-0 pb-2 relative flex items-end justify-between -mt-12">
          <div className="relative">
            <img
              src={avatar}
              alt={user.full_name}
              className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md bg-white"
            />
            {user.is_verified && (
              <span className="absolute -bottom-1 -right-1 bg-[#FF6B00] text-white p-1 rounded-full shadow-xs border-2 border-white" title="Profil Vérifié">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          {user.tarif_min ? (
            <div className="text-right">
              <span className="text-[10px] text-neutral-400 block font-medium">À partir de</span>
              <span className="text-sm font-black text-[#FF6B00]">
                {user.tarif_min.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          ) : null}
        </div>

        {/* Content Body */}
        <div className="p-5 pt-2 overflow-y-auto space-y-4">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xl font-extrabold text-neutral-900 tracking-tight">
                {user.full_name}
              </h2>
              {user.is_verified && (
                <CheckCircle className="w-4 h-4 text-[#FF6B00] shrink-0" />
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
              <span className="px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-orange-50 text-[#FF6B00] border border-orange-200">
                {user.metier || (user.role === 'artisan' ? 'Artisan Pro' : user.role === 'admin' ? 'Administrateur' : 'Membre Client')}
              </span>
              <span className="text-neutral-500 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-neutral-400" />
                {user.ville || 'Abidjan'}, {user.pays || 'Afrique'}
              </span>
            </div>

            {(user.adresse_magasin || user.repere_rue) && (
              <div className="pt-2">
                <div className="p-2.5 rounded-2xl bg-orange-50/80 border border-orange-100 flex items-start gap-2 text-xs">
                  <MapPin className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    {user.adresse_magasin && (
                      <p className="font-bold text-neutral-900 leading-snug">
                        {user.adresse_magasin}
                      </p>
                    )}
                    {user.repere_rue && (
                      <p className="text-[11px] text-neutral-600 mt-0.5">
                        <span className="font-semibold text-neutral-800">Repère / Rue :</span> {user.repere_rue}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Alerte Compte Suspendu */}
            {isSuspended && (
              <div className="mt-2.5 p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2 shadow-xs">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Compte actuellement suspendu</strong>
                  <span className="text-[11px] text-red-700">Ce compte a été suspendu pour non-respect des règles de la plateforme.</span>
                </div>
              </div>
            )}

            <p className="text-xs text-neutral-600 pt-2.5 leading-relaxed">
              {user.bio || 'Professionnel indépendant inscrit sur le réseau ArtisanPro Afrique.'}
            </p>
          </div>

          {/* LIGNE DROITE AU PROFIL : NOMBRE D'ABONNÉS + NOMBRE DE LIKE + BOUTON ABONNÉ */}
          <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/70 flex items-center justify-between gap-2 shadow-xs">
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

            {/* 3. Bouton Abonné */}
            {isSelf ? (
              <div
                className="py-2 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-neutral-100 text-neutral-600 border border-neutral-200 shrink-0"
                title="Votre propre profil"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Mon Profil</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleToggleFollow}
                className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 ${
                  isFollowed
                    ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 shadow-xs'
                    : 'bg-[#FF6B00] hover:bg-[#e05e00] text-white shadow-md shadow-[#FF6B00]/25'
                }`}
                title={isFollowed ? 'Suivi(e) (cliquer pour ne plus suivre)' : 'Suivre cet artisan'}
              >
                {isFollowed ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Suivi(e)</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Suivre</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            {onOpenChatWith && (
              <button
                onClick={() => {
                  onClose();
                  onOpenChatWith(user);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-bold text-xs shadow-md shadow-[#FF6B00]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Envoyer un message en privé</span>
              </button>
            )}

            {user.whatsapp && (
              <a
                href={`https://wa.me/${user.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Contacter sur WhatsApp ({user.whatsapp})</span>
              </a>
            )}

            {/* RÉSERVÉ STRICTEMENT AU SUPER ADMIN : SUSPENDRE OU RÉACTIVER */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowSuspendModal(true)}
                className={`w-full py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isSuspended
                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isSuspended ? 'Réactiver ce compte (Admin)' : 'Suspendre le compte (Non-respect des règles)'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MODAL SUSPENSION DE COMPTE (ADMIN UNIQUEMENT) */}
      {isAdmin && showSuspendModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-neutral-100 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-neutral-900 text-center mb-1">
              {isSuspended ? 'Réactiver le compte ?' : 'Suspendre ce compte ?'}
            </h3>
            <p className="text-xs text-neutral-600 text-center mb-4 leading-relaxed">
              {isSuspended
                ? `Voulez-vous réactiver le compte de ${user.full_name} ? Il pourra de nouveau publier et échanger.`
                : `Suspendre le compte de ${user.full_name} s'il ne respecte pas les règles (fraude, harcèlement, faux profil, non-respect des engagements).`}
            </p>

            {!isSuspended && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  Motif de la suspension :
                </label>
                <select
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-red-500"
                >
                  <option value="Non-respect des règles de la plateforme">Non-respect des règles de la plateforme</option>
                  <option value="Comportement inapproprié ou propos abusifs">Comportement inapproprié ou propos abusifs</option>
                  <option value="Suspicion d'arnaque ou devis frauduleux">Suspicion d'arnaque ou devis frauduleux</option>
                  <option value="Prestations non conformes répétées">Prestations non conformes répétées</option>
                  <option value="Spam ou usurpation d'identité">Spam ou usurpation d'identité</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowSuspendModal(false)}
                className="py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleToggleSuspendUser}
                className={`py-2.5 px-4 rounded-xl text-white font-bold text-xs cursor-pointer shadow-xs ${
                  isSuspended ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isSuspended ? 'Confirmer réactivation' : 'Confirmer suspension'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
