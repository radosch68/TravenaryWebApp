import {
  BedDouble,
  Car,
  Footprints,
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
  carRental: Car,
  custom: Sparkles,
  food: UtensilsCrossed,
  divider: Sparkles,
  shopping: ShoppingBag,
  tour: Footprints,
}
