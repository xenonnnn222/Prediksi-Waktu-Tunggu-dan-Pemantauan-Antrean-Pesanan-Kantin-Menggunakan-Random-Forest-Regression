// Merender ikon makanan Microsoft Fluent Emoji secara 100% offline.
import { Icon } from '@iconify/react';
import { FOOD_ICONS } from '../foodIcons.js';

export default function FoodIcon({ name = 'bento-box', size = 32, className = '' }) {
  const iconData = FOOD_ICONS[name] || FOOD_ICONS['bento-box'];
  return (
    <Icon
      icon={iconData}
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    />
  );
}
