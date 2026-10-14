export interface CuratedCircuit {
  id: string;
  titleEn: string;
  titleBn: string;
  badge: string;
  description: string;
  pandalIds: string[];
  estimatedKm: number;
  estimatedMinutes: number;
  highlightTag: string;
}

export const CURATED_CIRCUITS: CuratedCircuit[] = [
  {
    id: 'south_heritage',
    titleEn: 'South Kolkata Heritage Trail',
    titleBn: 'দক্ষিণ কলকাতা সাবেকি পরিক্রমা',
    badge: '🌟 Most Popular',
    description: 'Iconic classical lighting, traditional protima, and cultural adda at Gariahat & Ballygunge.',
    pandalIds: ['1', '2', '3', '11'], // Ekdalia Evergreen, Singhi Park, Ballygunge Cultural, Maddox Square
    estimatedKm: 2.8,
    estimatedMinutes: 45,
    highlightTag: 'Sabeki & Lighting',
  },
  {
    id: 'north_bonedi',
    titleEn: 'North Kolkata Landmark Trail',
    titleBn: 'উত্তর কলকাতা রাজবাড়ি ও সাবেকি পুজো',
    badge: '🏛️ Heritage & Culture',
    description: 'Old-world Kolkata charm from Bagbazar ghats to the idol-makers of Kumartuli & Sovabazar Rajbari.',
    pandalIds: ['29', '32', '30', '31'], // Bagbazar, Kumartuli Park, Sovabazar Rajbari, Ahiritola
    estimatedKm: 3.1,
    estimatedMinutes: 50,
    highlightTag: 'Rajbari & Clay Idols',
  },
  {
    id: 'mega_themes',
    titleEn: 'VIP Road & Salt Lake Extravaganza',
    titleBn: 'ভিআইপি রোড ও সল্টলেক থিম পুজো',
    badge: '✨ Grand Themes',
    description: 'Breathtaking architecture, illuminated palaces, and creative thematic installations along VIP Road.',
    pandalIds: ['52', '53', '54', '56'], // Sree Bhumi, Lake Town Netaji, Dum Dum Park Bharat Chakra, FD Block
    estimatedKm: 3.6,
    estimatedMinutes: 60,
    highlightTag: 'Illumination & Art',
  },
  {
    id: 'central_heritage',
    titleEn: 'Central Kolkata Historic Circuit',
    titleBn: 'সেন্ট্রাল কলকাতা ঐতিহ্য পরিক্রমা',
    badge: '📚 Historic Heart',
    description: 'The monumental lake illumination of College Square and illuminated monuments near Sealdah.',
    pandalIds: ['64', '65', '66'], // College Square, Md Ali Park, Santosh Mitra Square
    estimatedKm: 2.2,
    estimatedMinutes: 35,
    highlightTag: 'Water Illumination',
  },
  {
    id: 'accessible_comfort',
    titleEn: 'Senior & Wheelchair Priority Trail',
    titleBn: 'প্রবীণ ও হুইলচেয়ার বিশেষ পথ',
    badge: '🧓 Accessibility First',
    description: 'Wide flat barricades, senior priority fast lines, and medical kiosks for a stress-free experience.',
    pandalIds: ['13', '4', '11', '17'], // Harish Park, Hindustan Park, Maddox Square, Suruchi Sangha
    estimatedKm: 3.4,
    estimatedMinutes: 55,
    highlightTag: 'Zero-Step Access',
  },
];
