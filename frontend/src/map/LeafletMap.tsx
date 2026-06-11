import { useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapProps } from "./MapProvider";
import type { SearchZoneProperties } from "@/types/contracts";

// Fix default icon paths broken by bundler
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const ZONE_COLORS: Record<1 | 2 | 3, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
};

const ZONE_LABELS: Record<1 | 2 | 3, string> = {
  1: "1순위 (60%)",
  2: "2순위 (80%)",
  3: "3순위 (95%)",
};

function zoneStyle(priority: number) {
  const color = ZONE_COLORS[priority as 1 | 2 | 3] ?? "#ffffff";
  return {
    color,
    fillColor: color,
    fillOpacity: 0.15,
    weight: 2,
    opacity: 0.9,
  };
}

function RecenterView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function LeafletMap({ center, zoom = 10, searchZones, predictedCenter, className }: MapProps) {
  // Convert [lon,lat] → [lat,lon] for Leaflet
  const leafletCenter: [number, number] = [center[1], center[0]];
  const markerPos: [number, number] | null = predictedCenter
    ? [predictedCenter.lat, predictedCenter.lon]
    : null;

  return (
    <MapContainer
      center={leafletCenter}
      zoom={zoom}
      className={className ?? "h-full w-full"}
      style={{ background: "#0a1628" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        opacity={0.6}
      />

      <RecenterView center={leafletCenter} zoom={zoom} />

      {searchZones && (
        <GeoJSON
          key={JSON.stringify(searchZones)}
          data={searchZones as unknown as GeoJSON.FeatureCollection}
          style={(feature) => {
            const props = feature?.properties as SearchZoneProperties | undefined;
            return zoneStyle(props?.priority ?? 3);
          }}
          onEachFeature={(feature, layer) => {
            const props = feature.properties as SearchZoneProperties;
            layer.bindTooltip(
              `${ZONE_LABELS[props.priority as 1 | 2 | 3]} · ${props.area_km2.toFixed(1)} km²`,
              { permanent: false, className: "drift-tooltip" }
            );
          }}
        />
      )}

      {markerPos && (
        <Marker position={markerPos} />
      )}
    </MapContainer>
  );
}
