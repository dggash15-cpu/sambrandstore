interface SectionDividerProps {
  variant: 'hero-to-categories' | 'categories-to-catalog' | 'catalog-to-footer';
}

export function SectionDivider({ variant }: SectionDividerProps) {
  if (variant === 'hero-to-categories') {
    return (
      <div
        aria-hidden="true"
        className="relative -mt-px overflow-hidden bg-gradient-to-b from-[#0B1524] via-[#102038] to-[#F7FAFD]"
      >
        <svg
          viewBox="0 0 1440 72"
          preserveAspectRatio="none"
          className="block h-10 w-full sm:h-14"
        >
          <defs>
            <linearGradient id="futuristicPrismHero" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1180E1" stopOpacity="0" />
              <stop offset="50%" stopColor="#3C9BF0" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#1180E1" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Futuristic angled stepped bevel */}
          <polygon points="0,12 420,44 980,18 1440,38 1440,72 0,72" fill="#132540" fillOpacity="0.45" />
          <polygon points="0,34 360,54 720,24 1100,52 1440,28 1440,72 0,72" fill="#F7FAFD" />
          <polyline
            points="0,34 360,54 720,24 1100,52 1440,28"
            fill="none"
            stroke="url(#futuristicPrismHero)"
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  }

  if (variant === 'categories-to-catalog') {
    return (
      <div
        aria-hidden="true"
        className="relative -mt-px overflow-hidden bg-gradient-to-b from-[#F7FAFD] to-white"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-6 items-center justify-center">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#CBD8EA] to-transparent" />
            <div className="absolute flex items-center gap-1.5 bg-gradient-to-r from-[#F7FAFD] via-white to-[#F7FAFD] px-3">
              <span className="h-1.5 w-6 skew-x-[-24deg] bg-[#1180E1]/75" />
              <span className="h-1.5 w-2 skew-x-[-24deg] bg-[#0F1B2D]/40" />
              <span className="h-1.5 w-6 skew-x-[-24deg] bg-[#1180E1]/75" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="relative -mb-px overflow-hidden bg-gradient-to-b from-white via-[#F1F6FC] to-[#0F1B2D]"
    >
      <svg
        viewBox="0 0 1440 64"
        preserveAspectRatio="none"
        className="block h-9 w-full sm:h-12"
      >
        <defs>
          <linearGradient id="futuristicPrismFooter" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1180E1" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#3C9BF0" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#1180E1" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <polygon points="0,18 480,48 960,16 1440,42 1440,64 0,64" fill="#162944" fillOpacity="0.32" />
        <polygon points="0,34 540,56 980,22 1440,46 1440,64 0,64" fill="#0F1B2D" />
        <polyline
          points="0,34 540,56 980,22 1440,46"
          fill="none"
          stroke="url(#futuristicPrismFooter)"
          strokeWidth="1.75"
        />
      </svg>
    </div>
  );
}
