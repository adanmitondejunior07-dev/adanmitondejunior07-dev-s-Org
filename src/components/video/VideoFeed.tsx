import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Plus, 
  X, 
  MapPin, 
  Sparkles, 
  Wrench, 
  CheckCircle,
  Trash2,
  Pencil,
  UserPlus,
  UserCheck,
  Users
} from 'lucide-react';
import { VideoItem } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { useAuth } from '../../context/AuthContext';
import { supabase, METIERS_LIST, ADMIN_EMAIL } from '../../lib/supabase';
import { uploadPublicationMediaToSupabase } from '../../lib/storageHelper';
import { copyToClipboard } from '../../lib/utils';
import { compressImageFile } from '../../lib/mediaCompressor';

export const VideoFeed: React.FC = () => {
  const { profile, user } = useAuth();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Gallery input refs
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const posterFileInputRef = useRef<HTMLInputElement>(null);

  // Sample African artisan video clips for 1-click selection without copying URLs
  const VIDEO_PRESETS = [
    {
      title: 'Tissage traditionnel et teinture indigo',
      url: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-potter-shaping-a-clay-pot-42861-large.mp4',
      poster: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=800&q=80',
      metier: 'Couturier'
    },
    {
      title: 'Menuiserie d\'art et rabotage d\'Iroko',
      url: 'https://assets.mixkit.co/videos/preview/mixkit-man-working-with-wood-in-a-carpentry-workshop-42998-large.mp4',
      poster: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=800&q=80',
      metier: 'Menuisier'
    },
    {
      title: 'Soudure et ferronnerie d\'art',
      url: 'https://assets.mixkit.co/videos/preview/mixkit-welder-cutting-metal-with-a-torch-41315-large.mp4',
      poster: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
      metier: 'Soudeur'
    }
  ];

  // New video modal state
  const [newTitle, setNewTitle] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [newPosterUrl, setNewPosterUrl] = useState('');
  const [newMetier, setNewMetier] = useState<string>(METIERS_LIST[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit video state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editMetier, setEditMetier] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editSelectedVideoFile, setEditSelectedVideoFile] = useState<File | null>(null);
  const [isUpdatingVideo, setIsUpdatingVideo] = useState(false);
  const editVideoFileInputRef = useRef<HTMLInputElement>(null);

  // Toast
  const [toast, setToast] = useState('');
  const showToast = (txt: string) => {
    setToast(txt);
    setTimeout(() => setToast(''), 2000);
  };

  const [, setFollowTrigger] = useState(0);

  const isVideoAuthorFollowed = (authorName: string) => {
    return dataStore.isUserFollowed(authorName, profile?.id);
  };

  const handleToggleFollowVideo = (authorName: string, authorId?: string) => {
    if (!profile) {
      showToast('Connectez-vous pour suivre cet artisan');
      return;
    }
    if (profile.full_name === authorName || (authorId && profile.id === authorId)) {
      showToast('Vous ne pouvez pas vous suivre vous-même');
      return;
    }
    const targetKey = authorId || authorName;
    const res = dataStore.toggleFollowUser(targetKey, profile.id);
    setFollowTrigger(prev => prev + 1);
    showToast(res.isFollowed ? `Vous suivez désormais ${authorName} !` : `Vous ne suivez plus ${authorName}`);
  };

  const videoRef = useRef<HTMLVideoElement>(null);

  const canManageCurrentVideo = () => {
    if (!currentVideo) return false;
    const isAdmin = profile?.role === 'admin' || profile?.email === ADMIN_EMAIL;
    const isMyVideo = Boolean(
      (profile?.id && (currentVideo.user_id === profile.id || currentVideo.artisan_id === profile.id)) ||
      (profile?.full_name && currentVideo.artisan_name === profile.full_name)
    );
    return isAdmin || isMyVideo;
  };

  const handleOpenEditVideo = () => {
    if (!currentVideo) return;
    setEditTitle(currentVideo.title || '');
    setEditMetier(currentVideo.metier || METIERS_LIST[0]);
    setEditVideoUrl(currentVideo.video_url || '');
    setShowEditModal(true);
  };

  const handleSaveEditVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVideo || !editTitle.trim()) return;
    setIsUpdatingVideo(true);
    try {
      let finalUrl = editVideoUrl.trim() || currentVideo.video_url;
      if (editSelectedVideoFile && (user?.id || profile?.id)) {
        finalUrl = await uploadPublicationMediaToSupabase(editSelectedVideoFile, user?.id || profile?.id || 'artisan', 'video');
      }

      const { error } = await supabase
        .from('publications')
        .update({
          content: editTitle.trim(),
          media_url: finalUrl
        })
        .eq('id', currentVideo.id);

      if (error) {
        throw error;
      }

      await loadVideos();
      showToast('Vidéo modifiée avec succès !');
      setShowEditModal(false);
      setEditSelectedVideoFile(null);
    } catch (err) {
      console.error('Failed to update video:', err);
      showToast('Erreur lors de la modification de la vidéo');
    } finally {
      setIsUpdatingVideo(false);
    }
  };

  const handleEditVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditSelectedVideoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setEditVideoUrl(previewUrl);
    showToast('Nouvelle vidéo prête pour Supabase Storage !');
    e.target.value = '';
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedVideoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setNewVideoUrl(previewUrl);
    showToast('Vidéo prête pour Supabase Storage !');
    e.target.value = '';
  };

  const handlePosterFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const dataUrl = await compressImageFile(file, 800, 0.8);
    if (dataUrl) {
      setNewPosterUrl(dataUrl);
      showToast('Image de couverture prête !');
    }
    e.target.value = '';
  };

  const loadVideos = async () => {
    try {
      // 1. Lire directement depuis Supabase la table 'publications' où media_type = 'video'
      const { data: supaVideos, error: vidErr } = await supabase
        .from('publications')
        .select('*')
        .eq('media_type', 'video')
        .order('created_at', { ascending: false });

      // 2. Lire les mentions j'aime
      const { data: likesData } = await supabase
        .from('likes')
        .select('post_id, user_id');

      const likesCountMap = new Map<string, number>();
      const userLikedSet = new Set<string>();
      const effectiveUserId = user?.id || profile?.id;

      if (likesData) {
        for (const l of likesData) {
          if (l.post_id) {
            likesCountMap.set(l.post_id, (likesCountMap.get(l.post_id) || 0) + 1);
            if (effectiveUserId && l.user_id === effectiveUserId) {
              userLikedSet.add(l.post_id);
            }
          }
        }
      }

      const formatted: VideoItem[] = (supaVideos || []).map((p: any) => ({
        id: p.id,
        title: p.content || 'Réalisation artisanale en vidéo',
        video_url: p.media_url,
        poster_url: undefined,
        artisan_name: p.artisan_name || 'Artisan ArtisanPro',
        artisan_avatar: p.artisan_avatar || undefined,
        metier: 'Artisan',
        ville: p.location || 'Afrique',
        likes_count: likesCountMap.get(p.id) || 0,
        comments_count: 0,
        created_at: p.created_at,
        user_id: p.user_id,
        is_liked: userLikedSet.has(p.id)
      }));

      if (formatted.length === 0) {
        // Presets visuels africains initiaux
        const presets: VideoItem[] = VIDEO_PRESETS.map((vp, idx) => ({
          id: `preset-${idx}`,
          title: vp.title,
          video_url: vp.url,
          poster_url: vp.poster,
          artisan_name: `Artisan ${vp.metier}`,
          metier: vp.metier,
          ville: 'Abidjan',
          likes_count: 0,
          comments_count: 0,
          created_at: new Date().toISOString(),
          is_liked: false
        }));
        setVideos(presets);
      } else {
        setVideos(formatted);
      }
    } catch (e) {
      console.warn('Erreur chargement vidéos Supabase:', e);
    }
  };

  useEffect(() => {
    loadVideos();
  }, [profile?.id, user?.id]);

  useEffect(() => {
    setVideoError(false);
    setIsPlaying(true);
  }, [currentIndex]);

  const currentVideo = videos[currentIndex];

  const togglePlay = () => {
    if (!videoRef.current || videoError) {
      setIsPlaying(!isPlaying);
      return;
    }

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn('Playback error caught safely:', err);
            setIsPlaying(false);
          });
      }
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleLike = async (vidId: string) => {
    const effectiveUserId = profile?.id || user?.id;
    if (!effectiveUserId) {
      showToast('Connectez-vous pour aimer cette vidéo');
      return;
    }

    const currentVid = videos.find(v => v.id === vidId);
    if (!currentVid) return;

    const prevLiked = Boolean(currentVid.is_liked);
    const prevCount = Number(currentVid.likes_count || 0);
    const nextLiked = !prevLiked;
    const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

    // Optimistic UI update
    setVideos(prev =>
      prev.map(v => (v.id === vidId ? { ...v, is_liked: nextLiked, likes_count: nextCount } : v))
    );

    try {
      if (prevLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', vidId)
          .eq('user_id', effectiveUserId);
      } else {
        await supabase
          .from('likes')
          .insert({
            post_id: vidId,
            user_id: effectiveUserId
          });
      }

      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', vidId);

      if (typeof count === 'number') {
        setVideos(prev =>
          prev.map(v => (v.id === vidId ? { ...v, likes_count: count } : v))
        );
      }
    } catch (err) {
      setVideos(prev =>
        prev.map(v => (v.id === vidId ? { ...v, is_liked: prevLiked, likes_count: prevCount } : v))
      );
      showToast('Erreur lors de l\'enregistrement de votre mention J\'aime');
    }
  };

  const handleShare = async () => {
    if (navigator.share && currentVideo) {
      try {
        await navigator.share({
          title: currentVideo.title,
          text: `Découvrez le geste artisanal de ${currentVideo.artisan_name} sur ArtisanPro`,
          url: window.location.href
        });
        return;
      } catch (e) {
        // cancelled or unsupported
      }
    }
    await copyToClipboard(window.location.href);
    showToast('Lien de la vidéo copié !');
  };

  const handleDeleteVideo = async () => {
    if (!currentVideo) return;
    if (!window.confirm(`Voulez-vous vraiment supprimer la vidéo "${currentVideo.title}" ?`)) return;

    const vidId = currentVideo.id;
    try {
      // Vrai delete sur Supabase
      const { error } = await supabase.from('publications').delete().eq('id', vidId);
      if (error) {
        console.warn('Supabase delete error:', error);
      }
      // Rechargement immédiat depuis Supabase
      await loadVideos();
      setCurrentIndex(0);
      showToast('Vidéo supprimée avec succès !');
    } catch (err) {
      console.error('Failed to delete video:', err);
      showToast('Erreur lors de la suppression de la vidéo');
    }
  };

  const handlePublishVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newVideoUrl.trim()) return;

    const effectiveUserId = user?.id || profile?.id;
    if (!effectiveUserId) {
      showToast('Connectez-vous pour publier une vidéo');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalVideoUrl = newVideoUrl.trim();
      if (selectedVideoFile) {
        // Envoi direct dans Supabase Storage
        finalVideoUrl = await uploadPublicationMediaToSupabase(selectedVideoFile, effectiveUserId, 'video');
      }

      // Vrai insert dans Supabase publications avec media_type = 'video'
      const generatedUuid = crypto.randomUUID();
      const { error: insErr } = await supabase
        .from('publications')
        .insert({
          id: generatedUuid,
          user_id: effectiveUserId,
          artisan_name: profile?.full_name || 'Artisan Créateur',
          artisan_avatar: profile?.avatar_url || null,
          location: profile?.ville ? `${profile.ville}, ${profile.pays || 'Afrique'}` : 'Afrique',
          content: newTitle.trim(),
          media_url: finalVideoUrl,
          media_type: 'video',
          created_at: new Date().toISOString()
        });

      if (insErr) {
        throw insErr;
      }

      // Rechargement immédiat depuis Supabase
      await loadVideos();

      setCurrentIndex(0);
      setVideoError(false);
      setIsPlaying(true);
      setShowAddModal(false);
      setNewTitle('');
      setNewVideoUrl('');
      setSelectedVideoFile(null);
      showToast('Vidéo publiée avec succès !');
    } catch (err: any) {
      console.error('Erreur publication vidéo:', err);
      showToast('Erreur lors de la publication de la vidéo sur le serveur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultPoster = 
    currentVideo?.poster_url || 
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="pb-20 pt-1 flex flex-col h-[calc(100vh-120px)] max-w-md mx-auto w-full select-none">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl">
          {toast}
        </div>
      )}

      {/* Permanent Header Bar with + Publier Vidéo */}
      <div className="px-4 py-1.5 flex items-center justify-between text-neutral-900 shrink-0">
        <span className="font-extrabold text-sm text-neutral-900 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#FF6B00]" />
          Vidéos des Artisans
        </span>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#FF6B00] to-[#FF8C38] hover:from-[#e05e00] hover:to-[#e05e00] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-[#FF6B00]/25 cursor-pointer transition-all active:scale-95"
          title="Publier une nouvelle vidéo"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>+ Publier Vidéo</span>
        </button>
      </div>

      {/* Video Container Card */}
      <div className="relative flex-1 bg-black rounded-3xl mx-3 overflow-hidden shadow-xl flex items-center justify-center">
        {currentVideo ? (
          <>
            {!videoError ? (
              <video
                key={currentVideo.id}
                ref={videoRef}
                src={currentVideo.video_url}
                playsInline
                loop
                autoPlay
                muted={isMuted}
                poster={defaultPoster}
                onClick={togglePlay}
                onError={() => {
                  console.warn('Video failed to load source, gracefully displaying animated craft showcase');
                  setVideoError(true);
                }}
                className="w-full h-full object-cover cursor-pointer"
              />
            ) : (
              /* Fallback showcase visual if video source is blocked or unavailable */
              <div 
                onClick={togglePlay}
                className="relative w-full h-full cursor-pointer bg-neutral-900 overflow-hidden"
              >
                <img
                  src={defaultPoster}
                  alt={currentVideo.title}
                  className="w-full h-full object-cover opacity-90 transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10 text-white">
                  <div className="w-14 h-14 rounded-full bg-[#FF6B00]/90 flex items-center justify-center shadow-xl">
                    <Play className="w-7 h-7 ml-0.5 text-white" />
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-black/60 backdrop-blur-xs text-white">
                    Démonstration Atelier Live
                  </span>
                </div>
              </div>
            )}

            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

            {/* Top Bar on Video */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-20">
              <span className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-xs font-bold border border-white/20 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
                Réalisations en direct
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white border border-white/20 hover:bg-black/70 cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#FF6B00] to-[#FF8C38] hover:from-[#e05e00] hover:to-[#e05e00] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-[#FF6B00]/30 border border-white/20 cursor-pointer transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Publier Vidéo</span>
                </button>
              </div>
            </div>

            {/* Play Indicator on pause */}
            {!isPlaying && !videoError && (
              <div
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/30 z-10 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-[#FF6B00]/90 text-white flex items-center justify-center shadow-lg animate-scale-in">
                  <Play className="w-8 h-8 ml-1" />
                </div>
              </div>
            )}

            {/* Right Side Interaction Buttons */}
            <div className="absolute right-3 bottom-16 flex flex-col items-center gap-4 z-20">
              {/* Like */}
              <button
                onClick={() => handleLike(currentVideo.id)}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform group-active:scale-90 ${
                    currentVideo.is_liked
                      ? 'bg-red-500 text-white'
                      : 'bg-black/40 backdrop-blur-md text-white border border-white/20'
                  }`}
                >
                  <Heart
                    className={`w-5 h-5 ${currentVideo.is_liked ? 'fill-white' : ''}`}
                  />
                </div>
                <span className="text-white text-[11px] font-bold mt-1 shadow-xs">
                  {currentVideo.likes_count}
                </span>
              </button>

              {/* Comment */}
              <button
                onClick={() => showToast('Volet commentaires ouvert')}
                className="flex flex-col items-center cursor-pointer"
              >
                <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span className="text-white text-[11px] font-bold mt-1">
                  {currentVideo.comments_count}
                </span>
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex flex-col items-center cursor-pointer"
              >
                <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 flex items-center justify-center">
                  <Share2 className="w-5 h-5" />
                </div>
                <span className="text-white text-[11px] font-bold mt-1">
                  Partager
                </span>
              </button>

              {/* BOUTONS MODIFIER & SUPPRIMER (RÉSERVÉ À L'AUTEUR OU À L'ADMINISTRATEUR) */}
              {canManageCurrentVideo() && (
                <>
                  {/* Bouton Modifier */}
                  <button
                    onClick={handleOpenEditVideo}
                    className="flex flex-col items-center cursor-pointer group"
                    title="Modifier la vidéo"
                  >
                    <div className="w-11 h-11 rounded-full bg-orange-600/70 hover:bg-orange-600 backdrop-blur-md text-white border border-orange-400/50 flex items-center justify-center transition-colors shadow-xs">
                      <Pencil className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white text-[10px] font-bold mt-1">
                      Modifier
                    </span>
                  </button>

                  {/* Bouton 🗑 Supprimer */}
                  <button
                    onClick={handleDeleteVideo}
                    className="flex flex-col items-center cursor-pointer group"
                    title={profile?.role === 'admin' ? "Supprimer la vidéo (Admin)" : "Supprimer ma vidéo"}
                  >
                    <div className="w-11 h-11 rounded-full bg-red-600/60 hover:bg-red-600 backdrop-blur-md text-white border border-red-400/50 flex items-center justify-center transition-colors shadow-xs">
                      <Trash2 className="w-4 h-4 text-red-200 group-hover:text-white" />
                    </div>
                    <span className="text-red-200 text-[10px] font-bold mt-1">
                      Supprimer
                    </span>
                  </button>
                </>
              )}
            </div>

            {/* Bottom Left Author & Description Overlay */}
            <div className="absolute left-4 right-16 bottom-4 z-20 text-white">
              <div className="flex items-center gap-2.5 mb-2">
                <img
                  src={
                    currentVideo.artisan_avatar ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentVideo.artisan_name)}&backgroundColor=FF6B00`
                  }
                  alt={currentVideo.artisan_name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#FF6B00]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h3 className="font-extrabold text-sm text-white truncate">
                      {currentVideo.artisan_name}
                    </h3>
                    <CheckCircle className="w-3.5 h-3.5 text-[#FF6B00] fill-white shrink-0" />

                    {/* Bouton Suivre / Suivi(e) sur la vidéo */}
                    {profile?.full_name !== currentVideo.artisan_name && 
                     (!currentVideo.user_id || profile?.id !== currentVideo.user_id) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFollowVideo(currentVideo.artisan_name, currentVideo.user_id);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-md active:scale-95 ${
                          isVideoAuthorFollowed(currentVideo.artisan_name)
                            ? 'bg-emerald-500/90 hover:bg-emerald-600 text-white shadow-emerald-500/30'
                            : 'bg-[#FF6B00] hover:bg-[#e05e00] text-white shadow-[#FF6B00]/40'
                        }`}
                        title={isVideoAuthorFollowed(currentVideo.artisan_name) ? "Se désabonner" : "Suivre cet artisan"}
                      >
                        {isVideoAuthorFollowed(currentVideo.artisan_name) ? (
                          <>
                            <UserCheck className="w-3 h-3 text-white" />
                            <span>Suivi(e)</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3" />
                            <span>Suivre</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                    <span className="text-[#FF6B00] font-semibold">{currentVideo.metier}</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5 text-neutral-300">
                      <MapPin className="w-3 h-3" />
                      {currentVideo.ville}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-neutral-200 line-clamp-2 leading-relaxed">
                {currentVideo.title}
              </p>
            </div>
          </>
        ) : (
          <div className="text-white text-center p-8 max-w-xs flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8C38] flex items-center justify-center text-white shadow-xl shadow-[#FF6B00]/30 mb-4 animate-bounce">
              <Play className="w-8 h-8 ml-1" />
            </div>
            <h3 className="font-extrabold text-base text-white mb-2">Vidéos des Artisans</h3>
            <p className="text-xs text-neutral-300 mb-6 leading-relaxed">
              Soyez le premier à partager une vidéo de vos créations ou de votre atelier avec la communauté.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="py-3 px-6 rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#FF8C38] hover:from-[#e05e00] hover:to-[#e05e00] text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-[#FF6B00]/40 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Publier la première vidéo</span>
            </button>
          </div>
        )}
      </div>

      {/* Video Pagination dots */}
      {videos.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2">
          {videos.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setCurrentIndex(i);
                setIsPlaying(true);
              }}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                currentIndex === i ? 'w-6 bg-[#FF6B00]' : 'w-2 bg-neutral-300'
              }`}
            />
          ))}
        </div>
      )}

      {/* BOUTON FLOTTANT + POUR PUBLIER VIDÉO (TRÈS VISIBLE ET ACCESSIBLE) */}
      <div className="fixed bottom-20 right-4 z-40">
        <button
          onClick={() => setShowAddModal(true)}
          className="py-2.5 px-4 rounded-full bg-gradient-to-r from-[#FF6B00] to-[#FF8C38] text-white font-extrabold text-xs shadow-xl shadow-[#FF6B00]/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border-2 border-white cursor-pointer group animate-bounce-subtle"
          title="Publier une vidéo"
        >
          <div className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center group-hover:rotate-90 transition-transform">
            <Plus className="w-4 h-4 text-white stroke-[2.5]" />
          </div>
          <span className="tracking-wide uppercase text-[11px] drop-shadow-xs">Publier Vidéo</span>
        </button>
      </div>

      {/* PUBLISH VIDEO MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-[#FF6B00]" />
                Publier une vidéo de chantier / atelier
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePublishVideo} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Titre / Description du geste *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Confection en direct d'un costume 3 pièces wax"
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              {/* Hidden file inputs for device video and poster */}
              <input
                ref={videoFileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoFileChange}
                className="hidden"
              />
              <input
                ref={posterFileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePosterFileChange}
                className="hidden"
              />

              {/* Video Picker from Gallery (+ button) */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Vidéo du geste artisanal (depuis votre galerie) *
                </label>

                <button
                  type="button"
                  onClick={() => videoFileInputRef.current?.click()}
                  className="w-full py-3.5 px-4 rounded-2xl bg-orange-50 hover:bg-orange-100 border-2 border-dashed border-[#FF6B00]/50 text-[#FF6B00] text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Choisir une Vidéo depuis ma galerie</span>
                </button>

                {/* Video Preview if selected */}
                {newVideoUrl ? (
                  <div className="relative rounded-2xl overflow-hidden bg-black mt-2 max-h-40 flex items-center justify-center">
                    <video src={newVideoUrl} controls className="max-h-40 w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setNewVideoUrl('')}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <span className="text-[10px] text-neutral-400 font-medium block mb-1">
                      Ou choisissez une vidéo d'atelier type en 1 clic :
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {VIDEO_PRESETS.map((vp, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setNewVideoUrl(vp.url);
                            setNewPosterUrl(vp.poster);
                            setNewTitle(vp.title);
                            setNewMetier(vp.metier);
                          }}
                          className="p-1.5 rounded-xl border border-neutral-200 hover:border-[#FF6B00] bg-neutral-50 text-left transition-colors cursor-pointer"
                        >
                          <img src={vp.poster} alt={vp.title} className="w-full h-12 rounded-lg object-cover mb-1" />
                          <span className="text-[9px] font-bold text-neutral-800 line-clamp-1 block">{vp.metier}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cover Photo Picker */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Photo de couverture (Optionnelle, depuis votre galerie)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => posterFileInputRef.current?.click()}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Choisir une photo de couverture</span>
                  </button>
                  {newPosterUrl && (
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-neutral-200">
                      <img src={newPosterUrl} alt="Cover" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setNewPosterUrl('')}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Métier représenté *
                </label>
                <select
                  value={newMetier}
                  onChange={(e) => setNewMetier(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00] bg-white cursor-pointer"
                >
                  {METIERS_LIST.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-[#FF6B00]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? 'Mise en ligne...' : 'Publier la vidéo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VIDEO MODAL */}
      {showEditModal && currentVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-neutral-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-neutral-900">Modifier la vidéo</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditVideo} className="space-y-3">
              <input
                type="file"
                ref={editVideoFileInputRef}
                onChange={handleEditVideoFileChange}
                accept="video/*"
                className="hidden"
              />

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Titre de la vidéo :
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Titre ou description du geste artisanal..."
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Métier représenté :
                </label>
                <select
                  value={editMetier}
                  onChange={(e) => setEditMetier(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-hidden focus:border-[#FF6B00] bg-white cursor-pointer"
                >
                  {METIERS_LIST.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-neutral-700">Fichier vidéo :</label>
                  <button
                    type="button"
                    onClick={() => editVideoFileInputRef.current?.click()}
                    className="text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer"
                  >
                    Remplacer la vidéo
                  </button>
                </div>
                {editVideoUrl && (
                  <div className="rounded-xl overflow-hidden bg-black max-h-36 flex items-center justify-center">
                    <video src={editVideoUrl} controls className="max-h-36 w-full object-contain" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingVideo || !editTitle.trim()}
                  className="py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-bold text-xs shadow-md shadow-[#FF6B00]/20 cursor-pointer"
                >
                  {isUpdatingVideo ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
