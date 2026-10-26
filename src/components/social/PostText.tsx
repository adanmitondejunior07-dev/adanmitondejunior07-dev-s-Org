import React, { useState } from 'react';

export interface PostTextProps {
  content?: string | null;
  maxLength?: number;
  className?: string;
  textClassName?: string;
}

/**
 * Composant PostText pour l'affichage résilient et accessible des textes de publications.
 * - Tronque à maxLength (150 caractères par défaut) avec le bouton « Voir plus ».
 * - Affiche le texte complet au clic avec le bouton « Voir moins ▲ ».
 * - Préserve le style orange #FF6B00 de la plateforme.
 * - Tolère les valeurs vides, nulles ou non définies sans lever d'erreur.
 */
export const PostText: React.FC<PostTextProps> = ({
  content,
  maxLength = 150,
  className = '',
  textClassName = 'text-sm text-neutral-800'
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Gestion robuste des textes vides, non fournis ou de type invalide
  if (!content || typeof content !== 'string') {
    return null;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  const isLong = content.length > maxLength;
  const displayedText = isLong && !isExpanded
    ? `${content.slice(0, maxLength)}...`
    : content;

  return (
    <div className={`break-words ${className}`}>
      <span className={`whitespace-pre-line leading-relaxed ${textClassName}`}>
        {displayedText}
      </span>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          aria-expanded={isExpanded}
          className="inline-flex items-center ml-1.5 font-bold text-xs text-[#FF6B00] hover:text-[#E05E00] active:text-[#C55300] transition-colors cursor-pointer select-none focus:outline-hidden focus-visible:underline"
        >
          {isExpanded ? 'Voir moins ▲' : 'Voir plus'}
        </button>
      )}
    </div>
  );
};
