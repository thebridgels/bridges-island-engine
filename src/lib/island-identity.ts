// Every island has one permanent body: its coastline, shallows, and colors
// are derived deterministically from its id, so an island always looks like
// itself — on the dashboard, on arrival, every visit. The database rows
// describe the island; this is the island.

export type IslandIdentity = {
  shelfPath: string;
  landPath: string;
  highlandPath: string;
  water: string;
  shallows: string;
  sand: string;
  land: string;
  highland: string;
};

export const ISLAND_VIEWBOX = "0 0 200 150";

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Point = [number, number];

const CX = 100;
const CY = 75;

function smoothClosedPath(points: Point[]): string {
  const n = points.length;
  const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[0], points[1]);
  let d = `M ${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const p = points[i % n];
    const m = mid(p, points[(i + 1) % n]);
    d += ` Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

function scaleAbout(points: Point[], factor: number): Point[] {
  return points.map(([x, y]) => [CX + (x - CX) * factor, CY + (y - CY) * factor]);
}

export function islandIdentity(islandId: string): IslandIdentity {
  const rand = mulberry32(hashSeed(islandId));

  const hueWater = 190 + Math.round(rand() * 30);
  const hueLand = 95 + Math.round(rand() * 55);
  const hueSand = 38 + Math.round(rand() * 12);

  const pointCount = 10;
  const coast: Point[] = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const reach = 0.72 + rand() * 0.3;
    coast.push([
      CX + Math.cos(angle) * 78 * reach,
      CY + Math.sin(angle) * 54 * reach,
    ]);
  }

  const driftX = (rand() - 0.5) * 28;
  const driftY = (rand() - 0.5) * 18;
  const highland = scaleAbout(coast, 0.45).map(
    ([x, y]): Point => [x + driftX, y + driftY]
  );

  return {
    shelfPath: smoothClosedPath(scaleAbout(coast, 1.18)),
    landPath: smoothClosedPath(coast),
    highlandPath: smoothClosedPath(highland),
    water: `hsl(${hueWater}, 58%, 25%)`,
    shallows: `hsl(${hueWater}, 50%, 37%)`,
    sand: `hsl(${hueSand}, 48%, 66%)`,
    land: `hsl(${hueLand}, 38%, 40%)`,
    highland: `hsl(${hueLand}, 42%, 31%)`,
  };
}
