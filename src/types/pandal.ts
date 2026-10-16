export interface Pandal {
  id: string;
  name_en: string;
  name_bn?: string;
  cluster?: string;
  entry_lat: number;
  entry_lng: number;
  nearest_metro?: string;
  metro_line?: 'Blue' | 'Green' | 'Purple' | 'Orange';
  metro_gate?: string;
  walk_mins?: number;
  wheelchair_access: boolean;
  senior_line: boolean;
  medical_kiosk?: boolean;
  restroom_nearby?: boolean;
  wait_time_minutes: number;
  status_level?: 1 | 2 | 3 | 4; // 1: Green (<15m), 2: Yellow (15-30m), 3: Orange (30-60m), 4: Red (Gridlock)
  // Backward compatibility alias getters/properties
  name?: string;
  bengali_name?: string;
  latitude?: number;
  longitude?: number;
  nearest_metro_station?: string;
  metro_walking_mins?: number;
  wheelchair_accessible?: boolean;
  senior_queue?: boolean;
  medical_booth?: boolean;
  police_kiosk?: string;
  live_crowd_level?: number;
}

export type FilterChip =
  | 'All'
  | 'Low Wait (<30m)'
  | 'Senior Access'
  | 'Near Metro'
  | 'Saved'
  | 'Visited'
  | 'Nearby Food';

