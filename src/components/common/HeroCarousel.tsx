import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

const SLIDES = [
  {
    title: 'Couture & Mode Wax',
    image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=800&q=80',
    description: 'Stylistes créateurs & broderies de cérémonie'
  },
  {
    title: 'Électricité & Solaire',
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80',
    description: 'Installations fiables & énergie solaire d\'Afrique'
  },
  {
    title: 'Menuiserie & Bois Noble',
    image: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=800&q=80',
    description: 'Meubles sur mesure en essences africaines'
  }
];

export const HeroCarousel: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % SLIDES.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    /* LARGEUR ET LONGUEUR FORTEMENT RÉDUITES SELON DEMANDE UTILISATEUR */
    <div className="w-[68%] sm:w-[60%] max-w-[250px] mx-auto mb-2">
      <div className="relative rounded-xl overflow-hidden shadow-sm border border-neutral-200/80 bg-neutral-900 text-white">
        {/* Slides container - Hauteur et largeur réduites */}
        <div 
          className="flex transition-transform duration-700 ease-out h-20 sm:h-22 w-full"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((slide, i) => (
            <div key={i} className="min-w-full h-full relative shrink-0">
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/30" />
              <div className="absolute bottom-1.5 left-2.5 right-2.5 z-10">
                <span className="text-[11px] font-extrabold text-white block drop-shadow-xs truncate leading-tight">
                  {slide.title}
                </span>
                <span className="text-[9px] text-white/85 block drop-shadow-xs truncate leading-tight">
                  {slide.description}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Badge compact "Savoir-faire 100% Africain" */}
        <div className="absolute top-1.5 left-1.5 z-10">
          <div className="px-1.5 py-0.5 rounded-full bg-[#FF6B00] text-white text-[8px] font-extrabold flex items-center gap-0.5 shadow-xs uppercase tracking-wider">
            <Sparkles className="w-2 h-2" />
            <span>Artisanat</span>
          </div>
        </div>

        {/* Compact bottom indicator bar */}
        <div className="py-0.5 px-2 bg-neutral-950/90 border-t border-white/10 flex items-center justify-between text-[8px] text-neutral-300">
          <p className="truncate pr-1 font-medium text-[8px]">
            Savoir-faire Africain
          </p>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1 shrink-0">
            {SLIDES.map((_, dotIdx) => (
              <button
                key={dotIdx}
                onClick={() => setIndex(dotIdx)}
                className={`transition-all rounded-full cursor-pointer ${
                  index === dotIdx
                    ? 'w-3 h-0.5 bg-[#FF6B00]'
                    : 'w-0.5 h-0.5 bg-white/40 hover:bg-white/60'
                }`}
                title={`Slide ${dotIdx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
