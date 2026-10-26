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
  verification_status?: VerificationStatus;
  wallet_balance?: number;
  suspended?: boolean;
  subscription_plan?: 'essentiel' | 'pro' | 'premium_vip';
  subscription_period?: 'mensuel' | 'annuel';
  gps_lat?: number;
  gps_lng?: number;
  gps_label?: string;
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
  last_message_timestamp?: number;
  unread_count: number;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'like' | 'comment' | 'message' | 'verification' | 'system' | 'wallet' | 'mission';
  target_page?: string;
  target_id?: string;
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

export type VerificationStatus = 'unverified' | 'pending' | 'in_review' | 'verified' | 'rejected';

export interface VerificationHistoryEntry {
  status: VerificationStatus;
  timestamp: string;
  note?: string;
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
  status: VerificationStatus;
  rejection_reason?: string;
  created_at: string;
  reviewed_at?: string;
  history?: VerificationHistoryEntry[];
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

// ==========================================
// PORTEFEUILLE & TRANSACTIONS (FCFA)
// ==========================================
export type TransactionType = 'deposit' | 'payment' | 'payout' | 'refund' | 'commission';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type PaymentProvider = 'orange_money' | 'mtn_momo' | 'moov_money' | 'wave' | 'wallet_internal' | 'geniuspay';

export interface UserWallet {
  id: string;
  user_id: string;
  balance_fcfa: number;
  currency: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  user_name?: string;
  user_role?: UserRole;
  type: TransactionType;
  amount_fcfa: number;
  status: TransactionStatus;
  provider: PaymentProvider;
  reference: string;
  provider_ref?: string;
  description: string;
  mission_id?: string;
  created_at: string;
  confirmed_at?: string;
}

// ==========================================
// DEMANDES D'INTERVENTION & GPS INTELLIGENT
// ==========================================
export type InterventionType = 'normal' | 'urgent';

export type MissionStatus = 
  | 'pending_payment'
  | 'payment_verifying'
  | 'searching_artisan'
  | 'offer_sent'
  | 'artisan_accepted'
  | 'artisan_en_route'
  | 'artisan_arrived'
  | 'in_progress'
  | 'completed_by_artisan'
  | 'completed_by_client'
  | 'payment_finalized'
  | 'cancelled'
  | 'refund_in_progress'
  | 'refunded';

export interface ServiceRequest {
  id: string;
  client_id: string;
  client_name: string;
  client_phone?: string;
  client_avatar?: string;
  metier: string;
  type: InterventionType;
  urgency_fee_fcfa: number;
  is_urgency_paid: boolean;
  urgency_payment_ref?: string;
  description: string;
  photo_url?: string;
  address_text: string;
  pays: string;
  ville: string;
  client_lat?: number;
  client_lng?: number;
  search_radius_km: number;
  status: MissionStatus;
  assigned_artisan_id?: string;
  assigned_artisan_name?: string;
  assigned_artisan_phone?: string;
  assigned_artisan_avatar?: string;
  assigned_artisan_lat?: number;
  assigned_artisan_lng?: number;
  assigned_at?: string;
  en_route_at?: string;
  arrived_at?: string;
  started_at?: string;
  completed_at?: string;
  quote_amount_fcfa?: number;
  quote_status?: 'pending' | 'accepted' | 'rejected';
  quote_notes?: string;
  quote_paid?: boolean;
  quote_payment_ref?: string;
  client_review_rating?: number;
  client_review_comment?: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformSettings {
  urgency_fee_fcfa: number;
  commission_percent: number;
  default_search_radius_km: number;
  max_search_radius_km: number;
  artisan_response_timeout_seconds: number;
  enabled_payment_methods_by_country: Record<string, string[]>;
}
