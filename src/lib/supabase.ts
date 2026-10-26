import { createClient } from '@supabase/supabase-js';
import { safeSupabaseStorage } from './supabaseStorage';

export const SUPABASE_URL = 
  import.meta.env.VITE_SUPABASE_URL || 'https://bdsllohfaslkkupwsvyi.supabase.co';

export const SUPABASE_ANON_KEY = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5ZZiR7VTlZN16JTonMTQDA_ei7saoDO';

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
