/**
 * MapProvider — adapter for swappable map backends.
 * Default: Leaflet. Future: Kakao Maps via same props interface.
 */
import React from "react";
import type { GeoJSONFeatureCollection, SearchZoneProperties, Coordinate } from "@/types/contracts";

export interface MapProps {
  center: [number, number];
  zoom?: number;
  searchZones?: GeoJSONFeatureCollection<SearchZoneProperties>;
  predictedCenter?: Coordinate;
  className?: string;
}

type MapBackend = "leaflet" | "kakao";

const BACKEND: MapBackend =
  (import.meta.env.VITE_MAP_BACKEND as MapBackend | undefined) ?? "leaflet";

// Dynamic import so Kakao SDK is only loaded when configured
const LeafletMap = React.lazy(() => import("./LeafletMap"));

export const DriftMap: React.FC<MapProps> = (props) => {
  if (BACKEND === "leaflet") {
    return (
      <React.Suspense fallback={<div className="h-full bg-navy-900 animate-pulse" />}>
        <LeafletMap {...props} />
      </React.Suspense>
    );
  }
  // Placeholder for Kakao Maps integration
  return (
    <div className="h-full bg-navy-900 flex items-center justify-center text-cyan-400">
      Kakao Maps adapter not yet implemented
    </div>
  );
};
