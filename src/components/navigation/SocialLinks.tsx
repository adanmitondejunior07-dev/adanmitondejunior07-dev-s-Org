import React from 'react';
import { MessageCircle, Instagram, Facebook, ExternalLink } from 'lucide-react';

export interface SocialLinkItem {
  id: string;
  name: string;
  shortName: string;
  badge: string;
  badgeColor: string;
  description: string;
  url: string;
  iconBg: string;
  hoverBorder: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const OFFICIAL_SOCIAL_LINKS: SocialLinkItem[] = [
  {
    id: 'whatsapp_group',
    name: 'Groupe WhatsApp',
    shortName: 'Groupe',
    badge: 'Échanges',
    badgeColor: 'bg-emerald-100 text-emerald-800',
    description: 'Discussions & entraide entre artisans et clients',
    url: 'https://chat.whatsapp.com/FAgbHy1mhBfDBTNyDWpmbF?s=cl&p=a&mlu=4&ilr=4',
    iconBg: 'bg-emerald-500 text-white',
    hoverBorder: 'hover:border-emerald-500 hover:bg-emerald-50/40',
    icon: MessageCircle
  },
  {
    id: 'instagram',
    name: 'Instagram Officiel',
    shortName: 'Instagram',
    badge: '@artisanproafrica',
    badgeColor: 'bg-pink-100 text-pink-800',
    description: 'Photos, réalisations & vidéos des artisans',
    url: 'https://www.instagram.com/artisanproafrica?psln=am5saWo5cWtsemV0',
    iconBg: 'bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 text-white',
    hoverBorder: 'hover:border-pink-500 hover:bg-pink-50/40',
    icon: Instagram
  },
  {
    id: 'facebook',
    name: 'Page Facebook',
    shortName: 'Facebook',
    badge: 'Page Pro',
    badgeColor: 'bg-blue-100 text-blue-800',
    description: 'Actualités & communauté ArtisanPro',
    url: 'https://www.facebook.com/share/1Do1EVpBRV/',
    iconBg: 'bg-blue-600 text-white',
    hoverBorder: 'hover:border-blue-500 hover:bg-blue-50/40',
    icon: Facebook
  },
  {
    id: 'whatsapp_channel',
    name: 'Chaîne WhatsApp',
    shortName: 'Canal',
    badge: 'Direct',
    badgeColor: 'bg-emerald-100 text-emerald-800',
    description: 'Nouveautés, offres & informations en direct',
    url: 'https://whatsapp.com/channel/0029Vb8wnie5q08byTIETx2c',
    iconBg: 'bg-emerald-600 text-white',
    hoverBorder: 'hover:border-emerald-600 hover:bg-emerald-50/40',
    icon: MessageCircle
  }
];

interface SocialBarProps {
  variant?: 'icons-only' | 'cards' | 'grid';
  className?: string;
}

export const SocialMediaBar: React.FC<SocialBarProps> = ({
  variant = 'icons-only',
  className = ''
}) => {
  if (variant === 'icons-only') {
    return (
      <div className={`flex items-center justify-between gap-2 ${className}`}>
        {OFFICIAL_SOCIAL_LINKS.map(link => {
          const Icon = link.icon;
          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${link.name} - ${link.description}`}
              aria-label={link.name}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 ${link.iconBg}`}
            >
              <Icon className="w-4 h-4" />
            </a>
          );
        })}
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className={`grid grid-cols-2 gap-2 ${className}`}>
        {OFFICIAL_SOCIAL_LINKS.map(link => {
          const Icon = link.icon;
          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2.5 rounded-xl border border-neutral-200/90 bg-white transition-all shadow-2xs flex items-center gap-2 group cursor-pointer ${link.hoverBorder}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${link.iconBg}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-[11px] text-neutral-900 group-hover:text-[#FF6B00] transition-colors block truncate">
                  {link.shortName}
                </span>
                <span className="text-[9px] text-neutral-400 block truncate">
                  {link.badge}
                </span>
              </div>
              <ExternalLink className="w-3 h-3 text-neutral-300 group-hover:text-[#FF6B00] shrink-0" />
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {OFFICIAL_SOCIAL_LINKS.map(link => {
        const Icon = link.icon;
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`block p-2.5 rounded-xl border border-neutral-200/90 bg-white hover:bg-neutral-50/80 transition-all shadow-2xs group cursor-pointer ${link.hoverBorder}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${link.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-neutral-900 group-hover:text-[#FF6B00] transition-colors">
                      {link.name}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded-md text-[8px] font-extrabold uppercase ${link.badgeColor}`}>
                      {link.badge}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-500 block truncate mt-0.5">
                    {link.description}
                  </span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-[#FF6B00] shrink-0 ml-1" />
            </div>
          </a>
        );
      })}
    </div>
  );
};
