import { supabase, ADMIN_EMAIL } from './supabase';
import { idbStorage } from './idbStorage';
import { 
  Publication, 
  Artisan, 
  MarketplaceItem, 
  VideoItem, 
  ChatMessage, 
  Conversation, 
  AppNotification, 
  ProblemReport, 
  CommentItem,
  UserProfile,
  ArtisanVerificationRequest,
  SubscriptionPaymentProof
} from '../types';

// ZERO DEMO DATA - ONLY REAL DATA FROM DATABASE AND REGISTERED USERS
const INITIAL_ARTISANS: Artisan[] = [];
const INITIAL_PUBLICATIONS: Publication[] = [];
const INITIAL_MARKETPLACE: MarketplaceItem[] = [];
const INITIAL_VIDEOS: VideoItem[] = [];

class DataStoreService {
  private memoryCache: Record<string, any> = {};
  private hydrationPromise: Promise<void> | null = null;

  constructor() {
    this.cleanUpKonanTest();
    this.purgeDemoFollowersAndLikes();
    this.hydrationPromise = this.hydrateFromIndexedDB();
  }

  async ensureHydrated(): Promise<void> {
    if (!this.hydrationPromise) {
      this.hydrationPromise = this.hydrateFromIndexedDB();
    }
    return this.hydrationPromise;
  }

  private async hydrateFromIndexedDB() {
    const keys = [
      'custom_publications', 
      'custom_videos', 
      'custom_marketplace', 
      'custom_artisans', 
      'my_likes',
      'deleted_publications_ids',
      'deleted_videos_ids',
      'deleted_marketplace_ids',
      'deleted_artisans_ids'
    ];
    for (const k of keys) {
      try {
        const val = await idbStorage.getItem(this.localKey(k));
        if (val !== null && val !== undefined) {
          this.memoryCache[this.localKey(k)] = val;
        }
      } catch {}
    }
  }

