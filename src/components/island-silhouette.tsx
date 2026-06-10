import { ISLAND_VIEWBOX, islandIdentity } from "@/lib/island-identity";

export function IslandSilhouette({
  islandId,
  className,
}: {
  islandId: string;
  className?: string;
}) {
  const island = islandIdentity(islandId);

  return (
    <svg
      viewBox={ISLAND_VIEWBOX}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <rect width="200" height="150" fill={island.water} />
      <path d={island.shelfPath} fill={island.shallows} opacity={0.65} />
      <path d={island.landPath} fill="none" stroke={island.sand} strokeWidth={7} />
      <path d={island.landPath} fill={island.land} />
      <path d={island.highlandPath} fill={island.highland} opacity={0.8} />
    </svg>
  );
}
