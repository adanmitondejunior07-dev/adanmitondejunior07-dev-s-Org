import React, { useState } from 'react';
import { Search, X, Check, Wrench, Sparkles, Building, Home, Car, Scissors, Utensils, Zap } from 'lucide-react';

interface MetierSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMetiers: string[];
  onSelectMetiers: (metiers: string[]) => void;
}

export const POPULAR_METIERS = [
  'Plombier',
  'Électricien',
  'Maçon',
  'Menuisier',
  'Peintre',
  'Mécanicien',
  'Carreleur',
  'Soudeur',
  'Climaticien',
  'Coiffeur',
  'Réparateur téléphone/PC',
  'Cuisinier/Cuisinière'
];

export const CATEGORIZED_METIERS: { category: string; icon: any; list: string[] }[] = [
  {
    category: 'BTP & Habitat',
    icon: Building,
    list: [
      'Plombier',
      'Électricien',
      'Maçon',
      'Menuisier',
      'Charpentier',
      'Peintre en bâtiment',
      'Carreleur',
      'Soudeur & Ferronnier',
      'Climaticien & Frigoriste',
      'Vitrier & Miroitier',
      'Plaquiste & Staffeur',
      'Étanchéiste',
      'Pisciniste'
    ]
  },
  {
    category: 'Services Domestiques & Entretien',
    icon: Home,
    list: [
      'Ménager / Ménagère',
      'Jardinier & Paysagiste',
      'Déménageur',
      'Agent d\'entretien',
      'Gardien & Sécurité privée',
      'Désinsectiseur / Dératiseur',
      'Blanchisseur / Repasseur'
    ]
  },
  {
    category: 'Mécanique & Automobile',
    icon: Car,
    list: [
      'Mécanicien auto',
      'Mécanicien moto / engins',
      'Tôlier & Carrossier',
      'Électricien auto',
      'Vulcanisateur (Pneus)',
      'Laveur auto professionnel'
    ]
  },
  {
    category: 'Artisanat, Mode & Beauté',
    icon: Scissors,
    list: [
      'Couturier / Styliste modéliste',
      'Coiffeur / Coiffeuse',
      'Barbier homme',
      'Esthéticienne & Maquilleuse',
      'Cordonnier / Maroquinier',
      'Tapissier d\'ameublement',
      'Bijoutier / Joaillier',
      'Tisserand de pagne traditionnel'
    ]
  },
  {
    category: 'Technologie & Électronique',
    icon: Zap,
    list: [
      'Réparateur téléphone & smartphone',
      'Technicien PC / Ordinateurs',
      'Installateur antennes & Canal+',
      'Installateur caméras de surveillance',
      'Réparateur électroménager (TV, frigo)'
    ]
  },
  {
    category: 'Restauration & Événements',
    icon: Utensils,
    list: [
      'Cuisinier / Cuisinière à domicile',
      'Traiteur & Pâtissier',
      'Décorateur événementiel',
      'Photographe professionnel',
      'Vidéaste de cérémonies'
    ]
  }
];

export const MetierSelectionModal: React.FC<MetierSelectionModalProps> = ({
  isOpen,
  onClose,
  selectedMetiers,
  onSelectMetiers
}) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>(selectedMetiers || []);

  if (!isOpen) return null;

  const toggleMetier = (metier: string) => {
    if (selected.includes(metier)) {
      setSelected(selected.filter(m => m !== metier));
    } else {
      setSelected([...selected, metier]);
    }
  };

  const handleValidate = () => {
    if (selected.length === 0) return;
    onSelectMetiers(selected);
    onClose();
  };

  const searchFilter = search.trim().toLowerCase();

  // Filtered categories
  const filteredCategories = CATEGORIZED_METIERS.map(cat => ({
    ...cat,
    list: cat.list.filter(m => m.toLowerCase().includes(searchFilter))
  })).filter(cat => cat.list.length > 0);

  const filteredPopular = POPULAR_METIERS.filter(m => 
    m.toLowerCase().includes(searchFilter)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-neutral-100">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-neutral-100 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B1A] flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-lg text-neutral-900 tracking-tight">
              Quel est votre métier ?
            </h3>
          </div>
          <p className="text-xs text-neutral-500">
            Tapez ou choisissez dans la liste
          </p>

          {/* Search Input */}
          <div className="relative mt-3">
            <Search className="w-4 h-4 text-[#FF6B1A] absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[2.2px]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex: Plombier, Mécanicien, Coiffeur..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-[#F8F8F8] border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-[#FF6B1A] transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#FAFAFA]">
          {/* Selected chips banner if any */}
          {selected.length > 0 && (
            <div className="p-3 bg-orange-50/80 rounded-2xl border border-orange-200/70">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-orange-900">
                  Métier(s) sélectionné(s) ({selected.length}) :
                </span>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="text-[10px] text-[#FF6B1A] font-semibold hover:underline"
                >
                  Tout effacer
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selected.map(m => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FF6B1A] text-white text-[11px] font-bold shadow-xs"
                  >
                    <span>{m}</span>
                    <button
                      type="button"
                      onClick={() => toggleMetier(m)}
                      className="hover:opacity-75"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Section: Les plus demandés */}
          {filteredPopular.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FF6B1A]" />
                <h4 className="font-extrabold text-xs text-neutral-900 uppercase tracking-wider">
                  Les plus demandés
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {filteredPopular.map((metier) => {
                  const isSelected = selected.includes(metier);
                  return (
                    <button
                      key={metier}
                      type="button"
                      onClick={() => toggleMetier(metier)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#FF6B1A] text-white shadow-xs font-bold'
                          : 'bg-white text-neutral-700 border border-neutral-200 hover:border-[#FF6B1A]'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      <span>{metier}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Toutes les catégories */}
          <div>
            <h4 className="font-extrabold text-xs text-neutral-900 uppercase tracking-wider mb-3">
              Toutes les catégories
            </h4>
            <div className="space-y-4">
              {filteredCategories.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <div
                    key={group.category}
                    className="bg-white rounded-2xl p-3.5 border border-neutral-200/80 shadow-xs"
                  >
                    <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-neutral-100">
                      <div className="w-6 h-6 rounded-lg bg-orange-50 text-[#FF6B1A] flex items-center justify-center">
                        <GroupIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-extrabold text-xs text-neutral-800">
                        {group.category}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {group.list.map((item) => {
                        const isSelected = selected.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleMetier(item)}
                            className={`p-2 rounded-xl text-xs text-left transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-orange-50 text-[#FF6B1A] font-bold border border-orange-200'
                                : 'hover:bg-neutral-50 text-neutral-700 font-medium'
                            }`}
                          >
                            <span className="truncate pr-2">{item}</span>
                            <div className={`w-4 h-4 rounded-md flex items-center justify-center border shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-[#FF6B1A] border-[#FF6B1A] text-white'
                                : 'border-neutral-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="p-4 bg-white border-t border-neutral-100">
          {selected.length === 0 ? (
            <button
              type="button"
              disabled
              className="w-full py-3.5 rounded-2xl bg-neutral-200 text-neutral-400 font-bold text-xs uppercase tracking-wider cursor-not-allowed text-center"
            >
              Choisir au moins un métier
            </button>
          ) : (
            <button
              type="button"
              onClick={handleValidate}
              className="w-full py-3.5 rounded-2xl bg-[#FF6B1A] hover:bg-[#e05e00] text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-[#FF6B1A]/25 cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <span>Valider ({selected.length} sélectionné{selected.length > 1 ? 's' : ''})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