  private purgeDemoFollowersAndLikes() {
    try {
      const keysToClean: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('followers_count_') || key.includes('likes_count_'))) {
          keysToClean.push(key);
        }
      }
      for (const k of keysToClean) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const num = Number(JSON.parse(raw));
            if (num === 42 || num === 98 || (num >= 24 && num <= 230)) {
              localStorage.setItem(k, JSON.stringify(0));
            }
          } catch {}
        }
      }
    } catch {}
  }

  private cleanUpKonanTest() {
    try {
      const reg = this.getStored<UserProfile[]>('registered_users', []);
      const filtered = reg.filter(u => {
        const name = `${u.full_name || ''} ${u.nom || ''}`.toLowerCase();
        return !name.includes('konan') && !u.email.toLowerCase().includes('konan');
      });
      if (filtered.length !== reg.length) {
        this.setStored('registered_users', filtered);
      }

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.toLowerCase().includes('konan') || key.startsWith('artisanpro_profile_'))) {
          const val = localStorage.getItem(key);
          if (val && val.toLowerCase().includes('konan')) {
            localStorage.removeItem(key);
          }
        }
      }

      // Silent Supabase cleanup
      Promise.resolve(supabase.from('profiles').delete().ilike('full_name', '%konan%')).catch(() => {});
      Promise.resolve(supabase.from('artisans').delete().ilike('nom', '%konan%')).catch(() => {});
    } catch {}
  }

  private localKey(key: string) {
    return `artisanpro_${key}`;
  }

  getStored<T>(key: string, defaultVal: T): T {
    const fullKey = this.localKey(key);
    if (this.memoryCache[fullKey] !== undefined) {
      return this.memoryCache[fullKey];
    }
    try {
      const item = localStorage.getItem(fullKey);
      if (item) {
        const parsed = JSON.parse(item);
        this.memoryCache[fullKey] = parsed;
        return parsed;
      }
    } catch {}
    return defaultVal;
  }

  setStored<T>(key: string, value: T): void {
    const fullKey = this.localKey(key);
    this.memoryCache[fullKey] = value;
    // Always persist to IndexedDB asynchronously (handles large video data URLs without 5MB quota errors)
    idbStorage.setItem(fullKey, value).catch(() => {});
    try {
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage quota reached (safely stored in IndexedDB):', e);
    }
  }

  // PUBLICATIONS (POSTS)
  async getPublications(): Promise<Publication[]> {
    await this.ensureHydrated();
    try {
      // 1. Fetch from Supabase publications table
      const { data, error } = await supabase
        .from('publications')
        .select('*')
        .order('created_at', { ascending: false });

      const localCached = this.getStored<Publication[]>('custom_publications', []);
      const localLikes = this.getStored<string[]>('my_likes', []);
      const deletedIds = this.getStored<string[]>('deleted_publications_ids', []);

      let allPubs: Publication[] = [];

      if (!error && data && data.length > 0) {
        // Map Supabase rows to Publication
        const supaPubs: Publication[] = data.map(row => ({
          id: row.id,
          artisan_name: row.artisan_name || 'Artisan Anonyme',
          artisan_avatar: row.artisan_avatar || null,
          location: row.location || 'Afrique',
          content: row.content || '',
          media_url: row.media_url || null,
          media_type: row.media_type || 'image',
          created_at: row.created_at,
          likes_count: 1,
          comments_count: 0,
          is_liked_by_me: localLikes.includes(row.id)
        }));
        allPubs = [...localCached, ...supaPubs, ...INITIAL_PUBLICATIONS];
      } else {
        allPubs = [...localCached, ...INITIAL_PUBLICATIONS];
      }

      // De-duplicate by ID and filter out deleted posts
      const seen = new Set<string>();
      const deduped: Publication[] = [];
      for (const p of allPubs) {
        if (!seen.has(p.id) && !deletedIds.includes(p.id)) {
          seen.add(p.id);
          const postLikeCount = this.getStored<number>(`post_likes_${p.id}`, p.likes_count ?? 1);
          deduped.push({
            ...p,
            likes_count: postLikeCount,
            is_liked_by_me: localLikes.includes(p.id)
          });
        }
      }
      return deduped;
    } catch (err) {
      console.error('getPublications error:', err);
      return INITIAL_PUBLICATIONS;
    }
  }

  async createPublication(pub: Omit<Publication, 'id' | 'created_at'>): Promise<Publication> {
    const newPub: Publication = {
      ...pub,
      id: 'pub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      created_at: new Date().toISOString(),
      likes_count: 0,
      comments_count: 0,
      is_liked_by_me: false
    };

    // Try inserting into Supabase publications table (if not a huge base64 payload)
    if (!pub.media_url || !pub.media_url.startsWith('data:')) {
      try {
        const { data, error } = await supabase.from('publications').insert({
          artisan_name: pub.artisan_name,
          artisan_avatar: pub.artisan_avatar || null,
          location: pub.location || null,
          content: pub.content,
          media_url: pub.media_url || null,
          media_type: pub.media_type || 'image'
        }).select().single();

        if (!error && data) {
          newPub.id = data.id;
          newPub.created_at = data.created_at;
        }
      } catch (e) {
        console.warn('Supabase publication insert error, fallback local:', e);
      }
    }

    const current = this.getStored<Publication[]>('custom_publications', []);
    this.setStored('custom_publications', [newPub, ...current]);

    // Mirror video publications into custom_videos so they appear in Video Reels as well
    if (pub.media_type === 'video' && pub.media_url) {
      const curVids = this.getStored<VideoItem[]>('custom_videos', []);
      const newVid: VideoItem = {
        id: newPub.id,
        title: pub.content ? pub.content.slice(0, 80) : 'Vidéo de réalisation artisanale',
        video_url: pub.media_url,
        artisan_name: pub.artisan_name,
        artisan_avatar: pub.artisan_avatar || undefined,
        metier: 'Artisan',
        ville: pub.location || 'Afrique',
        likes_count: 0,
        comments_count: 0,
        created_at: newPub.created_at,
        user_id: pub.user_id
      };
      this.setStored('custom_videos', [newVid, ...curVids]);
    }

    return newPub;
  }

  async updatePublication(postId: string, updates: Partial<Publication>): Promise<Publication | null> {
    const current = this.getStored<Publication[]>('custom_publications', []);
    const idx = current.findIndex(p => p.id === postId);
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...updates };
      this.setStored('custom_publications', current);

      // Also update in custom_videos if mirrored
      const vids = this.getStored<VideoItem[]>('custom_videos', []);
      const vIdx = vids.findIndex(v => v.id === postId);
      if (vIdx >= 0) {
        if (updates.content) vids[vIdx].title = updates.content.slice(0, 80);
        if (updates.media_url) vids[vIdx].video_url = updates.media_url;
        this.setStored('custom_videos', vids);
      }
      return current[idx];
    }
    return null;
  }

  async deletePublication(postId: string): Promise<boolean> {
    try {
      const current = this.getStored<Publication[]>('custom_publications', []);
      this.setStored('custom_publications', current.filter(p => p.id !== postId));

      const vids = this.getStored<VideoItem[]>('custom_videos', []);
      this.setStored('custom_videos', vids.filter(v => v.id !== postId));

      const deletedIds = this.getStored<string[]>('deleted_publications_ids', []);
      if (!deletedIds.includes(postId)) {
        this.setStored('deleted_publications_ids', [...deletedIds, postId]);
      }

      // Try Supabase delete
      try {
        await supabase.from('publications').delete().eq('id', postId);
      } catch (err) {
        // silent
      }

      return true;
    } catch (e) {
      console.warn('deletePublication error:', e);
      return false;
    }
  }

  async toggleLike(postId: string, userId?: string): Promise<boolean> {
    const userLikesKey = userId ? `my_likes_${userId}` : 'my_likes';
    const likes = this.getStored<string[]>(userLikesKey, this.getStored<string[]>('my_likes', []));
    const isLiked = likes.includes(postId);
    const updated = isLiked ? likes.filter(id => id !== postId) : [...likes, postId];
    this.setStored(userLikesKey, updated);
    this.setStored('my_likes', updated);

    // Update post likes count in storage
    const currentPostLikes = this.getStored<number>(`post_likes_${postId}`, 0);
    const updatedCount = isLiked ? Math.max(0, currentPostLikes - 1) : currentPostLikes + 1;
    this.setStored(`post_likes_${postId}`, updatedCount);

    // Also update custom_publications directly so publication likes NEVER disappear
    const customPubs = this.getStored<Publication[]>('custom_publications', []);
    const updatedCustomPubs = customPubs.map(p => p.id === postId ? { ...p, likes_count: updatedCount, is_liked_by_me: !isLiked } : p);
    this.setStored('custom_publications', updatedCustomPubs);

    // Sync to Supabase likes table if user is authenticated
    if (userId) {
      try {
        if (isLiked) {
          await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
        } else {
          await supabase.from('likes').insert({ post_id: postId, user_id: userId });
        }
      } catch (e) {
        console.warn('Supabase like error:', e);
      }
    }
    return !isLiked;
  }

  // TOTAL PUBLICATION LIKES FOR USER PROFILE COUNTER TABLE
  async getUserPublicationLikesCount(userId: string, authorName?: string): Promise<number> {
    try {
      const pubs = await this.getPublications();
      const myPubs = pubs.filter(p => {
        const matchId = userId && p.user_id && p.user_id === userId;
        const matchName = authorName && p.artisan_name && p.artisan_name.toLowerCase().trim() === authorName.toLowerCase().trim();
        return matchId || matchName;
      });

      if (myPubs.length > 0) {
        return myPubs.reduce((sum, p) => sum + (p.likes_count || 0), 0);
      }
      return this.getUserLikesCount(userId);
    } catch {
      return this.getUserLikesCount(userId);
    }
  }

  // ZERO DEMO BASELINE - REAL COUNTS ONLY (0 BY DEFAULT)
  getUserFollowersCount(userId: string): number {
    return this.getStored<number>(`followers_count_${userId}`, 0);
  }

  getUserLikesCount(userId: string): number {
    return this.getStored<number>(`likes_count_${userId}`, 0);
  }

  isUserFollowed(targetUserId: string, currentUserId?: string): boolean {
    const myId = currentUserId || 'me';
    const myFollows = this.getStored<string[]>(`following_${myId}`, []);
    return myFollows.includes(targetUserId);
  }

  toggleFollowUser(targetUserId: string, currentUserId?: string): { isFollowed: boolean; followersCount: number } {
    const myId = currentUserId || 'me';
    const myFollows = this.getStored<string[]>(`following_${myId}`, []);
    const isFollowed = myFollows.includes(targetUserId);
    
    let followers = this.getUserFollowersCount(targetUserId);

    if (isFollowed) {
      this.setStored(`following_${myId}`, myFollows.filter(id => id !== targetUserId));
      followers = Math.max(0, followers - 1);
    } else {
      this.setStored(`following_${myId}`, [...myFollows, targetUserId]);
      followers = followers + 1;
    }

    this.setStored(`followers_count_${targetUserId}`, followers);
    return { isFollowed: !isFollowed, followersCount: followers };
  }

  isUserLiked(targetUserId: string, currentUserId?: string): boolean {
    const myId = currentUserId || 'me';
    const myUserLikes = this.getStored<string[]>(`user_likes_${myId}`, []);
    return myUserLikes.includes(targetUserId);
  }

  toggleUserLike(targetUserId: string, currentUserId?: string): { isLiked: boolean; likesCount: number } {
    const myId = currentUserId || 'me';
    const myUserLikes = this.getStored<string[]>(`user_likes_${myId}`, []);
    const isLiked = myUserLikes.includes(targetUserId);

    let likes = this.getUserLikesCount(targetUserId);

    if (isLiked) {
      this.setStored(`user_likes_${myId}`, myUserLikes.filter(id => id !== targetUserId));
      likes = Math.max(0, likes - 1);
    } else {
      this.setStored(`user_likes_${myId}`, [...myUserLikes, targetUserId]);
      likes = likes + 1;
    }

    this.setStored(`likes_count_${targetUserId}`, likes);
    return { isLiked: !isLiked, likesCount: likes };
  }

  // COMMENTS
  async getComments(postId: string): Promise<CommentItem[]> {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      const localKey = `comments_${postId}`;
      const localComments = this.getStored<CommentItem[]>(localKey, []);

      if (!error && data && data.length > 0) {
        const merged = [...data, ...localComments];
        const seen = new Set<string>();
        return merged.filter(c => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });
      }
      return localComments;
    } catch {
      return this.getStored<CommentItem[]>(`comments_${postId}`, []);
    }
  }

  async addComment(postId: string, userId: string, userName: string, text: string): Promise<CommentItem> {
    const newComment: CommentItem = {
      id: 'cmt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      post_id: postId,
      user_id: userId,
      user_name: userName,
      comment_text: text,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase.from('comments').insert({
        post_id: postId,
        user_id: userId,
        user_name: userName,
        comment_text: text
      }).select().single();

      if (!error && data) {
        newComment.id = data.id;
        newComment.created_at = data.created_at;
      }
    } catch (e) {
      console.warn('Supabase comment insert failed, local fallback:', e);
    }

    const localKey = `comments_${postId}`;
    const cur = this.getStored<CommentItem[]>(localKey, []);
    this.setStored(localKey, [...cur, newComment]);
    return newComment;
  }

  // REGISTERED USERS MANAGEMENT
  getRegisteredUsers(): UserProfile[] {
    const raw = this.getStored<UserProfile[]>('registered_users', []);
    // Permanently filter out "Konan" / "Konan Test"
    const cleaned = raw.filter(u => {
      const name = `${u.full_name || ''} ${u.nom || ''} ${u.prenom || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      return !name.includes('konan') && !email.includes('konan');
    });
    if (cleaned.length !== raw.length) {
      this.setStored('registered_users', cleaned);
    }
    return cleaned;
  }

  saveRegisteredUser(user: UserProfile): void {
    const name = `${user.full_name || ''} ${user.nom || ''} ${user.prenom || ''}`.toLowerCase();
    const email = (user.email || '').toLowerCase();
    if (name.includes('konan') || email.includes('konan')) {
      return; // Do not save test user Konan
    }

    const list = this.getRegisteredUsers();
    const idx = list.findIndex(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...user };
    } else {
      list.push(user);
    }
    this.setStored('registered_users', list);
  }

  async deleteUser(userId: string): Promise<boolean> {
    const raw = this.getStored<UserProfile[]>('registered_users', []);
    const updated = raw.filter(u => u.id !== userId);
    this.setStored('registered_users', updated);

    try {
      localStorage.removeItem(`artisanpro_profile_${userId}`);
    } catch {}

    try {
      await supabase.from('profiles').delete().eq('id', userId);
    } catch {}

    try {
      const verifs = await this.getVerificationRequests();
      this.setStored('verification_requests', verifs.filter(v => v.artisan_id !== userId));
      const subs = await this.getSubscriptionProofs();
      this.setStored('subscription_proofs', subs.filter(s => s.artisan_id !== userId));
    } catch {}

    return true;
  }

  // ARTISANS - ONLY REAL REGISTERED ARTISANS
  async getArtisans(): Promise<Artisan[]> {
    await this.ensureHydrated();
    try {
      const deletedIds = this.getStored<string[]>('deleted_artisans_ids', []);
      const { data, error } = await supabase.from('artisans').select('*');
      let merged: Artisan[] = [];

      if (!error && data && data.length > 0) {
        const formatted: Artisan[] = data.map(a => ({
          id: a.id,
          nom: a.nom || 'Artisan Partenaire',
          telephone: a.telephone || a.whatsapp || '',
          whatsapp: a.whatsapp || a.telephone || '',
          metier: a.metier || 'Artisan',
          ville: a.ville || 'Abidjan',
          commune: a.commune || '',
          description: a.description || 'Artisan qualifié inscrit sur la plateforme ArtisanPro.',
          services: a.services || 'Prestations sur mesure',
          tarif_min: a.tarif_min || 15000,
          verifie: a.verifie ?? a.is_verified ?? false,
          badge_vert: a.badge_vert ?? true,
          badge_bleu: a.badge_bleu ?? false,
          is_verified: a.is_verified ?? false,
          is_fondateur: a.is_fondateur ?? false,
          note_moyenne: a.note_moyenne || 5.0,
          nombre_avis: a.nombre_avis || 0,
          disponible: a.disponible ?? true,
          photos: a.photos || [],
          created_at: a.created_at || new Date().toISOString()
        }));
        merged = [...formatted];
      }

      // Include newly registered artisans from profiles table
      try {
        const { data: profs } = await supabase.from('profiles').select('*').eq('role', 'artisan');
        if (profs && profs.length > 0) {
          for (const p of profs) {
            if (!merged.some(m => m.id === p.id)) {
              merged.push({
                id: p.id,
                nom: p.full_name || p.email.split('@')[0],
                telephone: p.telephone || '+225 00000000',
                whatsapp: p.telephone || '+225 00000000',
                metier: p.metier || 'Artisan',
                ville: p.ville || 'Abidjan',
                description: p.bio || 'Professionnel inscrit sur ArtisanPro Afrique.',
                services: 'Prestations artisanales',
                tarif_min: 10000,
                verifie: p.is_verified || false,
                badge_bleu: p.badge_bleu || false,
                note_moyenne: 5.0,
                nombre_avis: 0,
                disponible: true,
                photos: p.avatar_url ? [p.avatar_url] : [],
                created_at: p.created_at
              });
            }
          }
        }
      } catch (e) {
        // silent
      }

      // Include custom artisans added via UI
      const customArtisans = this.getStored<Artisan[]>('custom_artisans', []);
      for (const ca of customArtisans) {
        if (!merged.some(m => m.id === ca.id)) {
          merged.push(ca);
        }
      }

      // Include locally registered artisans
      const localUsers = this.getRegisteredUsers();
      for (const u of localUsers) {
        if (u.role === 'artisan' && !merged.some(m => m.id === u.id)) {
          merged.push({
            id: u.id,
            nom: u.full_name || u.email.split('@')[0],
            telephone: u.telephone || '',
            whatsapp: u.telephone || '',
            metier: u.metier || 'Artisan',
            ville: u.ville || 'Abidjan',
            description: u.bio || 'Professionnel inscrit sur ArtisanPro Afrique.',
            services: 'Prestations sur mesure',
            tarif_min: 15000,
            verifie: u.is_verified || false,
            badge_bleu: u.badge_bleu || false,
            badge_vert: true,
            is_verified: u.is_verified || false,
            note_moyenne: 5.0,
            nombre_avis: 0,
            disponible: true,
            photos: u.avatar_url ? [u.avatar_url] : [],
            created_at: u.created_at || new Date().toISOString()
          });
        }
      }

      const seen = new Set<string>();
      return merged.filter(a => {
        if (deletedIds.includes(a.id)) return false;
        const nom = (a.nom || '').toLowerCase();
        if (nom.includes('konan')) return false;
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
    } catch {
      return [];
    }
  }

  async addCustomArtisan(artisan: Omit<Artisan, 'id' | 'created_at'>): Promise<Artisan> {
    const newArtisan: Artisan = {
      ...artisan,
      id: 'art-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      created_at: new Date().toISOString(),
      verifie: true,
      badge_vert: true,
      badge_bleu: true,
      note_moyenne: 5.0,
      nombre_avis: 1,
      disponible: true
    };
    const current = this.getStored<Artisan[]>('custom_artisans', []);
    this.setStored('custom_artisans', [newArtisan, ...current]);
    return newArtisan;
  }

  // MARKETPLACE
  async getMarketplaceItems(): Promise<MarketplaceItem[]> {
    await this.ensureHydrated();
    const deletedIds = this.getStored<string[]>('deleted_marketplace_ids', []);
    const custom = this.getStored<MarketplaceItem[]>('custom_marketplace', []);
    return [...custom.filter(it => !deletedIds.includes(it.id)), ...INITIAL_MARKETPLACE.filter(it => !deletedIds.includes(it.id))];
  }

  async createMarketplaceItem(item: Omit<MarketplaceItem, 'id' | 'created_at'>): Promise<MarketplaceItem> {
    await this.ensureHydrated();
    const newItem: MarketplaceItem = {
      ...item,
      id: 'mkt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      created_at: new Date().toISOString()
    };
    const current = this.getStored<MarketplaceItem[]>('custom_marketplace', []);
    this.setStored('custom_marketplace', [newItem, ...current]);
    return newItem;
  }

  async updateMarketplaceItem(itemId: string, updates: Partial<MarketplaceItem>): Promise<MarketplaceItem | null> {
    await this.ensureHydrated();
    const current = this.getStored<MarketplaceItem[]>('custom_marketplace', []);
    const idx = current.findIndex(it => it.id === itemId);
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...updates };
      this.setStored('custom_marketplace', current);
      return current[idx];
    }
    return null;
  }

  async deleteMarketplaceItem(itemId: string): Promise<boolean> {
    await this.ensureHydrated();
    const current = this.getStored<MarketplaceItem[]>('custom_marketplace', []);
    this.setStored('custom_marketplace', current.filter(it => it.id !== itemId));
    const deletedIds = this.getStored<string[]>('deleted_marketplace_ids', []);
    if (!deletedIds.includes(itemId)) {
      this.setStored('deleted_marketplace_ids', [...deletedIds, itemId]);
    }
    return true;
  }

  // VIDEOS
  async getVideos(): Promise<VideoItem[]> {
    await this.ensureHydrated();
    const deletedIds = this.getStored<string[]>('deleted_videos_ids', []);
    const custom = this.getStored<VideoItem[]>('custom_videos', [])
      .filter(v => v.video_url && !deletedIds.includes(v.id));

    // Also pull in any publication created with media_type === 'video'
    const pubs = this.getStored<Publication[]>('custom_publications', []);
    const pubVideos: VideoItem[] = pubs
      .filter(p => p.media_type === 'video' && p.media_url && !deletedIds.includes(p.id))
      .map(p => ({
        id: p.id,
        title: p.content ? (p.content.slice(0, 60)) : 'Réalisation artisanale en vidéo',
        video_url: p.media_url!,
        poster_url: undefined,
        artisan_name: p.artisan_name,
        artisan_avatar: p.artisan_avatar || undefined,
        metier: 'Artisan',
        ville: p.location || 'Afrique',
        likes_count: p.likes_count || 0,
        comments_count: p.comments_count || 0,
        created_at: p.created_at,
        user_id: p.user_id
      }));

    const all = [...custom, ...pubVideos, ...INITIAL_VIDEOS.filter(v => !deletedIds.includes(v.id))];
    const seen = new Set<string>();
    return all.filter(v => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }

  async addVideo(video: Omit<VideoItem, 'id' | 'created_at' | 'likes_count' | 'comments_count'>): Promise<VideoItem> {
    await this.ensureHydrated();
    const newVid: VideoItem = {
      ...video,
      id: 'vid-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      likes_count: 0,
      comments_count: 0,
      created_at: new Date().toISOString()
    };
    const current = this.getStored<VideoItem[]>('custom_videos', []);
    this.setStored('custom_videos', [newVid, ...current]);

    // Also mirror to custom_publications so it appears in the Social Feed
    const pubs = this.getStored<Publication[]>('custom_publications', []);
    const mirroredPub: Publication = {
      id: newVid.id,
      artisan_name: newVid.artisan_name,
      artisan_avatar: newVid.artisan_avatar || null,
      location: newVid.ville || 'Afrique',
      content: newVid.title,
      media_url: newVid.video_url,
      media_type: 'video',
      created_at: newVid.created_at,
      user_id: newVid.user_id,
      likes_count: 0,
      comments_count: 0
    };
    this.setStored('custom_publications', [mirroredPub, ...pubs]);

    return newVid;
  }

  async updateVideo(videoId: string, updates: Partial<VideoItem>): Promise<VideoItem | null> {
    const current = this.getStored<VideoItem[]>('custom_videos', []);
    const idx = current.findIndex(v => v.id === videoId);
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...updates };
      this.setStored('custom_videos', current);

      // Also update publication if mirrored
      const pubs = this.getStored<Publication[]>('custom_publications', []);
      const pIdx = pubs.findIndex(p => p.id === videoId);
      if (pIdx >= 0) {
        if (updates.title) pubs[pIdx].content = updates.title;
        if (updates.video_url) pubs[pIdx].media_url = updates.video_url;
        this.setStored('custom_publications', pubs);
      }
      return current[idx];
    }
    return null;
  }

  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      const current = this.getStored<VideoItem[]>('custom_videos', []);
      this.setStored('custom_videos', current.filter(v => v.id !== videoId));
      
      const pubs = this.getStored<Publication[]>('custom_publications', []);
      this.setStored('custom_publications', pubs.filter(p => p.id !== videoId));

      const deletedIds = this.getStored<string[]>('deleted_videos_ids', []);
      if (!deletedIds.includes(videoId)) {
        this.setStored('deleted_videos_ids', [...deletedIds, videoId]);
      }
      return true;
    } catch {
      return false;
    }
  }

  async updateArtisan(artisanId: string, updates: Partial<Artisan>): Promise<Artisan | null> {
    const current = this.getStored<Artisan[]>('custom_artisans', []);
    const idx = current.findIndex(a => a.id === artisanId);
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...updates };
      this.setStored('custom_artisans', current);
      return current[idx];
    }
    return null;
  }

  async deleteArtisan(artisanId: string): Promise<boolean> {
    const current = this.getStored<Artisan[]>('custom_artisans', []);
    this.setStored('custom_artisans', current.filter(a => a.id !== artisanId));
    const deletedIds = this.getStored<string[]>('deleted_artisans_ids', []);
    if (!deletedIds.includes(artisanId)) {
      this.setStored('deleted_artisans_ids', [...deletedIds, artisanId]);
    }
    return true;
  }

  // CHAT - CRITICAL: FIX BUG ENVOI DOUBLE - 1 SEUL INSERT GARANTI
  private pendingMessageTokens = new Set<string>();

  async getConversations(myId: string): Promise<Conversation[]> {
    const deletedConvIds = this.getStored<string[]>(`deleted_convs_${myId}`, []);
    const directConvs = this.getStored<Conversation[]>(`convs_${myId}`, []);

    // Also find any alias IDs (e.g. if myId is a user who is also an artisan, or an artisan ID)
    const allUsers = await this.getAllUsers();
    const allArtisans = await this.getArtisans();
    const currentUser = allUsers.find(u => u.id === myId);

    const aliasIds = new Set<string>([myId]);
    if (currentUser) {
      const userEmail = currentUser.email;
      if (userEmail) {
        allArtisans.forEach(a => {
          if (a.nom.toLowerCase() === currentUser.full_name?.toLowerCase() || (a as any).email === userEmail) {
            aliasIds.add(a.id);
          }
        });
      }
      const userPhone = currentUser.telephone;
      if (userPhone) {
        allArtisans.forEach(a => {
          if (a.telephone && a.telephone.replace(/[^0-9]/g, '') === userPhone.replace(/[^0-9]/g, '')) {
            aliasIds.add(a.id);
          }
        });
      }
    } else {
      // Check if myId is an artisan id
      const matchArt = allArtisans.find(a => a.id === myId);
      if (matchArt) {
        allUsers.forEach(u => {
          if (u.full_name.toLowerCase() === matchArt.nom.toLowerCase()) {
            aliasIds.add(u.id);
          }
        });
      }
    }

    // Merge conversations from all alias IDs
    const mergedConvs: Conversation[] = [...directConvs];
    for (const aId of Array.from(aliasIds)) {
      if (aId !== myId) {
        const aliasList = this.getStored<Conversation[]>(`convs_${aId}`, []);
        mergedConvs.push(...aliasList);
      }
    }

    // Also scan global conversations and messages to find any conversation where myId or any alias is a participant
    const globalConvIds = this.getStored<string[]>('all_admin_conv_ids', []);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes('msgs_conv-')) {
        const cId = k.replace(/^artisanpro_/, '').replace('msgs_', '');
        if (!globalConvIds.includes(cId)) globalConvIds.push(cId);
      }
    }

    const userMap = new Map<string, UserProfile>(allUsers.map(u => [u.id, u]));
    const artisanMap = new Map<string, Artisan>(allArtisans.map(a => [a.id, a]));

    for (const cId of globalConvIds) {
      const pair = cId.replace('conv-', '').split('_');
      if (pair.length === 2) {
        const isParticipant = Array.from(aliasIds).some(id => id === pair[0] || id === pair[1]);
        if (isParticipant) {
          const otherId = Array.from(aliasIds).includes(pair[0]) ? pair[1] : pair[0];
          const exists = mergedConvs.some(c => c.id === cId || c.contact_id === otherId);
          if (!exists) {
            // Retrieve messages to verify conversation has content or was started
            const msgs = this.getStored<ChatMessage[]>(`msgs_${cId}`, []);
            const otherUser = userMap.get(otherId);
            const otherArt = artisanMap.get(otherId);

            let contactName = otherUser?.full_name || otherArt?.nom || 'Contact ArtisanPro';
            let contactAvatar = otherUser?.avatar_url || (otherArt?.photos ? otherArt.photos[0] : undefined);
            let contactRole = otherUser?.role === 'artisan' ? (otherUser.metier || 'Artisan') : otherArt ? otherArt.metier : 'Client';

            if (msgs.length > 0) {
              const otherMsg = msgs.find(m => m.sender_id === otherId);
              if (otherMsg && (!contactName || contactName.startsWith('Contact'))) {
                contactName = otherMsg.sender_name;
              }
            }

            const lastM = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            const newReconstructed: Conversation = {
              id: cId,
              contact_id: otherId,
              contact_name: contactName,
              contact_avatar: contactAvatar,
              contact_role: contactRole,
              last_message: lastM ? lastM.text : 'Discussion démarrée',
              last_message_time: lastM ? new Date(lastM.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Récent',
              unread_count: 0
            };
            mergedConvs.push(newReconstructed);
          }
        }
      }
    }

    // Filter deleted conversations
    const activeConvs = mergedConvs.filter(c => !deletedConvIds.includes(c.id));

    // STRICT DEDUPLICATION: 1 SEUL NOM / 1 SEUL CONTACT PAR CONVERSATION
    const seenContactIds = new Set<string>();
    const seenConvIds = new Set<string>();
    const deduped: Conversation[] = [];

    for (const conv of activeConvs) {
      const contactKey = (conv.contact_id || conv.contact_name).toLowerCase().trim();
      if (seenConvIds.has(conv.id) || seenContactIds.has(contactKey)) {
        continue;
      }
      seenConvIds.add(conv.id);
      seenContactIds.add(contactKey);
      deduped.push(conv);
    }

    // Persist cleaned up conversations back to user storage so it is instant next time
    this.setStored(`convs_${myId}`, deduped);

    return deduped;
  }

  async deleteConversationForUser(conversationId: string, myId: string): Promise<boolean> {
    try {
      const convsKey = `convs_${myId}`;
      const convs = this.getStored<Conversation[]>(convsKey, []);
      this.setStored(convsKey, convs.filter(c => c.id !== conversationId));

      const delKey = `deleted_convs_${myId}`;
      const delList = this.getStored<string[]>(delKey, []);
      if (!delList.includes(conversationId)) {
        this.setStored(delKey, [...delList, conversationId]);
      }
      return true;
    } catch {
      return false;
    }
  }

  async getAvailableChatUsers(myId: string): Promise<UserProfile[]> {
    const all = await this.getAllUsers();
    return all.filter(u => u.id !== myId && u.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase());
  }

  async startOrGetConversation(myId: string, myName: string, myAvatar: string | undefined, otherUser: UserProfile): Promise<Conversation> {
    const sortedPair = [myId, otherUser.id].sort().join('_');
    const convId = `conv-${sortedPair}`;

    const convsKey = `convs_${myId}`;
    const convs = this.getStored<Conversation[]>(convsKey, []);
    
    // Strict match to avoid duplicate creation
    const existing = convs.find(c => c.contact_id === otherUser.id || c.id === convId);
    if (existing) {
      existing.id = convId;
      existing.contact_name = otherUser.full_name;
      existing.contact_avatar = otherUser.avatar_url || existing.contact_avatar;
      this.setStored(convsKey, convs);
      return existing;
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newConv: Conversation = {
      id: convId,
      contact_id: otherUser.id,
      contact_name: otherUser.full_name,
      contact_avatar: otherUser.avatar_url,
      contact_role: otherUser.role === 'admin' ? 'Super Admin & Fondateur' : otherUser.role === 'artisan' ? (otherUser.metier || 'Artisan') : 'Client',
      last_message: 'Nouvelle conversation démarrée',
      last_message_time: timeStr,
      unread_count: 0
    };

    this.setStored(convsKey, [newConv, ...convs]);

    // Also register immediately on the receiver side for bidirectional messaging
    const receiverKey = `convs_${otherUser.id}`;
    const receiverConvs = this.getStored<Conversation[]>(receiverKey, []);
    if (!receiverConvs.some(c => c.contact_id === myId || c.id === convId)) {
      const mirrorConv: Conversation = {
        id: convId,
        contact_id: myId,
        contact_name: myName,
        contact_avatar: myAvatar,
        contact_role: 'Membre ArtisanPro',
        last_message: 'Nouvelle conversation démarrée',
        last_message_time: timeStr,
        unread_count: 1
      };
      this.setStored(receiverKey, [mirrorConv, ...receiverConvs]);
    }

    // Register into global admin conversations index
    const allAdminConvs = this.getStored<string[]>('all_admin_conv_ids', []);
    if (!allAdminConvs.includes(convId)) {
      this.setStored('all_admin_conv_ids', [convId, ...allAdminConvs]);
    }

    return newConv;
  }

  // ADMIN CHAT AUDIT & MONITORING - Displays all conversations and messages on Admin Dashboard
  async getAllConversationsForAdmin(): Promise<any[]> {
    const convIdSet = new Set<string>(this.getStored<string[]>('all_admin_conv_ids', []));
    
    // Also scan localStorage for any conversation keys
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('msgs_')) {
          convIdSet.add(k.replace('msgs_', ''));
        } else if (k && k.startsWith('convs_')) {
          const list = this.getStored<Conversation[]>(k, []);
          list.forEach(c => convIdSet.add(c.id));
        }
      }
    } catch {}

    const results: any[] = [];
    const allUsers = await this.getAllUsers();
    const userMap = new Map<string, UserProfile>(allUsers.map(u => [u.id, u]));

    for (const cId of Array.from(convIdSet)) {
      const msgs = this.getStored<ChatMessage[]>(`msgs_${cId}`, []);
      const pair = cId.replace('conv-', '').split('_');
      const userA = userMap.get(pair[0]) || { id: pair[0], full_name: 'Utilisateur ' + (pair[0]?.slice(0, 6) || ''), role: 'client' as const, email: '' };
      const userB = userMap.get(pair[1]) || { id: pair[1], full_name: 'Artisan ' + (pair[1]?.slice(0, 6) || ''), role: 'artisan' as const, email: '' };

      // Derive names from msgs if missing
      if (msgs.length > 0) {
        const sender1 = msgs.find(m => m.sender_id === pair[0]);
        if (sender1 && userA.full_name.startsWith('Utilisateur ')) {
          userA.full_name = sender1.sender_name;
        }
        const sender2 = msgs.find(m => m.sender_id === pair[1]);
        if (sender2 && userB.full_name.startsWith('Artisan ')) {
          userB.full_name = sender2.sender_name;
        }
      }

      results.push({
        id: cId,
        userA,
        userB,
        messagesCount: msgs.length,
        lastMessage: msgs.length > 0 ? msgs[msgs.length - 1] : null,
        lastMessageTime: msgs.length > 0 ? new Date(msgs[msgs.length - 1].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Récent',
        messages: msgs
      });
    }

    // Sort by most recent message
    return results.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }

  async deleteConversationForAdmin(convId: string): Promise<boolean> {
    try {
      localStorage.removeItem(`msgs_${convId}`);
      const adminIds = this.getStored<string[]>('all_admin_conv_ids', []);
      this.setStored('all_admin_conv_ids', adminIds.filter(id => id !== convId));
      return true;
    } catch {
      return false;
    }
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    return this.getStored<ChatMessage[]>(`msgs_${conversationId}`, []);
  }

  async deleteMessage(conversationId: string, messageId: string): Promise<boolean> {
    try {
      const key = `msgs_${conversationId}`;
      const existing = this.getStored<ChatMessage[]>(key, []);
      this.setStored(key, existing.filter(m => m.id !== messageId));
      return true;
    } catch {
      return false;
    }
  }

  async clearMessages(conversationId: string, myId?: string): Promise<boolean> {
    try {
      const key = `msgs_${conversationId}`;
      this.setStored(key, []);

      if (myId) {
        const convsKey = `convs_${myId}`;
        const convs = this.getStored<Conversation[]>(convsKey, []);
        const idx = convs.findIndex(c => c.id === conversationId);
        if (idx >= 0) {
          convs[idx].last_message = 'Discussion réinitialisée';
          this.setStored(convsKey, convs);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  // GUARANTEED SINGLE INSERT WITH ANTI-DOUBLE-CLICK LOCK & UNIQUE SUBMISSION TOKEN
  async sendMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    receiverId: string,
    text: string,
    uniqueToken: string,
    options?: {
      type?: 'text' | 'voice' | 'file' | 'image';
      media_url?: string;
      media_name?: string;
      media_size?: string;
      voice_duration?: number;
    }
  ): Promise<ChatMessage | null> {
    const cleanText = text.trim();
    if (!cleanText && !options?.media_url) return null;

    // Strict Anti-duplicate Lock
    if (this.pendingMessageTokens.has(uniqueToken)) {
      console.warn('Duplicate message submission blocked by token:', uniqueToken);
      return null;
    }
    this.pendingMessageTokens.add(uniqueToken);

    try {
      const newMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        conversation_id: conversationId,
        sender_id: senderId,
        sender_name: senderName,
        receiver_id: receiverId,
        text: cleanText || (options?.type === 'voice' ? '🎤 Message vocal' : options?.type === 'image' ? '📷 Image' : '📎 Fichier'),
        created_at: new Date().toISOString(),
        type: options?.type || 'text',
        media_url: options?.media_url,
        media_name: options?.media_name,
        media_size: options?.media_size,
        voice_duration: options?.voice_duration
      };

      const key = `msgs_${conversationId}`;
      const existing = this.getStored<ChatMessage[]>(key, []);
      // Check if exact message already exists in the last 2 seconds
      const isDuplicate = existing.some(
        m => m.sender_id === senderId && m.text === newMsg.text && Math.abs(new Date(m.created_at).getTime() - Date.now()) < 2000
      );

      if (isDuplicate) {
        console.warn('Duplicate message blocked by timestamp & content');
        return null;
      }

      this.setStored(key, [...existing, newMsg]);

      // Ensure conversation is in global admin index
      const adminConvIds = this.getStored<string[]>('all_admin_conv_ids', []);
      if (!adminConvIds.includes(conversationId)) {
        this.setStored('all_admin_conv_ids', [conversationId, ...adminConvIds]);
      }

      // Update conversation last message for sender
      const convsKey = `convs_${senderId}`;
      const convs = this.getStored<Conversation[]>(convsKey, []);
      const idx = convs.findIndex(c => c.id === conversationId || c.contact_id === receiverId);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (idx >= 0) {
        convs[idx].id = conversationId;
        convs[idx].last_message = cleanText;
        convs[idx].last_message_time = timeStr;
        this.setStored(convsKey, convs);
      } else {
        const senderConv: Conversation = {
          id: conversationId,
          contact_id: receiverId,
          contact_name: 'Contact',
          contact_role: 'Membre ArtisanPro',
          last_message: cleanText,
          last_message_time: timeStr,
          unread_count: 0
        };
        this.setStored(convsKey, [senderConv, ...convs]);
      }

      // Also update receiver conversation preview if exists
      if (receiverId && receiverId !== 'me') {
        const rKey = `convs_${receiverId}`;
        const rConvs = this.getStored<Conversation[]>(rKey, []);
        const rIdx = rConvs.findIndex(c => c.id === conversationId || c.contact_id === senderId);
        if (rIdx >= 0) {
          rConvs[rIdx].id = conversationId;
          rConvs[rIdx].last_message = cleanText;
          rConvs[rIdx].last_message_time = timeStr;
          rConvs[rIdx].unread_count = (rConvs[rIdx].unread_count || 0) + 1;
          this.setStored(rKey, rConvs);
        } else {
          const mirrorConv: Conversation = {
            id: conversationId,
            contact_id: senderId,
            contact_name: senderName,
            contact_avatar: undefined,
            contact_role: 'Membre ArtisanPro',
            last_message: cleanText,
            last_message_time: timeStr,
            unread_count: 1
          };
          this.setStored(rKey, [mirrorConv, ...rConvs]);
        }
      }

      // Try broadcasting via Supabase Realtime channel
      try {
        const channel = supabase.channel(`chat_${conversationId}`);
        await channel.send({
          type: 'broadcast',
          event: 'new_message',
          payload: newMsg
        });
      } catch (err) {
        // Broadcast non-blocking
      }

      return newMsg;
    } finally {
      setTimeout(() => {
        this.pendingMessageTokens.delete(uniqueToken);
      }, 1500);
    }
  }

  // NOTIFICATIONS
  async getNotifications(userId: string): Promise<AppNotification[]> {
    const welcomeNotif: AppNotification[] = [
      {
        id: 'notif-welcome',
        user_id: userId,
        title: 'Bienvenue sur ArtisanPro Afrique !',
        message: 'Votre compte est actif. Publiez des créations, trouvez des artisans ou sollicitez une certification officielle.',
        type: 'system',
        created_at: new Date().toISOString(),
        is_read: false
      }
    ];

    const userNotifs = this.getStored<AppNotification[]>(`notifs_${userId}`, welcomeNotif);
    const globalBroadcasts = this.getStored<AppNotification[]>('global_broadcasts', []);

    // Merge without duplicates
    const all = [...userNotifs, ...globalBroadcasts];
    const seen = new Set<string>();
    return all.filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
  }

  async markNotificationAsRead(userId: string, notifId: string): Promise<void> {
    const notifs = await this.getNotifications(userId);
    const updated = notifs.map(n => n.id === notifId ? { ...n, is_read: true } : n);
    this.setStored(`notifs_${userId}`, updated);
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const notifs = await this.getNotifications(userId);
    const updated = notifs.map(n => ({ ...n, is_read: true }));
    this.setStored(`notifs_${userId}`, updated);
  }

  // ADMIN BROADCAST NOTIFICATION TO ALL USERS
  async broadcastNotification(title: string, message: string, senderEmail: string): Promise<number> {
    const notifId = `broadcast-${Date.now()}`;
    const newNotif: AppNotification = {
      id: notifId,
      user_id: 'all',
      title: title.trim(),
      message: message.trim(),
      type: 'system',
      created_at: new Date().toISOString(),
      is_read: false
    };

    // Store in global broadcasts
    const globals = this.getStored<AppNotification[]>('global_broadcasts', []);
    this.setStored('global_broadcasts', [newNotif, ...globals]);

    // Send to each registered user list
    const users = await this.getAllUsers();
    let sentCount = 0;
    for (const u of users) {
      const userKey = `notifs_${u.id}`;
      const existing = this.getStored<AppNotification[]>(userKey, []);
      this.setStored(userKey, [newNotif, ...existing]);
      sentCount++;
    }

    return sentCount;
  }

  // REPORTS (SIGNALEMENTS)
  async submitReport(report: Omit<ProblemReport, 'id' | 'created_at' | 'status'>): Promise<ProblemReport> {
    const newReport: ProblemReport = {
      ...report,
      id: 'rep-' + Date.now(),
      status: 'pending',
      created_at: new Date().toISOString()
    };
    const reports = this.getStored<ProblemReport[]>('admin_reports', []);
    this.setStored('admin_reports', [newReport, ...reports]);
    return newReport;
  }

  // ARTISAN VERIFICATION REQUESTS (4 REQUIRED DOCUMENTS)
  async getVerificationRequests(): Promise<ArtisanVerificationRequest[]> {
    return this.getStored<ArtisanVerificationRequest[]>('artisan_verifications', []);
  }

  async submitVerificationRequest(
    req: Omit<ArtisanVerificationRequest, 'id' | 'status' | 'created_at'>
  ): Promise<ArtisanVerificationRequest> {
    const newReq: ArtisanVerificationRequest = {
      ...req,
      id: 'verif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const current = await this.getVerificationRequests();
    // Replace any existing pending request from the same artisan
    const filtered = current.filter(r => r.artisan_id !== req.artisan_id);
    this.setStored('artisan_verifications', [newReq, ...filtered]);

    // Update user profile status to pending
    const localUsers = this.getRegisteredUsers();
    const uIdx = localUsers.findIndex(u => u.id === req.artisan_id || u.email.toLowerCase() === req.artisan_email.toLowerCase());
    if (uIdx >= 0) {
      localUsers[uIdx].verification_status = 'pending';
      this.setStored('registered_users', localUsers);
    }

    return newReq;
  }

  async reviewVerificationRequest(
    requestId: string,
    status: 'verified' | 'rejected',
    reason?: string
  ): Promise<boolean> {
    const requests = await this.getVerificationRequests();
    const req = requests.find(r => r.id === requestId);
    if (!req) return false;

    req.status = status;
    req.reviewed_at = new Date().toISOString();
    if (reason) req.rejection_reason = reason;

    this.setStored('artisan_verifications', requests);

    // Update the artisan profile
    const localUsers = this.getRegisteredUsers();
    const uIdx = localUsers.findIndex(u => u.id === req.artisan_id || u.email.toLowerCase() === req.artisan_email.toLowerCase());
    if (uIdx >= 0) {
      if (status === 'verified') {
        localUsers[uIdx].is_verified = true;
        localUsers[uIdx].badge_bleu = true;
        localUsers[uIdx].badge_verified = true;
        localUsers[uIdx].verification_status = 'verified';
      } else {
        localUsers[uIdx].is_verified = false;
        localUsers[uIdx].badge_bleu = false;
        localUsers[uIdx].verification_status = 'rejected';
      }
      this.setStored('registered_users', localUsers);

      // Also update artisan profile localStorage key
      const profKey = `artisanpro_profile_${localUsers[uIdx].id}`;
      const savedProf = localStorage.getItem(profKey);
      if (savedProf) {
        try {
          const parsed = JSON.parse(savedProf);
          if (status === 'verified') {
            parsed.is_verified = true;
            parsed.badge_bleu = true;
            parsed.verification_status = 'verified';
          } else {
            parsed.verification_status = 'rejected';
          }
          localStorage.setItem(profKey, JSON.stringify(parsed));
        } catch {
          // ignore
        }
      }
    }

    // Send targeted notification to the artisan
    const notifTitle = status === 'verified' 
      ? '🎉 Félicitations ! Votre compte est certifié'
      : '❌ Dossier de certification non validé';
    
    const notifMsg = status === 'verified'
      ? 'Votre dossier de vérification a été validé avec succès par l\'Administration. Vous bénéficiez désormais du Badge Bleu officiel ArtisanPro !'
      : (reason || 'Votre dossier a été refusé. Veuillez vérifier vos 4 pièces justificatives (CNI, selfie, atelier, diplôme) et soumettre à nouveau.');

    const notif: AppNotification = {
      id: `verif-res-${Date.now()}`,
      user_id: req.artisan_id,
      title: notifTitle,
      message: notifMsg,
      type: 'verification',
      created_at: new Date().toISOString(),
      is_read: false
    };

    const notifKey = `notifs_${req.artisan_id}`;
    const userNotifs = this.getStored<AppNotification[]>(notifKey, []);
    this.setStored(notifKey, [notif, ...userNotifs]);

    return true;
  }

  // SUBSCRIPTION PROOFS (GENIUSPAY PROOF WORKFLOW)
  async getSubscriptionProofs(): Promise<SubscriptionPaymentProof[]> {
    return this.getStored<SubscriptionPaymentProof[]>('subscription_proofs', []);
  }

  async submitSubscriptionProof(proof: Omit<SubscriptionPaymentProof, 'id' | 'status' | 'created_at'>): Promise<SubscriptionPaymentProof> {
    const newProof: SubscriptionPaymentProof = {
      ...proof,
      id: `sub-proof-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const current = await this.getSubscriptionProofs();
    const updated = [newProof, ...current];
    this.setStored('subscription_proofs', updated);

    // Also notify admin
    const adminNotif: AppNotification = {
      id: `admin-sub-notif-${Date.now()}`,
      user_id: 'admin-adanmitondejunior07',
      title: `💰 Preuve paiement : ${proof.artisan_name}`,
      message: `Nouvelle preuve d'abonnement ${proof.plan_name} (${proof.period}) de ${proof.amount_fcfa} FCFA soumise via GeniusPay.`,
      type: 'system',
      created_at: new Date().toISOString(),
      is_read: false
    };
    const adminNotifs = this.getStored<AppNotification[]>('notifs_admin-adanmitondejunior07', []);
    this.setStored('notifs_admin-adanmitondejunior07', [adminNotif, ...adminNotifs]);

    return newProof;
  }

  async validateSubscriptionProof(proofId: string): Promise<boolean> {
    const current = await this.getSubscriptionProofs();
    const proof = current.find(p => p.id === proofId);
    if (!proof) return false;

    const now = new Date();
    // Expiration date calculation: +1 month or +1 year
    const expiresDate = new Date();
    if (proof.period === 'mensuel') {
      expiresDate.setMonth(expiresDate.getMonth() + 1);
    } else {
      expiresDate.setFullYear(expiresDate.getFullYear() + 1);
    }
    const expiresAtIso = expiresDate.toISOString();

    const updated = current.map(p => {
      if (p.id === proofId) {
        return {
          ...p,
          status: 'validated' as const,
          reviewed_at: now.toISOString(),
          expires_at: expiresAtIso
        };
      }
      return p;
    });
    this.setStored('subscription_proofs', updated);

    // Update artisan user profile (badge bleu, is_verified, subscription_plan, subscription_expires_at)
    const profileKey = `artisanpro_profile_${proof.artisan_id}`;
    const userProfileStr = localStorage.getItem(profileKey);
    if (userProfileStr) {
      try {
        const uProf = JSON.parse(userProfileStr);
        const updatedProf: UserProfile = {
          ...uProf,
          is_verified: true,
          badge_bleu: true,
          badge_verified: true,
          subscription_plan: proof.plan_id,
          subscription_period: proof.period,
          subscription_expires_at: expiresAtIso
        };
        localStorage.setItem(profileKey, JSON.stringify(updatedProf));
        this.saveRegisteredUser(updatedProf);
      } catch (e) {
        console.warn('Error updating profile with subscription:', e);
      }
    }

    // Try remote update in Supabase profiles
    try {
      await supabase.from('profiles').update({
        is_verified: true,
        badge_bleu: true,
        subscription_plan: proof.plan_id,
        subscription_expires_at: expiresAtIso
      }).eq('id', proof.artisan_id);
    } catch {}

    // Send confirmation notification to artisan
    const notif: AppNotification = {
      id: `sub-val-${Date.now()}`,
      user_id: proof.artisan_id,
      title: `🎉 Abonnement ${proof.plan_name} validé !`,
      message: `Votre paiement GeniusPay a été validé avec succès par l'Administration. Votre Badge Bleu Pro et vos avantages exclusifs sont activés jusqu'au ${expiresDate.toLocaleDateString('fr-FR')}.`,
      type: 'verification',
      created_at: now.toISOString(),
      is_read: false
    };
    const userNotifKey = `notifs_${proof.artisan_id}`;
    const userNotifs = this.getStored<AppNotification[]>(userNotifKey, []);
    this.setStored(userNotifKey, [notif, ...userNotifs]);

    return true;
  }

  async rejectSubscriptionProof(proofId: string, reason: string): Promise<boolean> {
    const current = await this.getSubscriptionProofs();
    const proof = current.find(p => p.id === proofId);
    if (!proof) return false;

    const now = new Date();
    const updated = current.map(p => {
      if (p.id === proofId) {
        return {
          ...p,
          status: 'rejected' as const,
          rejection_reason: reason || 'Preuve de paiement non lisible ou non valide sur GeniusPay.',
          reviewed_at: now.toISOString()
        };
      }
      return p;
    });
    this.setStored('subscription_proofs', updated);

    // Send notification to artisan
    const notif: AppNotification = {
      id: `sub-rej-${Date.now()}`,
      user_id: proof.artisan_id,
      title: `❌ Preuve d'abonnement non validée`,
      message: reason || 'Votre preuve de paiement n\'a pas pu être validée. Veuillez renvoyer une capture d\'écran claire de votre reçu GeniusPay.',
      type: 'system',
      created_at: now.toISOString(),
      is_read: false
    };
    const userNotifKey = `notifs_${proof.artisan_id}`;
    const userNotifs = this.getStored<AppNotification[]>(userNotifKey, []);
    this.setStored(userNotifKey, [notif, ...userNotifs]);

    return true;
  }

  // ADMIN OPERATIONS - ZERO SAMPLE USERS
  async getAdminStats() {
    const users = await this.getAllUsers();
    const artisans = await this.getArtisans();
    const pubs = await this.getPublications();
    const reports = this.getStored<ProblemReport[]>('admin_reports', []);
    const verifs = await this.getVerificationRequests();
    const pendingVerifs = verifs.filter(v => v.status === 'pending').length;
    const subProofs = await this.getSubscriptionProofs();
    const pendingSubs = subProofs.filter(s => s.status === 'pending').length;

    return {
      totalUsers: users.length,
      totalArtisans: artisans.length,
      totalPublications: pubs.length,
      totalReports: reports.length,
      pendingVerifications: pendingVerifs,
      pendingSubscriptions: pendingSubs
    };
  }

  // GET ALL REAL USERS (ONLY GENUINELY REGISTERED USERS)
  async getAllUsers(): Promise<UserProfile[]> {
    const list: UserProfile[] = [];

    // Always include founder admin
    list.push({
      id: 'admin-adanmitondejunior07',
      email: ADMIN_EMAIL,
      full_name: 'Adanmitonde Junior (Fondateur)',
      nom: 'Junior',
      prenom: 'Adanmitonde',
      telephone: '+225 0503444508',
      role: 'admin',
      pays: 'Côte d\'Ivoire',
      ville: 'Abidjan',
      is_verified: true,
      badge_bleu: true,
      is_fondateur: true,
      created_at: '2026-01-01T00:00:00Z'
    });

    // 1. Fetch from Supabase profiles table if available
    try {
      const { data } = await supabase.from('profiles').select('*');
      if (data && data.length > 0) {
        data.forEach(p => {
          list.push({
            id: p.id,
            email: p.email,
            full_name: p.full_name || p.email.split('@')[0],
            role: (p.role as any) || 'client',
            is_verified: p.is_verified,
            badge_bleu: p.badge_bleu,
            is_fondateur: p.is_fondateur,
            created_at: p.created_at
          });
        });
      }
    } catch {
      // Supabase offline/error fallback
    }

    // 2. Fetch locally registered users
    const localUsers = this.getRegisteredUsers();
    list.push(...localUsers);

    // De-duplicate by email and exclude Konan
    const seen = new Set<string>();
    return list.filter(u => {
      const name = `${u.full_name || ''} ${u.nom || ''} ${u.prenom || ''}`.toLowerCase();
      const key = u.email.toLowerCase().trim();
      if (name.includes('konan') || key.includes('konan')) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async toggleSuspendUser(userId: string, reason: string = 'Non-respect des règles de la communauté'): Promise<boolean> {
    const suspended = this.getStored<string[]>('suspended_users', []);
    const isSusp = suspended.includes(userId);
    const updated = isSusp ? suspended.filter(id => id !== userId) : [...suspended, userId];
    this.setStored('suspended_users', updated);
    
    const reasons = this.getStored<Record<string, string>>('suspended_reasons', {});
    if (!isSusp) {
      reasons[userId] = reason;
    } else {
      delete reasons[userId];
    }
    this.setStored('suspended_reasons', reasons);

    return !isSusp;
  }

  isUserSuspended(userId: string): boolean {
    const suspended = this.getStored<string[]>('suspended_users', []);
    return suspended.includes(userId);
  }

  getSuspensionReason(userId: string): string {
    const reasons = this.getStored<Record<string, string>>('suspended_reasons', {});
    return reasons[userId] || 'Non-respect des règles de la communauté et de la plateforme.';
  }
}

export const dataStore = new DataStoreService();
