import { FoodPlace, BudgetTier, FoodCategory } from '../types/food';
import { Coordinates } from '../data/kolkataCrossings';
import { calculateHaversineDistance } from './pedestrianRouter';
import { Pandal } from '../types/pandal';

export interface FoodWithDistance extends FoodPlace {
  distanceMeters: number;
  walkingMinutes: number;
  formattedDistance: string;
}

/**
 * Format meters into human-readable pedestrian distance and walking time
 */
export const formatPedestrianDistance = (meters: number): { distanceStr: string; walkTimeStr: string } => {
  const walkingMinutes = Math.max(1, Math.round(meters / 80)); // ~4.8 km/h walking speed
  if (meters < 1000) {
    return {
      distanceStr: `${meters} m`,
      walkTimeStr: `${walkingMinutes}m walk`,
    };
  }
  const km = (meters / 1000).toFixed(1);
  return {
    distanceStr: `${km} km`,
    walkTimeStr: `${walkingMinutes}m walk`,
  };
};

/**
 * Get Google Maps / Apple Maps walking navigation link
 */
export const getFoodNavigationUrl = (food: FoodPlace): string => {
  const isApple =
    typeof navigator !== 'undefined' &&
    /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  if (isApple) {
    return `maps://maps.apple.com/?daddr=${food.latitude},${food.longitude}&dirflg=w`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${food.latitude},${food.longitude}&travelmode=walking`;
};

/**
 * Generate share message for WhatsApp
 */
export const generateFoodShareText = (food: FoodPlace, distanceStr?: string): string => {
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${food.latitude},${food.longitude}&travelmode=walking`;
  const distInfo = distanceStr ? ` (${distanceStr} away)` : '';

  return `🍽️ *${food.name}* (${food.name_bn})
🏷️ *Budget:* ${food.cost_for_two} (${food.budget_tier.toUpperCase()})
⭐ *Rating:* ${food.rating} ★ (${food.review_count} reviews)
🍜 *Famous Dishes:* ${food.famous_dishes.join(', ')}
📍 *Address:* ${food.address} [${food.landmark}]${distInfo}
🚇 *Nearest Metro:* ${food.nearest_metro} (${food.metro_walk_mins}m walk)
🌙 *Pujo Hours:* ${food.pujo_timing}
🗺️ *Walk Navigation:* ${navUrl}

Discover top pandal-hopping food spots on *PujoNavigate*!`;
};

/**
 * Find nearby food places given a coordinate, sorted by proximity
 */
export const getFoodPlacesWithDistance = (
  foodPlaces: FoodPlace[],
  anchorCoords: Coordinates
): FoodWithDistance[] => {
  return foodPlaces
    .map((food) => {
      const distanceMeters = calculateHaversineDistance(anchorCoords, {
        latitude: food.latitude,
        longitude: food.longitude,
      });
      const { distanceStr, walkTimeStr } = formatPedestrianDistance(distanceMeters);
      const walkingMinutes = Math.max(1, Math.round(distanceMeters / 80));

      return {
        ...food,
        distanceMeters,
        walkingMinutes,
        formattedDistance: `${distanceStr} • ${walkTimeStr}`,
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
};

/**
 * Get the closest food places to a specific pandal (default top 3)
 */
export const getNearbyFoodForPandal = (
  pandal: Pandal,
  allFood: FoodPlace[],
  limit = 3
): FoodWithDistance[] => {
  const lat = pandal.entry_lat ?? pandal.latitude ?? 22.5726;
  const lng = pandal.entry_lng ?? pandal.longitude ?? 88.3639;

  return getFoodPlacesWithDistance(allFood, { latitude: lat, longitude: lng }).slice(0, limit);
};

/**
 * Filter food places by budget, category, search query, veg, late night
 */
export const filterFoodPlaces = (
  items: FoodWithDistance[],
  options: {
    budgetTier?: BudgetTier | 'all';
    category?: FoodCategory | 'all';
    searchQuery?: string;
    pureVegOnly?: boolean;
    lateNightOnly?: boolean;
    region?: string;
  }
): FoodWithDistance[] => {
  const {
    budgetTier = 'all',
    category = 'all',
    searchQuery = '',
    pureVegOnly = false,
    lateNightOnly = false,
    region = 'All',
  } = options;

  const normalizedQuery = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    // Budget filter
    if (budgetTier !== 'all' && item.budget_tier !== budgetTier) {
      return false;
    }

    // Category filter
    if (category !== 'all' && item.category !== category) {
      return false;
    }

    // Pure veg filter
    if (pureVegOnly && !item.is_pure_veg) {
      return false;
    }

    // Late night filter
    if (lateNightOnly && !item.is_late_night) {
      return false;
    }

    // Region filter
    if (region && region !== 'All') {
      if (region === 'Central' && item.region !== 'Central' && item.region !== 'Howrah') return false;
      if (region !== 'Central' && item.region !== region) return false;
    }

    // Search query (name, bengali, famous dishes, address, cuisine)
    if (normalizedQuery) {
      const matchName = item.name.toLowerCase().includes(normalizedQuery);
      const matchNameBn = item.name_bn.includes(normalizedQuery);
      const matchCuisine = item.cuisine.toLowerCase().includes(normalizedQuery);
      const matchDishes = item.famous_dishes.some((d) => d.toLowerCase().includes(normalizedQuery));
      const matchAddress = item.address.toLowerCase().includes(normalizedQuery);
      const matchLandmark = item.landmark.toLowerCase().includes(normalizedQuery);
      const matchMetro = item.nearest_metro.toLowerCase().includes(normalizedQuery);

      if (
        !matchName &&
        !matchNameBn &&
        !matchCuisine &&
        !matchDishes &&
        !matchAddress &&
        !matchLandmark &&
        !matchMetro
      ) {
        return false;
      }
    }

    return true;
  });
};
