import type { ReactElement } from 'react'
import {
  AirplaneTilt,
  Bed,
  Bus,
  Car,
  ForkKnife,
  MapPin,
  Minus,
  NotePencil,
  Star,
} from '@phosphor-icons/react'

import type { ActivityType } from '@/services/contracts'

export const ACTIVITY_TYPE_ICON: Record<ActivityType, ReactElement> = {
  flight: <AirplaneTilt size={18} />,
  accommodation: <Bed size={18} />,
  transfer: <Bus size={18} />,
  poi: <MapPin size={18} />,
  carRental: <Car size={18} />,
  food: <ForkKnife size={18} />,
  note: <NotePencil size={18} />,
  custom: <Star size={18} />,
  divider: <Minus size={18} />,
}

export const ACTIVITY_TYPE_COLOR: Record<ActivityType, { bg: string; icon: string }> = {
  note: { bg: 'transparent', icon: '#8a7a68' },
  poi: { bg: 'rgba(34,139,34,0.03)', icon: '#228b22' },
  flight: { bg: 'rgba(218,165,32,0.03)', icon: '#b8860b' },
  accommodation: { bg: 'rgba(138,43,226,0.03)', icon: '#7b2d8e' },
  transfer: { bg: 'rgba(30,144,255,0.03)', icon: '#1a7fd4' },
  carRental: { bg: 'rgba(139,69,19,0.03)', icon: '#8b4513' },
  food: { bg: 'rgba(220,20,60,0.03)', icon: '#c62828' },
  custom: { bg: 'rgba(255,140,0,0.03)', icon: '#d2691e' },
  divider: { bg: 'transparent', icon: '#8a7a68' },
}