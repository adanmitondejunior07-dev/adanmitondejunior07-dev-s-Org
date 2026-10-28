import { createClient } from '@supabase/supabase-js';
import { safeSupabaseStorage } from './supabaseStorage';

const cleanEnv = (val: string | undefined, defaultVal: string): string => {
  const raw = val || defaultVal;
  return raw
    .replace(/[\r\n\t]/g, '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .trim()
    .replace(/\/+$/, '');
};

export const SUPABASE_URL = cleanEnv(
  import.meta.env.VITE_SUPABASE_URL,
  'https://bdsllohfaslkkupwsvyi.supabase.co'
);

export const SUPABASE_ANON_KEY = cleanEnv(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  'sb_publishable_5ZZiR7VTlZN16JTonMTQDA_ei7saoDO'
);

/**
 * Formate une erreur réseau / fetch avec nom, message, cause et adresse exacte,
 * sans aucune clé API ou jeton sensible.
 */
export function formatFetchError(err: unknown, targetUrl?: string): string {
  const errorObj = err as any;
  const name = errorObj?.name || (err instanceof Error ? err.constructor.name : 'Error');
  const message = errorObj?.message || (typeof err === 'string' ? err : 'Erreur réseau inconnue');

  let causeStr: string | null = null;
  if (errorObj?.cause) {
    if (typeof errorObj.cause === 'string') {
      causeStr = errorObj.cause;
    } else if (errorObj.cause?.message) {
      causeStr = String(errorObj.cause.message);
    } else {
      try {
        causeStr = JSON.stringify(errorObj.cause);
      } catch {
        causeStr = String(errorObj.cause);
      }
    }
  }

  // Nettoyer l'URL cible de toute clé ou jeton d'authentification par sécurité absolue
  let cleanTarget = targetUrl;
  if (cleanTarget) {
    cleanTarget = cleanTarget
      .replace(/([?&])apikey=[^&]*/gi, '$1')
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer ***')
      .replace(/\?&/g, '?')
      .replace(/[?&]$/, '');
  }

  const parts: string[] = [`[${name}] ${message}`];
  if (causeStr && causeStr !== 'undefined') {
    parts.push(`Cause: ${causeStr}`);
  }
  if (cleanTarget) {
    parts.push(`Adresse: ${cleanTarget}`);
  }

  return parts.join(' | ');
}

export const ADMIN_EMAIL = 'adanmitondejunior07@gmail.com';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: safeSupabaseStorage,
  },
});

export const METIERS_LIST = [
  'Couturier',
  'Coiffeur',
  'Mécanicien',
  'Électricien',
  'Plombier',
  'Maçon',
  'Menuisier',
  'Soudeur',
  'Peintre',
  'Autre'
] as const;

export const PAYS_AFRIQUE = [
  'Côte d\'Ivoire',
  'Sénégal',
  'Bénin',
  'Togo',
  'Cameroun',
  'Mali',
  'Burkina Faso',
  'Guinée',
  'Niger',
  'Gabon',
  'Congo',
  'RD Congo'
];

export const VILLES_PAR_PAYS: Record<string, string[]> = {
  'Côte d\'Ivoire': ['Abidjan', 'Bouaké', 'Yamoussoukro', 'San-Pédro', 'Korhogo', 'Daloa'],
  'Sénégal': ['Dakar', 'Thiès', 'Saint-Louis', 'Touba', 'Ziguinchor'],
  'Bénin': ['Cotonou', 'Porto-Novo', 'Parakou', 'Abomey-Calavi', 'Ouidah'],
  'Togo': ['Lomé', 'Kara', 'Sokodé', 'Kpalimé', 'Atakpamé'],
  'Cameroun': ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Kribi'],
  'Mali': ['Bamako', 'Sikasso', 'Mopti', 'Ségou'],
  'Burkina Faso': ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou'],
  'Guinée': ['Conakry', 'Kindia', 'Labé', 'Nzérékoré'],
  'Niger': ['Niamey', 'Maradi', 'Zinder'],
  'Gabon': ['Libreville', 'Port-Gentil', 'Franceville'],
  'Congo': ['Brazzaville', 'Pointe-Noire'],
  'RD Congo': ['Kinshasa', 'Lubumbashi', 'Goma', 'Kisangani']
};
