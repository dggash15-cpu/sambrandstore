interface BrandLogoProps {
  variant?: 'dark' | 'light';
  showWordmark?: boolean;
  logoUrl?: string;
  storeName?: string;
}

export function BrandLogo({
  variant = 'dark',
  showWordmark = false,
  logoUrl,
  storeName,
}: BrandLogoProps) {
  const isLight = variant === 'light';

  if (logoUrl) {
    return (
      <span className="inline-flex items-center gap-2.5 select-none">
        <img
          src={logoUrl}
          alt={storeName || 'Store Logo'}
          className="h-8 max-h-9 w-auto max-w-[150px] object-contain shrink-0"
        />
        {showWordmark && (
          <span
            className={`font-display text-base font-bold tracking-tight whitespace-nowrap ${
              isLight ? 'text-white' : 'text-[#0F1B2D]'
            }`}
          >
            {storeName || 'Sam Brand Store'}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        width="38"
        height="34"
        viewBox="0 0 38 34"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="sbsLogoGrad" x1="0" y1="0" x2="38" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1180E1" />
            <stop offset="100%" stopColor="#3C9BF0" />
          </linearGradient>
        </defs>
        <path
          d="M5 1.5H33C35.2 1.5 36.5 3 36.5 5.2L34.2 28.8C34 31 32.5 32.5 30.3 32.5H7.7C5.5 32.5 4 31 3.8 28.8L1.5 5.2C1.5 3 2.8 1.5 5 1.5Z"
          fill={isLight ? '#FFFFFF' : '#0F1B2D'}
          stroke="url(#sbsLogoGrad)"
          strokeWidth="1.6"
        />
        <path
          d="M4 7.5H34"
          stroke="#1180E1"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        <text
          x="19"
          y="22.5"
          textAnchor="middle"
          fill={isLight ? '#0F1B2D' : '#FFFFFF'}
          fontFamily="Outfit, system-ui, sans-serif"
          fontWeight="800"
          fontSize="12.5"
          letterSpacing="0.06em"
        >
          SBS
        </text>
      </svg>

      {showWordmark && (
        <span
          className={`font-display text-base font-bold tracking-tight whitespace-nowrap ${
            isLight ? 'text-white' : 'text-[#0F1B2D]'
          }`}
        >
          Sam Brand Store
        </span>
      )}
    </span>
  );
}
