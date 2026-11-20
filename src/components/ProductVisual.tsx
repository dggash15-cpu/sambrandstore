import { useState } from 'react';

interface ProductVisualProps {
  visualKey: string;
  imageUrl?: string | null;
  alt: string;
  className?: string;
  darkSurface?: boolean;
}

const REAL_IMAGE_FALLBACKS: Record<string, string> = {
  'console-pro': '/src/assets/images/console_ps5_pro.jpg',
  'oled-monitor': '/src/assets/images/asus_curved_monitor.jpg',
  'ultrawide-monitor': '/src/assets/images/ultrawide_curved_pro.jpg',
  'wireless-headset': '/src/assets/images/headset_pro.jpg',
  'headset-anc': '/src/assets/images/headset_pro.jpg',
  'mechanical-keyboard': '/src/assets/images/keyboard_cnc.jpg',
  'esports-mouse': '/src/assets/images/mouse_wireless_pro.jpg',
  'mouse-carbon': '/src/assets/images/mouse_wireless_pro.jpg',
  'handheld-console': '/src/assets/images/handheld_oled_pro.jpg',
  'handheld-oled': '/src/assets/images/handheld_oled_pro.jpg',
  'pro-controller': '/src/assets/images/controller_dualsense_pro.jpg',
  'xbox-console': '/src/assets/images/xbox_galaxy_pro.jpg',
  'thunderbolt-dock': '/src/assets/images/dock_tb4.jpg',
  'studio-mic': '/src/assets/images/mic_studio.jpg',
  'macro-deck': '/src/assets/images/macro_deck.jpg',
};

export function ProductVisual({
  visualKey,
  imageUrl,
  alt,
  className = '',
  darkSurface = false,
}: ProductVisualProps) {
  const [primaryFailed, setPrimaryFailed] = useState(false);

  const fallbackSrc =
    REAL_IMAGE_FALLBACKS[visualKey] || '/src/assets/images/hero_esports_desk.jpg';
  const resolvedSrc = !primaryFailed && imageUrl ? imageUrl : fallbackSrc;

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${
        darkSurface ? 'bg-[#0F1B2D]' : 'bg-[#F7FAFD]'
      } ${className}`}
    >
      <img
        src={resolvedSrc}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          if (!primaryFailed) setPrimaryFailed(true);
        }}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
