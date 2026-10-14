import { Pandal } from '../types/pandal';
import {
  Coordinates,
  PedestrianCrossing,
  KOLKATA_PEDESTRIAN_CROSSINGS,
} from '../data/kolkataCrossings';

export interface RouteLeg {
  legIndex: number;
  fromName: string;
  toName: string;
  fromCoordinates: Coordinates;
  toCoordinates: Coordinates;
  distanceMeters: number;
  walkingMinutes: number;
  waypoints: Coordinates[];
  avoidedCrossing?: PedestrianCrossing;
  navigationTip?: string;
}

export interface PedestrianHoppingCircuit {
  orderedPandals: Pandal[];
  totalDistanceMeters: number;
  totalDistanceKm: number;
  totalWalkingMinutes: number;
  totalPandalWaitMinutes: number;
  totalTripMinutes: number;
  legs: RouteLeg[];
  fullPolylineCoordinates: [number, number][];
  crossingsUsed: PedestrianCrossing[];
}

export interface RouterOptions {
  walkingSpeedKmH?: number; // Default: 4.2 km/h (standard pedestrian speed during Puja rush)
  customCrossings?: PedestrianCrossing[];
  includePandalWaitTimes?: boolean;
}

// ----------------------------------------------------------------------------
// 1. Haversine Great-Circle Distance
// ----------------------------------------------------------------------------
export const calculateHaversineDistance = (
  c1: Coordinates,
  c2: Coordinates
): number => {
  const R = 6371000; // Earth radius in meters
  const dLat = ((c2.latitude - c1.latitude) * Math.PI) / 180;
  const dLng = ((c2.longitude - c1.longitude) * Math.PI) / 180;
  const lat1Rad = (c1.latitude * Math.PI) / 180;
  const lat2Rad = (c2.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// ----------------------------------------------------------------------------
// 2. 2D Geometry: Check if two line segments intersect
// Used to detect if walking path cuts across barricaded avenues / tram lines
// ----------------------------------------------------------------------------
const orientation = (p: Coordinates, q: Coordinates, r: Coordinates): number => {
  const val =
    (q.latitude - p.latitude) * (r.longitude - q.longitude) -
    (q.longitude - p.longitude) * (r.latitude - q.latitude);

  if (Math.abs(val) < 1e-9) return 0; // Collinear
  return val > 0 ? 1 : 2; // 1: Clockwise, 2: Counterclockwise
};

const onSegment = (p: Coordinates, q: Coordinates, r: Coordinates): boolean => {
  return (
    q.latitude <= Math.max(p.latitude, r.latitude) &&
    q.latitude >= Math.min(p.latitude, r.latitude) &&
    q.longitude <= Math.max(p.longitude, r.longitude) &&
    q.longitude >= Math.min(p.longitude, r.longitude)
  );
};

export const doSegmentsIntersect = (
  p1: Coordinates,
  q1: Coordinates,
  p2: Coordinates,
  q2: Coordinates
): boolean => {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  // General case
  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  // Special Collinear cases
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
};

// ----------------------------------------------------------------------------
// 3. Compute Leg Route (With Pedestrian Bottleneck / Barricade Avoidance)
// ----------------------------------------------------------------------------
export const calculatePedestrianLeg = (
  from: Coordinates,
  to: Coordinates,
  fromName: string,
  toName: string,
  legIndex: number,
  crossings: PedestrianCrossing[],
  walkingSpeedKmH: number
): RouteLeg => {
  const speedMetersPerMin = (walkingSpeedKmH * 1000) / 60;

  // Check if direct line intersects any known police barrier / tram median
  let intersectedCrossing: PedestrianCrossing | undefined;

  for (const crossing of crossings) {
    const [b1, b2] = crossing.barrierLine;
    if (doSegmentsIntersect(from, to, b1, b2)) {
      intersectedCrossing = crossing;
      break;
    }
  }

  if (intersectedCrossing) {
    // Divert path: from -> subway/overbridge -> to
    const d1 = calculateHaversineDistance(from, intersectedCrossing.coordinates);
    const d2 = calculateHaversineDistance(intersectedCrossing.coordinates, to);
    const totalDistance = d1 + d2;
    const walkingTime =
      totalDistance / speedMetersPerMin + intersectedCrossing.stairPenaltyMinutes;

    return {
      legIndex,
      fromName,
      toName,
      fromCoordinates: from,
      toCoordinates: to,
      distanceMeters: totalDistance,
      walkingMinutes: Math.round(walkingTime * 10) / 10,
      waypoints: [from, intersectedCrossing.coordinates, to],
      avoidedCrossing: intersectedCrossing,
      navigationTip: `Police barricade active across direct street. Cross via ${intersectedCrossing.name} (${intersectedCrossing.type.toUpperCase()}). ${intersectedCrossing.description}`,
    };
  }

  // Direct pedestrian path if no barricade intersects
  const directDistance = calculateHaversineDistance(from, to);
  const walkingTime = directDistance / speedMetersPerMin;

  return {
    legIndex,
    fromName,
    toName,
    fromCoordinates: from,
    toCoordinates: to,
    distanceMeters: directDistance,
    walkingMinutes: Math.round(walkingTime * 10) / 10,
    waypoints: [from, to],
  };
};

// ----------------------------------------------------------------------------
// 4. Main Routing Utility: Nearest Neighbor Travelling Salesperson
// ----------------------------------------------------------------------------
/**
 * Takes 3 to 6 pandal IDs and user GPS coordinates, and computes an optimal
 * pedestrian pandal hopping circuit minimizing walking distance and routing
 * safely around Kolkata Police road-crossing barriers.
 */
export const calculateOptimalHoppingCircuit = (
  selectedPandalIds: string[],
  userGps: Coordinates,
  pandalsPool: Pandal[],
  options: RouterOptions = {}
): PedestrianHoppingCircuit => {
  // Validate input bounds (3 to 6 pandals)
  if (selectedPandalIds.length < 3 || selectedPandalIds.length > 6) {
    throw new Error(
      `Invalid selection: You must select between 3 and 6 pandals for an optimal pedestrian hopping circuit (received ${selectedPandalIds.length}).`
    );
  }

  const {
    walkingSpeedKmH = 4.2,
    customCrossings = KOLKATA_PEDESTRIAN_CROSSINGS,
    includePandalWaitTimes = true,
  } = options;

  // Resolve pandal objects
  const pandalsMap = new Map<string, Pandal>(pandalsPool.map((p) => [p.id, p]));
  const unvisited: Pandal[] = [];

  for (const id of selectedPandalIds) {
    const p = pandalsMap.get(id);
    if (!p) {
      throw new Error(`Pandal with ID "${id}" was not found in the pandals pool.`);
    }
    unvisited.push(p);
  }

  const orderedPandals: Pandal[] = [];
  const legs: RouteLeg[] = [];
  const crossingsUsed: PedestrianCrossing[] = [];

  let currentLocation: Coordinates = { ...userGps };
  let currentOriginName = 'Your Current Location';
  let legCounter = 1;

  // Greedy Nearest Neighbor loop starting from user's current GPS location
  while (unvisited.length > 0) {
    let nearestIndex = -1;
    let shortestLeg: RouteLeg | null = null;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const candidate = unvisited[i];
      const candidateLat = candidate.entry_lat ?? candidate.latitude ?? 0;
      const candidateLng = candidate.entry_lng ?? candidate.longitude ?? 0;
      const candidateName = candidate.name_en ?? candidate.name ?? 'Pandal';

      const candidateCoord: Coordinates = {
        latitude: candidateLat,
        longitude: candidateLng,
      };

      // Calculate leg considering subway/overbridge detours
      const leg = calculatePedestrianLeg(
        currentLocation,
        candidateCoord,
        currentOriginName,
        candidateName,
        legCounter,
        customCrossings,
        walkingSpeedKmH
      );

      if (leg.distanceMeters < minDistance) {
        minDistance = leg.distanceMeters;
        shortestLeg = leg;
        nearestIndex = i;
      }
    }

    if (nearestIndex !== -1 && shortestLeg) {
      const nextPandal = unvisited.splice(nearestIndex, 1)[0];
      orderedPandals.push(nextPandal);
      legs.push(shortestLeg);

      if (
        shortestLeg.avoidedCrossing &&
        !crossingsUsed.some((c) => c.id === shortestLeg.avoidedCrossing?.id)
      ) {
        crossingsUsed.push(shortestLeg.avoidedCrossing);
      }

      // Advance current position to this pandal
      currentLocation = {
        latitude: nextPandal.entry_lat ?? nextPandal.latitude ?? 0,
        longitude: nextPandal.entry_lng ?? nextPandal.longitude ?? 0,
      };
      currentOriginName = nextPandal.name_en ?? nextPandal.name ?? 'Pandal';
      legCounter++;
    }
  }

  // Aggregate stats
  const totalDistanceMeters = legs.reduce((acc, leg) => acc + leg.distanceMeters, 0);
  const totalWalkingMinutes = Math.round(
    legs.reduce((acc, leg) => acc + leg.walkingMinutes, 0)
  );

  const totalPandalWaitMinutes = includePandalWaitTimes
    ? orderedPandals.reduce((acc, p) => acc + (p.wait_time_minutes || 0), 0)
    : 0;

  // Build full polyline coordinates for Leaflet <Polyline positions={...} />
  const fullPolylineCoordinates: [number, number][] = [];
  legs.forEach((leg, index) => {
    leg.waypoints.forEach((wp, wpIdx) => {
      // Avoid duplicate consecutive junction points
      if (
        index > 0 &&
        wpIdx === 0 &&
        fullPolylineCoordinates.length > 0
      ) {
        return;
      }
      fullPolylineCoordinates.push([wp.latitude, wp.longitude]);
    });
  });

  return {
    orderedPandals,
    totalDistanceMeters,
    totalDistanceKm: Math.round((totalDistanceMeters / 1000) * 100) / 100,
    totalWalkingMinutes,
    totalPandalWaitMinutes,
    totalTripMinutes: totalWalkingMinutes + totalPandalWaitMinutes,
    legs,
    fullPolylineCoordinates,
    crossingsUsed,
  };
};
