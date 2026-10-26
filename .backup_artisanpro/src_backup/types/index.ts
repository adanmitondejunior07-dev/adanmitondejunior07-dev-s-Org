export type UserRole = 'client' | 'artisan' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  nom?: string;
  prenom?: string;
  telephone?: string;
  role: UserRole;
  metier?: string;
  pays?: string;
  ville?: string;
  commune?: string;
  adresse_magasin?: string;
  repere_rue?: string;
  avatar_url?: string;
  bio?: string;
  is_verified?: boolean;
  badge_bleu?: boolean;
  badge_vert?: boolean;
  badge_verified?: boolean;
  is_fondateur?: boolean;
  is_certified?: boolean;
  is_kyc_verified?: boolean;
  verification_status?: 'pending' | 'verified' | 'rejected' | 'none';
  wallet_balance?: number;
  suspended?: boolean;
  subscription_plan?: 'essentiel' | 'pro' | 'premium_vip';
  subscription_period?: 'mensuel' | 'annuel';
  subscription_expires_at?: string;
  created_at: string;
}

export interface Artisan {
  id: string;
  nom: string;
  telephone?: string;
  whatsapp?: string;
  metier: string;
  ville: string;
  commune?: string;
  adresse_magasin?: string;
  repere_rue?: string;
  description?: string;
  services?: string;
  photos?: string[] | string | null;
  tarif_min?: number;
  verifie?: boolean;
  badge_vert?: boolean;
  badge_bleu?: boolean;
  is_verified?: boolean;
  is_fondateur?: boolean;
  note_moyenne?: number;
  nombre_avis?: number;
  disponible?: boolean;
  gps_lat?: number;
  gps_lng?: number;
  gps_label?: string;
  user_id?: string;
  created_at?: string;
}

export interface Publication {
  id: string;
  artisan_name: string;
  artisan_avatar?: string | null;
  location?: string | null;
  content: string;
  media_url?: string | null;
  media_type?: 'image' | 'video' | string;
  created_at: string;
  user_id?: string;
  likes_count?: number;
  comments_count?: number;
  is_liked_by_me?: boolean;
  gps_lat?: number;
  gps_lng?: number;
  gps_label?: string;
}

export interface CommentItem {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  comment_text: string;
  created_at: string;
}

export interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  price_fcfa: number;
  artisan_id: string;
  artisan_name: string;
  artisan_avatar?: string;
  telephone?: string;
  category: string;
  pays: string;
  ville: string;
  image_url: string;
  created_at: string;
  gps_lat?: number;
  gps_lng?: number;
  gps_label?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  video_url: string;
  poster_url?: string;
  artisan_name: string;
  artisan_avatar?: string;
  metier: string;
  ville: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  is_liked?: boolean;
  user_id?: string;
  artisan_id?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  text: string;
  created_at: string;
  read?: boolean;
  type?: 'text' | 'voice' | 'file' | 'image';
  media_url?: string;
  media_name?: string;
  media_size?: string;
  voice_duration?: number;
}

export interface Conversation {
  id: string;
  contact_id: string;
  contact_name: string;
  contact_avatar?: string;
  contact_role: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'like' | 'comment' | 'message' | 'verification' | 'system';
  created_at: string;
  is_read: boolean;
}

export interface ProblemReport {
  id: string;
  user_id: string;
  user_email: string;
  category: string;
  description: string;
  screenshot_url?: string;
  created_at: string;
  status: 'pending' | 'resolved';
}

export interface ArtisanVerificationRequest {
  id: string;
  artisan_id: string;
  artisan_name: string;
  artisan_email: string;
  metier: string;
  ville: string;
  pays?: string;
  cni_url: string;        // 1. CNI ou Passeport
  selfie_url: string;     // 2. Photo de vous (selfie / portrait)
  atelier_url: string;    // 3. Photo de votre atelier
  diplome_url: string;    // 4. Photo attestation de diplôme / certificat
  cni_number?: string;
  notes?: string;
  status: 'pending' | 'verified' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  reviewed_at?: string;
}

export type SubscriptionPlanId = 'essentiel' | 'pro' | 'premium_vip';
export type SubscriptionPeriod = 'mensuel' | 'annuel';

export interface SubscriptionPaymentProof {
  id: string;
  artisan_id: string;
  artisan_name: string;
  artisan_email: string;
  plan_id: SubscriptionPlanId;
  plan_name: string;
  period: SubscriptionPeriod;
  amount_fcfa: number;
  payment_proof_url: string;
  product_url: string;
  transaction_ref?: string;
  notes?: string;
  status: 'pending' | 'validated' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  reviewed_at?: string;
  expires_at?: string;
}

