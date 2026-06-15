import {
  BedDouble,
  Footprints,
  KeyRound,
  MapPin,
  NotebookPen,
  Plane,
  Route,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

import type { ActivityType } from '@/services/contracts'

export const ACTIVITY_TYPE_ICON: Record<ActivityType, LucideIcon> = {
  note: NotebookPen,
  flight: Plane,
  accommodation: BedDouble,
  transfer: Route,
  poi: MapPin,
  rental: KeyRound,
  custom: Sparkles,
  food: UtensilsCrossed,
  shopping: ShoppingBag,
  tour: Footprints,
}
