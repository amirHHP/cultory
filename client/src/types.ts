export type Role = "super_admin" | "municipality" | "enterprise" | "guide" | "elder";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  municipality_id?: string | null;
  municipality_name?: string;
}

export interface Tour {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  duration_min: number;
  difficulty: "easy" | "moderate" | "challenging";
  cover_emoji: string;
  rating: number;
  certified: number;
  municipality_name: string;
  country: string;
  stops?: number;
  bookings_count?: number;
  guide_name?: string;
}

export interface TourStop {
  position: number;
  title: string;
  category: string;
  place_name: string;
  lat: number;
  lng: number;
  translation_en: string;
}

export interface FootfallPoint {
  month: string;
  label: string;
  tourists: number;
  bookings: number;
  revenue_eur: number;
  platform_fee_eur: number;
}

export interface Stats {
  range: number;
  kpis: {
    stories_total: number;
    tours_total: number;
    certified_guides: number;
    tourists_30d: number;
    revenue_ytd_eur: number;
    platform_fees_eur: number;
  };
  footfall: FootfallPoint[];
  demographics: { age_group: string; value: number }[];
  topCountries: { country: string; value: number }[];
  categories: { category: string; value: number }[];
}

export interface ApiKeyRow {
  id: string;
  label: string;
  key_prefix: string;
  tier: keyof typeof TIER_LABELS | string;
  environment: string;
  status: string;
  request_count: number;
  last_used_at: string | null;
  created_at: string;
}

export interface Tier {
  id: string;
  label: string;
  price_cents: number;
  calls: number;
  features: string[];
}

export const TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
};

export const CATEGORY_LABELS: Record<string, string> = {
  oral_history: "Oral history",
  crafts_music: "Crafts & music",
  cuisine: "Cuisine",
  folklore: "Folklore",
  rituals: "Rituals",
  nature_wisdom: "Nature wisdom",
};

export const euro = (cents: number) =>
  `€${(cents / 100).toLocaleString("en-IE", { maximumFractionDigits: cents % 100 === 0 ? 0 : 2 })}`;
