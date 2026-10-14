export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PedestrianCrossing {
  id: string;
  name: string;
  bengaliName: string;
  type: 'subway' | 'overbridge' | 'designated_corridor';
  coordinates: Coordinates;
  // Road barrier line segment that police barricade during Puja:
  // If a straight line between two stops crosses this segment, pedestrians
  // must route via this crossing point instead of walking into barricades.
  barrierLine: [Coordinates, Coordinates];
  description: string;
  stairPenaltyMinutes: number; // Extra time for climbing overbridge or subway stairs
}

/**
 * Verified Kolkata Pedestrian Subways & Overbridges at major Puja rush junctions.
 * During Durga Puja, Kolkata Police erect barricades along these arterial avenues.
 */
export const KOLKATA_PEDESTRIAN_CROSSINGS: PedestrianCrossing[] = [
  {
    id: 'gariahat_fob',
    name: 'Gariahat Foot Overbridge',
    bengaliName: 'গড়িয়াহাট ফুট ওভারব্রিজ',
    type: 'overbridge',
    coordinates: { latitude: 22.5192, longitude: 88.3655 },
    // Rashbehari Ave crossing at Gariahat 4-point intersection
    barrierLine: [
      { latitude: 22.5190, longitude: 88.3640 },
      { latitude: 22.5194, longitude: 88.3670 },
    ],
    description: 'Use the elevated Foot Overbridge to cross Rashbehari Ave and avoid barricaded tram tracks.',
    stairPenaltyMinutes: 2,
  },
  {
    id: 'shyambazar_subway',
    name: 'Shyambazar Metro Pedestrian Subway',
    bengaliName: 'শ্যামবাজার মেট্রো সাবওয়ে',
    type: 'subway',
    coordinates: { latitude: 22.6028, longitude: 88.3710 },
    // Shyambazar 5-Point Crossing barricade corridor
    barrierLine: [
      { latitude: 22.6018, longitude: 88.3700 },
      { latitude: 22.6038, longitude: 88.3725 },
    ],
    description: 'Underground pedestrian subway connects Bhupen Bose Ave to RG Kar Rd, bypassing 5-point crowd jams.',
    stairPenaltyMinutes: 2.5,
  },
  {
    id: 'central_cr_subway',
    name: 'Central Metro CR Avenue Subway',
    bengaliName: 'সেন্ট্রাল মেট্রো সাবওয়ে',
    type: 'subway',
    coordinates: { latitude: 22.5732, longitude: 88.3626 },
    // Chittaranjan Avenue central barrier (between College Square and Central station)
    barrierLine: [
      { latitude: 22.5710, longitude: 88.3622 },
      { latitude: 22.5755, longitude: 88.3630 },
    ],
    description: 'Pass under Chittaranjan Ave via Central Metro subway gates to cross between College St and Bowbazar.',
    stairPenaltyMinutes: 1.5,
  },
  {
    id: 'kalighat_rashbehari_subway',
    name: 'Kalighat Metro Pedestrian Subway',
    bengaliName: 'কালীঘাট মেট্রো সাবওয়ে',
    type: 'subway',
    coordinates: { latitude: 22.5175, longitude: 88.3472 },
    // SP Mukherjee Rd & Rashbehari Crossing barricade
    barrierLine: [
      { latitude: 22.5160, longitude: 88.3470 },
      { latitude: 22.5190, longitude: 88.3475 },
    ],
    description: 'Underground crossing connecting Lake Market with Hazra / Kalighat Temple road.',
    stairPenaltyMinutes: 2,
  },
  {
    id: 'park_circus_corridor',
    name: 'Park Circus 7-Point Pedestrian Corridor',
    bengaliName: 'পার্ক সার্কাস পেডেস্ট্রিয়ান করিডোর',
    type: 'designated_corridor',
    coordinates: { latitude: 22.5442, longitude: 88.3670 },
    // Park Circus 7-point divider
    barrierLine: [
      { latitude: 22.5428, longitude: 88.3655 },
      { latitude: 22.5458, longitude: 88.3685 },
    ],
    description: 'Designated police barricaded pedestrian corridor under the AJC Bose flyover.',
    stairPenaltyMinutes: 1.5,
  },
  {
    id: 'ruby_fob',
    name: 'Ruby More EM Bypass Foot Overbridge',
    bengaliName: 'রুবি মোড় ফুট ওভারব্রিজ',
    type: 'overbridge',
    coordinates: { latitude: 22.5126, longitude: 88.4018 },
    // EM Bypass highway divider
    barrierLine: [
      { latitude: 22.5105, longitude: 88.4015 },
      { latitude: 22.5150, longitude: 88.4022 },
    ],
    description: 'Elevated skybridge over EM Bypass connecting Kasba connector with Anandapur side.',
    stairPenaltyMinutes: 3,
  },
];
