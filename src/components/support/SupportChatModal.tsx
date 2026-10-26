import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Bot, 
  Sparkles, 
  CheckCircle, 
  MessageSquare, 
  HelpCircle, 
  Phone, 
  ShieldCheck, 
  Crown, 
  Video, 
  User, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSubscriptions?: () => void;
  onOpenDirectory?: () => void;
}

interface SupportMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  actions?: {
    label: string;
    onClick: () => void;
    icon?: any;
    primary?: boolean;
  }[];
}

export const SupportChatModal: React.FC<SupportChatModalProps> = ({
  isOpen,
  onClose,
  onOpenSubscriptions,
  onOpenDirectory
}) => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: `Bonjour ${profile?.full_name || 'cher membre'} ! 👋 Je suis l'Assistant Automatique d'ArtisanPro Afrique.\n\nJe suis disponible 24h/24 pour répondre instantanément à toutes vos questions : abonnements GeniusPay, recherche d'artisans, confidentialité de vos messages, ou publication de vidéos.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputQuestion, setInputQuestion] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  // Automated FAQ Knowledge Base & Natural Language Response Engine
  const generateBotAnswer = (query: string): { text: string; actions?: any[] } => {
    const q = query.toLowerCase().trim();

    // 1. Abonnements & Prix GeniusPay
    if (q.includes('abonnement') || q.includes('prix') || q.includes('tarif') || q.includes('geniuspay') || q.includes('payer') || q.includes('paiement') || q.includes('wave') || q.includes('orange money') || q.includes('mtn') || q.includes('moov')) {
      return {
        text: `💰 **Tarifs & Abonnements GeniusPay pour Artisans :**\n\n` +
          `• **ESSENTIEL Standard** : 425 FCFA / mois (ou 4 700 FCFA / an)\n` +
          `  → Profil visible dans l'annuaire, 5 photos de réalisations, réception des contacts clients.\n\n` +
          `• **PRO Recommandé ⭐** : 900 FCFA / mois (ou 9 200 FCFA / an - Économisez 1 600F)\n` +
          `  → Tout Essentiel + Badge Pro Bleu, 20 photos, mise en avant prioritaire.\n\n` +
          `• **PREMIUM VIP 👑** : 1 200 FCFA / mois (ou 14 325 FCFA / an)\n` +
          `  → Profil #1 en tête des recherches, visibilité maximale et support VIP prioritaire.\n\n` +
          `Paiements 100% sécurisés par GeniusPay via **Wave, Orange Money, MTN Money et Moov Money**. Après paiement, envoyez votre reçu pour activation immédiate !`,
        actions: onOpenSubscriptions ? [
          {
            label: 'Voir les abonnements GeniusPay',
            onClick: () => {
              onClose();
              onOpenSubscriptions();
            },
            icon: Crown,
            primary: true
          }
        ] : undefined
      };
    }

    // 2. Pourquoi le chat est privé / confidentialité (demande utilisateur 4)
    if (q.includes('public') || q.includes('privé') || q.includes('confidentiel') || q.includes('secret') || q.includes('securite') || q.includes('sécurité') || q.includes('qui voit')) {
      return {
        text: `🔒 **Pourquoi vos échanges dans le chat sont strictement PRIVÉS :**\n\n` +
          `• Les discussions entre artisans et clients sont **100% privées et confidentielles**.\n` +
          `• **Aucun message du chat n'est public** : seuls vous et votre interlocuteur avez accès à vos échanges de devis, adresses et numéros.\n` +
          `• Seules les publications du menu « Social » sont publiques pour présenter le savoir-faire des artisans à la communauté.\n` +
          `• L'administrateur veille uniquement à la sécurité de la communauté et à la protection contre la fraude.`,
      };
    }

    // 3. Trouver un artisan
    if (q.includes('trouver') || q.includes('artisan') || q.includes('chercher') || q.includes('couturier') || q.includes('electricien') || q.includes('plombier') || q.includes('menuisier') || q.includes('mecanicien') || q.includes('ville') || q.includes('annuaire')) {
      return {
        text: `🛠️ **Comment trouver un artisan qualifié sur ArtisanPro Afrique :**\n\n` +
          `1. Rendez-vous dans l'onglet **« Artisans »** dans le menu du bas.\n` +
          `2. Filtrez par **Métier** (Couturier, Électricien, Menuisier, Plombier...) et par **Ville** (Abidjan, Bouaké, Dakar, Cotonou, Lomé...).\n` +
          `3. Consultez les avis et réalisations certifiées.\n` +
          `4. Cliquez sur **« Contacter »** pour échanger directement et gratuitement en privé avec l'artisan.`,
        actions: onOpenDirectory ? [
          {
            label: "Ouvrir l'Annuaire des Artisans",
            onClick: () => {
              onClose();
              onOpenDirectory();
            },
            icon: ShieldCheck,
            primary: true
          }
        ] : undefined
      };
    }

    // 4. Publier une vidéo ou photo (demande utilisateur 2)
    if (q.includes('video') || q.includes('vidéo') || q.includes('publier') || q.includes('poster') || q.includes('photo') || q.includes('realisation') || q.includes('réalisation')) {
      return {
        text: `🎬 **Comment publier une vidéo ou une réalisation :**\n\n` +
          `• **Publier une Vidéo :** Rendez-vous dans l'onglet « Vidéos » en bas. Cliquez sur le bouton orange **« + Publier Vidéo »** (en haut ou le bouton flottant rond). Choisissez un fichier vidéo de votre galerie ou sélectionnez un modèle atelier, ajoutez un titre et validez !\n\n` +
          `• **Publier une Photo :** Dans l'onglet « Social », cliquez sur le bouton orange **« + »** pour partager vos dernières créations avec photos, descriptions et prix.`,
      };
    }

    // 5. Badge bleu et vérification
    if (q.includes('badge') || q.includes('verif') || q.includes('vérif') || q.includes('certif') || q.includes('confiance') || q.includes('bleu')) {
      return {
        text: `⭐ **Comment obtenir le Badge Bleu Pro & Vérifié :**\n\n` +
          `1. Ouvrez le Menu latéral puis cliquez sur **« Demande de vérification de profil »**.\n` +
          `2. Fournissez vos 4 pièces justificatives : Pièce d'identité (CNI), Photo d'atelier, Registre ou diplôme, et Justificatif de localisation.\n` +
          `3. L'équipe d'administration valide votre dossier sous 24h à 48h.\n` +
          `4. Le **Badge Bleu Pro** augmente vos contacts clients de +300% !`,
      };
    }

    // 6. Contact support humain / Fondateur
    if (q.includes('humain') || q.includes('whatsapp') || q.includes('fondateur') || q.includes('numero') || q.includes('numéro') || q.includes('telephone') || q.includes('téléphone') || q.includes('junior') || q.includes('adanmitonde')) {
      return {
        text: `📞 **Contact direct avec la Direction & le Fondateur :**\n\n` +
          `• **Fondateur & Administrateur :** Adanmitonde Junior\n` +
          `• **Téléphone / WhatsApp :** +225 0503444508\n` +
          `• **Email Officiel :** adanmitondejunior07@gmail.com\n` +
          `• **Assistance Brevo & GeniusPay :** Disponible 7j/7`,
        actions: [
          {
            label: 'Écrire sur WhatsApp (+225 0503444508)',
            onClick: () => {
              window.open('https://wa.me/2250503444508?text=Bonjour%20ArtisanPro%20Afrique,%20j%27ai%20une%20question', '_blank');
            },
            icon: Phone,
            primary: true
          }
        ]
      };
    }

    // 7. Mot de passe oublié / connexion
    if (q.includes('mot de passe') || q.includes('connexion') || q.includes('compte') || q.includes('code') || q.includes('email') || q.includes('lien magique') || q.includes('otp')) {
      return {
        text: `🔐 **Assistance Connexion & Mot de Passe :**\n\n` +
          `• Si vous avez oublié votre mot de passe, cliquez sur **« Mot de passe oublié ? »** sur l'écran de connexion.\n` +
          `• Entrez votre email : vous recevrez un **code de sécurité à 8 chiffres** ou un lien magique de connexion.\n` +
          `• Saisissez le code dans les cases ou cliquez sur **« Vérifier avec le lien magique »** pour vous connecter instantanément.`,
      };
    }

    // 8. Réponse par défaut enrichie
    return {
      text: `Merci pour votre question ! 💡\n\n` +
        `Pour vous aider au mieux concernant « ${query} » :\n` +
        `• Pour les **abonnements GeniusPay** (Wave, OM, MTN) : rendez-vous dans le menu Abonnements.\n` +
        `• Pour trouver ou contacter un **artisan qualifié** : parcourez l'onglet Artisans.\n` +
        `• Pour publier une **vidéo ou une photo** : utilisez les boutons « + » dans les onglets Vidéos et Social.\n\n` +
        `Souhaitez-vous échanger directement avec un conseiller humain sur WhatsApp ?`,
      actions: [
        {
          label: 'Contacter le Support WhatsApp',
          onClick: () => {
            window.open('https://wa.me/2250503444508?text=Bonjour,%20j%27ai%20besoin%20d%27assistance%20sur%20ArtisanPro%20Afrique', '_blank');
          },
          icon: Phone,
          primary: true
        }
      ]
    };
  };

  const handleSend = (text?: string) => {
    const query = (text || inputQuestion).trim();
    if (!query) return;

    const userMsg: SupportMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuestion('');
    setIsTyping(true);

    setTimeout(() => {
      const botResponse = generateBotAnswer(query);
      const botMsg: SupportMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: botResponse.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: botResponse.actions
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 450);
  };

  const QUICK_QUESTIONS = [
    '💰 Tarifs et abonnements GeniusPay ?',
    '🔒 Pourquoi mes discussions sont privées ?',
    '🎬 Comment publier une vidéo ?',
    '🛠️ Comment trouver un artisan ?',
    '⭐ Comment obtenir le Badge Bleu ?',
    '📞 Parler au Fondateur sur WhatsApp'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-200/90 flex flex-col h-[85vh] max-h-[640px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-neutral-900 via-neutral-900 to-black text-white flex items-center justify-between shrink-0 border-b border-orange-500/30">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8C38] flex items-center justify-center text-white shadow-md shadow-[#FF6B00]/40">
                <Bot className="w-5 h-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-black animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm text-white">Support Automatique</h3>
                <span className="px-1.5 py-0.5 rounded-full bg-[#FF6B00]/30 border border-[#FF6B00]/50 text-[#FF6B00] text-[9px] font-bold">24/7</span>
              </div>
              <p className="text-[11px] text-neutral-400">Réponse instantanée à toutes vos questions</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-100 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
          {QUICK_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-orange-50 text-neutral-700 hover:text-[#FF6B00] border border-neutral-200 text-[11px] font-semibold shrink-0 cursor-pointer transition-colors shadow-2xs"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-neutral-50/40">
          {messages.map((m) => {
            const isBot = m.sender === 'bot';
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
              >
                {isBot && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8C38] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                    isBot
                      ? 'bg-white border border-neutral-200 text-neutral-900 rounded-tl-xs'
                      : 'bg-[#FF6B00] text-white rounded-tr-xs font-medium'
                  }`}
                >
                  <div className="whitespace-pre-line">
                    {m.text}
                  </div>

                  {/* Optional action buttons */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-neutral-100 space-y-1.5">
                      {m.actions.map((act, i) => {
                        const Icon = act.icon || ArrowRight;
                        return (
                          <button
                            key={i}
                            onClick={act.onClick}
                            className={`w-full py-2 px-3 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              act.primary
                                ? 'bg-[#FF6B00] text-white hover:bg-[#e05e00] shadow-xs'
                                : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{act.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <span className={`block text-[9px] mt-1 text-right ${isBot ? 'text-neutral-400' : 'text-orange-100'}`}>
                    {m.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 text-neutral-400 text-xs py-1">
              <div className="w-6 h-6 rounded-lg bg-orange-100 text-[#FF6B00] flex items-center justify-center">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00] animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00] animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00] animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-neutral-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder="Posez n'importe quelle question..."
              className="flex-1 py-2.5 px-3.5 rounded-2xl bg-neutral-100 border border-neutral-200 text-xs focus:outline-hidden focus:border-[#FF6B00] focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={!inputQuestion.trim() || isTyping}
              className="w-10 h-10 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-md shadow-[#FF6B00]/25 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
