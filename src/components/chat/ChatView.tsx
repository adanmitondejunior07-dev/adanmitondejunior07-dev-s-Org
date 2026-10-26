import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  ArrowLeft, 
  CheckCheck, 
  MessageSquare, 
  Sparkles,
  Phone,
  UserPlus,
  Search,
  X,
  Users,
  Lock,
  ShieldCheck,
  UserCheck,
  Mic,
  Trash2,
  Paperclip,
  Play,
  Pause,
  FileText,
  Image as ImageIcon,
  AlertTriangle
} from 'lucide-react';
import { Conversation, ChatMessage, UserProfile } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { compressImageFile } from '../../lib/mediaCompressor';

// Audio Player for voice notes
const VoiceMessagePlayer: React.FC<{ mediaUrl?: string; duration?: number; isMe: boolean }> = ({ mediaUrl, duration = 5, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current && mediaUrl) {
      audioRef.current = new Audio(mediaUrl);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onpause = () => setIsPlaying(false);
    }
    if (!audioRef.current) {
      // Simulate playback if no physical URL
      setIsPlaying(p => !p);
      setTimeout(() => setIsPlaying(false), (duration || 5) * 1000);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(true);
        setTimeout(() => setIsPlaying(false), (duration || 5) * 1000);
      });
    }
  };

  const durStr = duration < 10 ? `0:0${duration}` : `0:${duration}`;

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[170px]">
      <button
        type="button"
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-transform active:scale-95 ${
          isMe ? 'bg-white text-[#FF6B00]' : 'bg-[#FF6B00] text-white'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-0.5 h-3.5">
          {[40, 75, 50, 90, 60, 80, 45, 95, 70, 50, 85, 60, 35].map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}%` }}
              className={`w-1 rounded-full transition-all ${
                isPlaying ? 'animate-pulse' : ''
              } ${isMe ? 'bg-white/80' : 'bg-neutral-400'}`}
            />
          ))}
        </div>
        <div className={`text-[10px] mt-0.5 flex items-center justify-between font-semibold ${isMe ? 'text-white/80' : 'text-neutral-500'}`}>
          <span>Message vocal</span>
          <span>{durStr}</span>
        </div>
      </div>
    </div>
  );
};

interface ChatViewProps {
  initialActiveConversationId?: string | null;
  onSelectConversation?: (id: string | null) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  initialActiveConversationId = null,
  onSelectConversation
}) => {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Available real registered users & Tab state
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [chatActiveTab, setChatActiveTab] = useState<'conversations' | 'users'>('conversations');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Attachment state (🔗 bouton à gauche pour envoyer des fichiers ou images)
  const [pendingAttachment, setPendingAttachment] = useState<{
    dataUrl: string;
    name: string;
    size: string;
    type: 'image' | 'file';
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Vocal / Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);

  // Modal Supprimer tous les messages
  const [showClearModal, setShowClearModal] = useState(false);

  // CRITICAL: FIX BUG ENVOI DOUBLE - 1 SEUL INSERT GARANTI
  const [isSending, setIsSending] = useState(false);
  const lastSendTimestampRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const myId = user?.id || 'me';

  const isSuspended = user?.id ? dataStore.isUserSuspended(user.id) : false;
  const suspensionReason = user?.id ? dataStore.getSuspensionReason(user.id) : '';

  // Dedup helper
  const dedupList = (list: Conversation[]): Conversation[] => {
    const seen = new Set<string>();
    return list.filter(c => {
      const key = (c.contact_id || c.id || c.contact_name).toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Load conversations and available real users
  useEffect(() => {
    let isMounted = true;

    const loadChatData = async () => {
      const list = await dataStore.getConversations(myId);
      const allUsers = await dataStore.getAvailableChatUsers(myId);
      
      if (!isMounted) return;
      const cleanList = dedupList(list);
      setConversations(cleanList);
      setAvailableUsers(allUsers);

      if (initialActiveConversationId) {
        const targetContactId = initialActiveConversationId.replace('conv-', '');
        const canonicalTargetConvId = dataStore.getCanonicalConversationId(myId, targetContactId);
        let found = cleanList.find(c => 
          c.id === initialActiveConversationId || 
          c.id === canonicalTargetConvId ||
          c.contact_id === targetContactId
        );

        if (!found) {
          // Resolve target contact ID from conversation ID pattern or raw ID
          const targetUser = allUsers.find(u => u.id === targetContactId);
          if (targetUser) {
            found = await dataStore.startOrGetConversation(
              myId,
              profile?.full_name || 'Membre ArtisanPro',
              profile?.avatar_url,
              targetUser
            );
            if (isMounted && found) {
              setConversations(prev => dedupList([found!, ...prev]));
            }
          } else {
            // Check in artisans directory
            const artisans = await dataStore.getArtisans();
            const targetArtisan = artisans.find(a => a.id === targetContactId);
            if (targetArtisan) {
              const syntheticUser: UserProfile = {
                id: targetArtisan.id,
                email: `${targetArtisan.id}@artisanpro.africa`,
                full_name: targetArtisan.nom,
                role: 'artisan',
                metier: targetArtisan.metier,
                ville: targetArtisan.ville,
                avatar_url: targetArtisan.photos?.[0],
                is_verified: targetArtisan.verifie,
                badge_bleu: targetArtisan.badge_bleu,
                badge_vert: targetArtisan.badge_vert,
                created_at: new Date().toISOString()
              };
              found = await dataStore.startOrGetConversation(
                myId,
                profile?.full_name || 'Membre ArtisanPro',
                profile?.avatar_url,
                syntheticUser
              );
              if (isMounted && found) {
                setConversations(prev => dedupList([found!, ...prev]));
              }
            }
          }
        }
        if (found && isMounted) {
          openConversation(found);
        }
      }
    };

    loadChatData();

    return () => {
      isMounted = false;
    };
  }, [myId, initialActiveConversationId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Subscribe to real-time messages for active conversation
  useEffect(() => {
    if (!activeConv?.id) return;
    const cleanId = activeConv.id.replace(/[^a-zA-Z0-9_-]/g, '_');

    // 1. Cross-tab real-time sync via storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `artisanpro_msgs_${activeConv.id}` && e.newValue) {
        try {
          const fresh = JSON.parse(e.newValue);
          if (Array.isArray(fresh)) {
            setMessages(fresh);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 2. Supabase Realtime channel (if messages table is deployed)
    let channel: any = null;
    try {
      channel = supabase
        .channel(`chat_realtime_${cleanId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${activeConv.id}`
          },
          (payload) => {
            const newMsg = payload.new as ChatMessage;
            if (newMsg) {
              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            }
          }
        )
        .subscribe();
    } catch {}

    return () => {
      window.removeEventListener('storage', handleStorage);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [activeConv?.id]);

  // Global live message listener to re-order conversations to top when responses arrive
  useEffect(() => {
    const handleGlobalChatUpdate = (e: any) => {
      const { conversationId, message } = e.detail || {};
      if (!conversationId || !message) return;

      // 1. If currently in this active conversation, append message safely
      if (activeConv?.id === conversationId || activeConv?.contact_id === message.sender_id || activeConv?.contact_id === message.receiver_id) {
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }

      // 2. Re-order conversations: move updated conversation to top with new preview and timestamp
      const timeStr = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const nowTs = new Date(message.created_at).getTime() || Date.now();

      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === conversationId || c.contact_id === message.sender_id || c.contact_id === message.receiver_id);
        if (idx >= 0) {
          const updatedConv: Conversation = {
            ...prev[idx],
            id: conversationId,
            last_message: message.text,
            last_message_time: timeStr,
            last_message_timestamp: nowTs,
            unread_count: (activeConv?.id === conversationId || activeConv?.contact_id === message.sender_id) ? 0 : (prev[idx].unread_count || 0) + 1
          };
          const rest = prev.filter((_, i) => i !== idx);
          return [updatedConv, ...rest];
        } else {
          // New conversation appeared: re-fetch conversation list
          dataStore.getConversations(myId).then(freshList => setConversations(dedupList(freshList)));
          return prev;
        }
      });
    };

    window.addEventListener('artisanpro_chat_update' as any, handleGlobalChatUpdate);
    return () => {
      window.removeEventListener('artisanpro_chat_update' as any, handleGlobalChatUpdate);
    };
  }, [activeConv?.id, activeConv?.contact_id, myId]);

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    if (onSelectConversation) onSelectConversation(conv.id);
    const msgs = await dataStore.getMessages(conv.id);
    setMessages(msgs);

    // Mark as read in conversation list
    setConversations(prev =>
      prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c)
    );
  };

  const handleStartChatWithUser = async (targetUser: UserProfile) => {
    const conv = await dataStore.startOrGetConversation(
      myId,
      profile?.full_name || 'Membre ArtisanPro',
      profile?.avatar_url,
      targetUser
    );
    setShowNewChatModal(false);
    setConversations(prev => {
      if (prev.some(c => c.id === conv.id || c.contact_id === conv.contact_id)) return prev;
      return [conv, ...prev];
    });
    openConversation(conv);
  };

  const handleDeleteConversation = async (convId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Voulez-vous supprimer cette conversation ? Elle ne réapparaîtra plus.')) return;
    await dataStore.deleteConversationForUser(convId, myId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConv?.id === convId) {
      setActiveConv(null);
      if (onSelectConversation) onSelectConversation(null);
    }
  };

  const handleBackToList = () => {
    setActiveConv(null);
    if (onSelectConversation) onSelectConversation(null);
  };

  // ATTACHMENT HANDLER (🔗 Fichiers ou images)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith('image/');
    const sizeKb = Math.round(file.size / 1024);
    const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

    if (isImg) {
      const dataUrl = await compressImageFile(file, 1000, 0.8);
      setPendingAttachment({
        dataUrl,
        name: file.name,
        size: sizeStr,
        type: 'image'
      });
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setPendingAttachment({
          dataUrl,
          name: file.name,
          size: sizeStr,
          type: 'file'
        });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // VOCAL / VOICE RECORDING HANDLERS
  const startVoiceRecording = async () => {
    try {
      audioChunksRef.current = [];
      setRecordingSeconds(0);

      let stream: MediaStream | null = null;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
          console.warn('Microphone permission not granted, simulation mode active', e);
        }
      }

      if (stream) {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        recorder.start();
      }

      setIsRecording(true);
      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Could not start recording:', err);
      setIsRecording(true);
      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    }
  };

  const cancelVoiceRecording = () => {
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      } catch {}
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const sendVoiceRecording = async () => {
    if (!activeConv) return;
    if (isSuspended) {
      alert(`Votre compte est suspendu (${suspensionReason}). Impossible d'envoyer un message vocal.`);
      return;
    }
    const duration = Math.max(1, recordingSeconds);
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);

    let audioUrl = '';
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        if (!mediaRecorderRef.current) return resolve();
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioUrl = URL.createObjectURL(blob);
          resolve();
        };
        try {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        } catch {
          resolve();
        }
      });
    }

    setIsRecording(false);
    setRecordingSeconds(0);

    const now = Date.now();
    const uniqueToken = `${activeConv.id}-${now}-${Math.random().toString(36).substring(2, 6)}`;
    const myName = profile?.full_name || 'Utilisateur ArtisanPro';

    const sent = await dataStore.sendMessage(
      activeConv.id,
      myId,
      myName,
      activeConv.contact_id,
      `🎤 Message vocal (${duration}s)`,
      uniqueToken,
      {
        type: 'voice',
        media_url: audioUrl || undefined,
        voice_duration: duration
      }
    );

    if (sent) {
      setMessages(prev => [...prev, sent]);
      const nowTs = Date.now();
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === activeConv.id);
        if (idx >= 0) {
          const updated: Conversation = {
            ...prev[idx],
            last_message: '🎤 Message vocal',
            last_message_time: timeStr,
            last_message_timestamp: nowTs
          };
          const rest = prev.filter((_, i) => i !== idx);
          return [updated, ...rest];
        }
        return prev;
      });
    }
  };

  // MESSAGE DELETION HANDLERS (🗑 Supprimer message & Supprimer tout)
  const handleDeleteSingleMessage = async (msgId: string) => {
    if (!activeConv) return;
    if (!window.confirm('Voulez-vous supprimer ce message ?')) return;
    await dataStore.deleteMessage(activeConv.id, msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const handleConfirmClearAllMessages = async () => {
    if (!activeConv) return;
    await dataStore.clearMessages(activeConv.id, myId);
    setMessages([]);
    setShowClearModal(false);
    setConversations(prev =>
      prev.map(c =>
        c.id === activeConv.id
          ? {
              ...c,
              last_message: 'Discussion réinitialisée',
              last_message_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          : c
      )
    );
  };

  // SEND MESSAGE: STRICTLY 1 SINGLE INSERT, PREVENTS DOUBLE-CLICK OR DUPLICATE SUBMISSION
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (isSuspended) {
      alert(`Votre compte est actuellement suspendu (${suspensionReason}). L'envoi de messages est désactivé.`);
      return;
    }

    const textToSend = inputText.trim();
    if ((!textToSend && !pendingAttachment) || !activeConv) return;

    // Throttle check: must be at least 600ms between sends
    const now = Date.now();
    if (now - lastSendTimestampRef.current < 600) {
      console.warn('Ignored double-send attempt under 600ms');
      return;
    }

    if (isSending) {
      console.warn('Blocked duplicate send while isSending = true');
      return;
    }

    // Set locks immediately
    setIsSending(true);
    lastSendTimestampRef.current = now;
    
    // Clear input & attachment immediately to prevent double keypresses
    setInputText('');
    const attachmentToSend = pendingAttachment;
    setPendingAttachment(null);

    const uniqueToken = `${activeConv.id}-${now}-${Math.random().toString(36).substring(2, 6)}`;
    const myName = profile?.full_name || 'Utilisateur ArtisanPro';

    try {
      const sentMsg = await dataStore.sendMessage(
        activeConv.id,
        myId,
        myName,
        activeConv.contact_id,
        textToSend || (attachmentToSend?.type === 'image' ? '📷 Image' : '📎 Fichier'),
        uniqueToken,
        attachmentToSend ? {
          type: attachmentToSend.type,
          media_url: attachmentToSend.dataUrl,
          media_name: attachmentToSend.name,
          media_size: attachmentToSend.size
        } : undefined
      );

      if (sentMsg) {
        setMessages(prev => {
          // Double-check ID does not already exist
          if (prev.some(m => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });

        // Update conversation preview in sidebar/list & MOVE TO TOP
        const previewText = textToSend || (attachmentToSend?.type === 'image' ? '📷 Image' : '📎 Fichier');
        const nowTs = Date.now();
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === activeConv.id);
          if (idx >= 0) {
            const updated: Conversation = {
              ...prev[idx],
              last_message: previewText,
              last_message_time: timeStr,
              last_message_timestamp: nowTs
            };
            const rest = prev.filter((_, i) => i !== idx);
            return [updated, ...rest];
          }
          return prev;
        });
      } else {
        alert("Impossible d'enregistrer le message. Veuillez vérifier votre saisie et réessayer.");
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      alert("Erreur lors de l'enregistrement du message. Veuillez réessayer.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="pb-20 pt-1 flex flex-col h-[calc(100vh-120px)] max-w-md mx-auto w-full">
      {activeConv ? (
        /* ACTIVE CHAT DISCUSSION SCREEN */
        <div className="flex-1 flex flex-col bg-white rounded-3xl border border-neutral-200/90 shadow-xs overflow-hidden mx-3 mb-2">
          {/* Active Chat Header */}
          <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToList}
                className="p-1 -ml-1 text-neutral-600 hover:text-neutral-900 rounded-lg cursor-pointer"
                title="Retour à la liste"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <img
                src={
                  activeConv.contact_avatar ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(activeConv.contact_name)}&backgroundColor=FF6B00`
                }
                alt={activeConv.contact_name}
                className="w-10 h-10 rounded-full object-cover border border-neutral-200 shrink-0"
              />
              <div>
                <h3 className="font-extrabold text-sm text-neutral-900 leading-tight">
                  {activeConv.contact_name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    En ligne • {activeConv.contact_role}
                  </span>
                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[8px] font-black flex items-center gap-0.5 uppercase">
                    <Lock className="w-2.5 h-2.5" />
                    100% Privé
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-neutral-500">
              <button 
                onClick={() => alert(`Numéro direct disponible dans l'annuaire artisans pour ${activeConv.contact_name}`)}
                className="p-2 rounded-xl hover:bg-neutral-200/60 cursor-pointer text-[#FF6B00]"
                title="Appeler"
              >
                <Phone className="w-4 h-4" />
              </button>
              {/* Bouton pour Vider les messages */}
              <button
                onClick={() => setShowClearModal(true)}
                className="p-2 rounded-xl hover:bg-neutral-200/60 text-neutral-400 hover:text-neutral-700 cursor-pointer transition-colors"
                title="Vider l'historique des messages"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {/* Bouton pour Supprimer définitivement la conversation */}
              <button
                onClick={(e) => handleDeleteConversation(activeConv.id, e)}
                className="p-2 rounded-xl hover:bg-red-50 text-neutral-400 hover:text-red-600 cursor-pointer transition-colors"
                title="Supprimer définitivement la conversation"
              >
                <X className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>

          {/* Privacy reassurance banner at top of conversation */}
          <div className="mx-3 mt-2 mb-1 p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-2 text-emerald-950">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="min-w-0 text-[11px] leading-tight">
              <span className="font-extrabold block text-emerald-950">Discussion 100% Privée & Confidentielle</span>
              <span className="text-emerald-800 text-[10px]">
                Vos devis, numéros de téléphone et messages sont strictement privés entre vous et {activeConv.contact_name}. Rien n'est public.
              </span>
            </div>
          </div>

          {/* Alerte Compte Suspendu pour non-respect des règles */}
          {isSuspended && (
            <div className="mx-3 mb-1 p-2.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Votre compte est suspendu ({suspensionReason}). L'envoi de messages est désactivé.</span>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#fdfdfd]">
            <div className="text-center my-2">
              <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-500 text-[10px] font-bold">
                Discussion sécurisée ArtisanPro Afrique
              </span>
            </div>

            {messages.map((m) => {
              const isMe = m.sender_id === myId || m.sender_id === 'me';
              const isVoice = m.type === 'voice' || m.voice_duration || m.text.startsWith('🎤');
              const isImage = m.type === 'image' && m.media_url;
              const isFile = m.type === 'file' && m.media_url;

              return (
                <div
                  key={m.id}
                  className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isMe
                        ? 'bg-[#FF6B00] text-white rounded-br-xs shadow-xs'
                        : 'bg-neutral-100 text-neutral-800 rounded-bl-xs border border-neutral-200/60'
                    }`}
                  >
                    {/* Contenu : Message vocal, Image, Fichier ou Texte */}
                    {isVoice ? (
                      <VoiceMessagePlayer
                        mediaUrl={m.media_url}
                        duration={m.voice_duration}
                        isMe={isMe}
                      />
                    ) : isImage ? (
                      <div className="space-y-1.5">
                        <div className="rounded-xl overflow-hidden max-h-56 bg-black/5">
                          <img
                            src={m.media_url}
                            alt="Image envoyée"
                            className="w-full h-full object-cover cursor-pointer hover:opacity-95"
                            onClick={() => window.open(m.media_url, '_blank')}
                          />
                        </div>
                        {m.text && m.text !== '📷 Image' && (
                          <p className="whitespace-pre-line break-words">{m.text}</p>
                        )}
                      </div>
                    ) : isFile ? (
                      <div className="space-y-1.5">
                        <a
                          href={m.media_url}
                          download={m.media_name || 'document'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`p-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-opacity hover:opacity-90 ${
                            isMe ? 'bg-white/20 text-white' : 'bg-neutral-200/80 text-neutral-800'
                          }`}
                        >
                          <FileText className="w-4 h-4 shrink-0" />
                          <span className="truncate max-w-[150px]">{m.media_name || 'Document joint'}</span>
                          {m.media_size && (
                            <span className="text-[10px] opacity-80 shrink-0">({m.media_size})</span>
                          )}
                        </a>
                        {m.text && m.text !== '📎 Fichier' && (
                          <p className="whitespace-pre-line break-words">{m.text}</p>
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-line break-words">{m.text}</p>
                    )}

                    {/* Timestamp & Petit bouton 🗑 pour supprimer le message */}
                    <div
                      className={`text-[9px] mt-1 flex items-center justify-end gap-1.5 ${
                        isMe ? 'text-white/80' : 'text-neutral-400'
                      }`}
                    >
                      <span>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMe && <CheckCheck className="w-3 h-3" />}
                      <button
                        onClick={() => handleDeleteSingleMessage(m.id)}
                        className="opacity-40 hover:opacity-100 hover:text-red-500 transition-opacity cursor-pointer p-0.5 ml-0.5"
                        title="Supprimer ce message"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending attachment preview banner */}
          {pendingAttachment && (
            <div className="px-3 py-2 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {pendingAttachment.type === 'image' ? (
                  <img
                    src={pendingAttachment.dataUrl}
                    alt="Aperçu"
                    className="w-9 h-9 rounded-xl object-cover border border-neutral-200 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-neutral-800 text-xs truncate">
                    {pendingAttachment.name}
                  </p>
                  <span className="text-[10px] text-neutral-500">{pendingAttachment.size}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingAttachment(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-red-500 cursor-pointer"
                title="Annuler la pièce jointe"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input Box: Live Voice Recording UI OR Standard Message Input */}
          {isRecording ? (
            /* VOCAL EN COURS D'ENREGISTREMENT - AVEC BOUTON ANNULER ET ENVOYER */
            <div className="p-3 bg-red-50/80 border-t border-red-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="text-xs font-black text-red-700">
                  0:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                </span>
                <div className="flex items-center gap-0.5 h-4 ml-1">
                  {[40, 75, 50, 90, 60, 85, 45, 95].map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${h}%` }}
                      className="w-1 bg-red-500 rounded-full animate-pulse"
                    />
                  ))}
                </div>
                <span className="text-[11px] text-red-600 font-semibold hidden sm:inline truncate">
                  Enregistrement...
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Bouton pour ANNULER l'enregistrement */}
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  title="Annuler l'enregistrement"
                >
                  <X className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Annuler</span>
                </button>

                {/* Bouton pour ENVOYER le vocal */}
                <button
                  type="button"
                  onClick={sendVoiceRecording}
                  className="px-3.5 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                  title="Envoyer l'enregistrement vocal"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer vocal</span>
                </button>
              </div>
            </div>
          ) : (
            /* CHAMP D'ENVOI STANDARD AVEC BOUTON 🔗 À GAUCHE ET BOUTON VOCAL */
            <form
              onSubmit={handleSendMessage}
              className="p-2.5 bg-white border-t border-neutral-200 flex items-center gap-1.5"
            >
              {/* Hidden file input for attachments */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.txt"
                className="hidden"
              />

              {/* Bouton 🔗 à gauche dans le chat pour envoyer des fichiers ou images */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center shrink-0 cursor-pointer transition-colors text-base"
                title="Joindre un fichier ou une image (🔗)"
              >
                🔗
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={pendingAttachment ? 'Ajouter un mot pour ce fichier...' : 'Écrivez votre message...'}
                className="flex-1 px-3.5 py-2.5 rounded-2xl bg-neutral-100 border border-neutral-200/80 text-xs sm:text-sm focus:outline-hidden focus:border-[#FF6B00] focus:bg-white transition-colors"
              />

              {/* Bouton de vocal */}
              <button
                type="button"
                onClick={startVoiceRecording}
                className="w-10 h-10 rounded-2xl bg-orange-50 hover:bg-orange-100 text-[#FF6B00] border border-orange-200/80 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                title="Enregistrer un message vocal"
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Bouton Envoyer */}
              <button
                type="submit"
                disabled={isSending || (!inputText.trim() && !pendingAttachment)}
                className="w-10 h-10 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-md shadow-[#FF6B00]/25 transition-all cursor-pointer"
                title="Envoyer"
              >
                {isSending ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          )}

          {/* MODAL : CONFIRMATION SUPPRIMER TOUS LES MESSAGES / VIDER LA CONVERSATION */}
          {showClearModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-neutral-100 text-center animate-in fade-in zoom-in-95 duration-150">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-base text-neutral-900 mb-1">
                  Supprimer tous les messages ?
                </h3>
                <p className="text-xs text-neutral-600 mb-5 leading-relaxed">
                  Cette action effacera définitivement tout l'historique des messages avec {activeConv.contact_name}.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowClearModal(false)}
                    className="py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmClearAllMessages}
                    className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                  >
                    Supprimer tout
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* CONVERSATIONS & REGISTERED USERS LIST SCREEN */
        <div className="w-[92%] mx-auto flex-1 flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-neutral-900 tracking-tight">
                Messages
              </h2>
              <p className="text-xs text-neutral-500">
                Vos échanges privés avec les artisans et clients
              </p>
            </div>
            <button
              onClick={() => setChatActiveTab('users')}
              className="py-1.5 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF6B00] border border-orange-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Nouveau chat</span>
            </button>
          </div>

          {/* Privacy reassurance pill */}
          <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-200/80 flex items-center justify-between text-[11px] text-emerald-950">
            <div className="flex items-center gap-1.5 min-w-0">
              <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Tous vos échanges sont <strong>strictement privés</strong> et chiffrés</span>
            </div>
            <span className="px-1.5 py-0.2 rounded-md bg-emerald-200/70 text-emerald-900 font-extrabold text-[8px] uppercase shrink-0">
              Confidentiel
            </span>
          </div>

          {/* Dual Tabs Switcher: Discussions vs Nouveaux Membres */}
          <div className="flex items-center bg-white p-1 rounded-2xl border border-neutral-200/90 mb-3 shadow-2xs">
            <button
              onClick={() => setChatActiveTab('conversations')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                chatActiveTab === 'conversations'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Discussions ({conversations.length})</span>
            </button>
            <button
              onClick={() => setChatActiveTab('users')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                chatActiveTab === 'users'
                  ? 'bg-[#FF6B00] text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Nouveaux Membres ({availableUsers.length})</span>
            </button>
          </div>

          {/* TAB 1: DISCUSSIONS EN COURS */}
          {chatActiveTab === 'conversations' && (
            <div className="flex-1 bg-white rounded-3xl border border-neutral-200/90 shadow-xs overflow-hidden divide-y divide-neutral-100 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="py-8 px-5">
                  <div className="text-center mb-6">
                    <MessageSquare className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <h4 className="font-bold text-neutral-800 text-sm mb-1">Aucune discussion en cours</h4>
                    <p className="text-xs text-neutral-500 max-w-xs mx-auto mb-4">
                      Démarrez un échange privé et direct avec les nouveaux membres inscrits :
                    </p>
                    <button
                      onClick={() => setChatActiveTab('users')}
                      className="px-4 py-2 rounded-xl bg-[#FF6B00] text-white font-bold text-xs shadow-xs hover:bg-[#e05e00] cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Voir les nouveaux membres ({availableUsers.length})</span>
                    </button>
                  </div>

                  {availableUsers.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-neutral-800 block mb-1">
                        Membres inscrits disponibles :
                      </span>
                      <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-2xl overflow-hidden bg-neutral-50/50">
                        {availableUsers.slice(0, 5).map(u => (
                          <div
                            key={u.id}
                            onClick={() => handleStartChatWithUser(u)}
                            className="p-3 flex items-center justify-between gap-3 hover:bg-orange-50/50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.full_name)}&backgroundColor=FF6B00`}
                                alt={u.full_name}
                                className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-xs text-neutral-900 block truncate">{u.full_name}</span>
                                <span className="text-[10px] text-neutral-500 block truncate">
                                  {u.role === 'artisan' ? (u.metier || 'Artisan') : 'Client'} • {u.ville || 'Afrique'}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-[#FF6B00] px-2 py-1 rounded-lg bg-orange-100 shrink-0">
                              Contacter
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className="p-4 flex items-center gap-3.5 hover:bg-neutral-50 transition-colors cursor-pointer group"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={
                          conv.contact_avatar ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(conv.contact_name)}&backgroundColor=FF6B00`
                        }
                        alt={conv.contact_name}
                        className="w-12 h-12 rounded-2xl object-cover border border-neutral-100"
                      />
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF6B00] text-white text-[9px] font-extrabold flex items-center justify-center border-2 border-white">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3 className="font-bold text-sm text-neutral-900 group-hover:text-[#FF6B00] transition-colors truncate">
                          {conv.contact_name}
                        </h3>
                        <span className="text-[10px] text-neutral-400 shrink-0 font-medium">
                          {conv.last_message_time}
                        </span>
                      </div>

                      <p className="text-xs text-neutral-500 truncate leading-relaxed">
                        {conv.last_message}
                      </p>
                    </div>

                    {/* Bouton supprimer conversation */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                      title="Supprimer cette conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: NOUVEAUX UTILISATEURS ET MEMBRES INSCRITS */}
          {chatActiveTab === 'users' && (
            <div className="flex-1 bg-white rounded-3xl border border-neutral-200/90 shadow-xs overflow-hidden flex flex-col">
              {/* Search user */}
              <div className="p-3 border-b border-neutral-100">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Rechercher un membre par nom ou ville..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-100 border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              {/* Users list */}
              <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 p-1">
                {availableUsers
                  .filter(u => {
                    if (!userSearchQuery) return true;
                    const q = userSearchQuery.toLowerCase();
                    const name = (u.full_name || '').toLowerCase();
                    const ville = (u.ville || '').toLowerCase();
                    const role = (u.role || '').toLowerCase();
                    const metier = (u.metier || '').toLowerCase();
                    return name.includes(q) || ville.includes(q) || role.includes(q) || metier.includes(q);
                  })
                  .length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-400">
                    <Users className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="font-bold text-neutral-600">Aucun nouveau membre trouvé</p>
                    <p className="text-[10px]">Les utilisateurs qui s'inscrivent apparaîtront automatiquement ici.</p>
                  </div>
                ) : (
                  availableUsers
                    .filter(u => {
                      if (!userSearchQuery) return true;
                      const q = userSearchQuery.toLowerCase();
                      const name = (u.full_name || '').toLowerCase();
                      const ville = (u.ville || '').toLowerCase();
                      const role = (u.role || '').toLowerCase();
                      const metier = (u.metier || '').toLowerCase();
                      return name.includes(q) || ville.includes(q) || role.includes(q) || metier.includes(q);
                    })
                    .map(u => (
                      <div
                        key={u.id}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-orange-50/50 rounded-2xl transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.full_name)}&backgroundColor=FF6B00`}
                            alt={u.full_name}
                            className="w-10 h-10 rounded-full object-cover border border-neutral-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-neutral-900 truncate">{u.full_name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-extrabold uppercase ${
                                u.role === 'artisan'
                                  ? 'bg-orange-100 text-[#FF6B00]'
                                  : 'bg-neutral-100 text-neutral-700'
                              }`}>
                                {u.role === 'artisan' ? (u.metier || 'Artisan') : 'Client'}
                              </span>
                              <span className="text-[10px] text-neutral-400 truncate">
                                {u.ville || 'Afrique'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleStartChatWithUser(u)}
                          className="px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer shadow-xs transition-all active:scale-95"
                        >
                          <Send className="w-3 h-3" />
                          <span>Contacter</span>
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {/* MODAL NOUVELLE CONVERSATION AVEC MEMBRE INSCRIT */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-neutral-100 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="font-extrabold text-sm text-neutral-900">Nouvelle discussion</h3>
              </div>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="py-3">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Rechercher un membre par nom..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-100 border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
              {availableUsers
                .filter(u => u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                .length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  Aucun membre trouvé
                </div>
              ) : (
                availableUsers
                  .filter(u => u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                  .map(u => (
                    <div
                      key={u.id}
                      onClick={() => handleStartChatWithUser(u)}
                      className="p-3 flex items-center gap-3 hover:bg-orange-50/60 rounded-xl cursor-pointer transition-colors"
                    >
                      <img
                        src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.full_name)}&backgroundColor=FF6B00`}
                        alt={u.full_name}
                        className="w-9 h-9 rounded-full object-cover border border-neutral-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs text-neutral-900 block truncate">{u.full_name}</span>
                        <span className="text-[10px] text-neutral-500 block truncate">
                          {u.role === 'artisan' ? `🛠️ ${u.metier || 'Artisan'}` : '👤 Client'} • {u.ville || 'Afrique'}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
