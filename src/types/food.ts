export type BudgetTier = 'budget' | 'moderate' | 'premium';

export type FoodCategory =
  | 'Street Food & Rolls'
  | 'Biryani & Mughlai'
  | 'Authentic Bengali'
  | 'Heritage Cabin & Cafe'
  | 'Chinese & Tangra'
  | 'Sweets & Desserts';

export interface FoodPlace {
  id: string;
  name: string;
  name_bn: string;
  category: FoodCategory;
  budget_tier: BudgetTier;
  cost_for_two: string;
  approx_cost_per_person: number;
  cuisine: string;
  famous_dishes: string[];
  address: string;
  landmark: string;
  region: 'South' | 'North' | 'Central' | 'East' | 'Howrah';
  latitude: number;
  longitude: number;
  nearest_metro: string;
  metro_walk_mins: number;
  rating: number;
  review_count: string;
  pujo_timing: string;
  is_pure_veg: boolean;
  is_late_night: boolean;
  phone?: string;
  pandal_clusters?: string[];
  tags: string[];
}

export type FoodBudgetFilter = 'all' | 'budget' | 'moderate' | 'premium';
