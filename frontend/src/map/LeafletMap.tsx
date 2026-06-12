import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Polyline, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapProps } from "./MapProvider";
import type { SearchZoneProperties, Coordinate } from "@/types/contracts";
import { loadKoreaGeoJSON } from "./landMask";

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
  return { color, fillColor: color, fillOpacity: 0.15, weight: 2, opacity: 0.9 };
}

function buildSectorPositions(
  origin: Coordinate,
  dirDeg: number,
  halfDeg: number,
  distNm: number,
): [number, number][] {
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  const ARC_STEPS = 20;
  const pts: [number, number][] = [[origin.lat, origin.lon]];
  for (let i = 0; i <= ARC_STEPS; i++) {
    const angle = dirDeg - halfDeg + (2 * halfDeg * i) / ARC_STEPS;
    const rad = (angle * Math.PI) / 180;
    const lat = origin.lat + (distNm * Math.cos(rad)) / 60;
    const lon = origin.lon + (distNm * Math.sin(rad)) / (60 * cosLat);
    pts.push([lat, lon]);
  }
  return pts;
}

function RecenterView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom); }, [center, zoom, map]);
  return null;
}

// Must render before any layer that uses these panes
function SetupPanes() {
  const map = useMap();
  useEffect(() => {
    const panes: [string, string][] = [
      ["lyrZones", "400"],
      ["lyrLand",  "420"],
      ["lyrTrack", "450"],
    ];
    for (const [name, z] of panes) {
      if (!map.getPane(name)) {
        map.createPane(name).style.zIndex = z;
      }
    }
  }, [map]);
  return null;
}

// Canvas-rendered land mask — fast for 3 558 MultiPolygon features
function KoreaLandMask({ data }: { data: GeoJSON.FeatureCollection }) {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane("lyrLand")) return;
    const renderer = L.canvas({ pane: "lyrLand", padding: 0.5 });
    const opts = {
      renderer,
      pane: "lyrLand",
      style: () => ({
        fillColor: "#0a1628",
        fillOpacity: 0.92,
        color: "#1e3a6e",
        weight: 0.5,
        opacity: 0.6,
      }),
    } as unknown as L.GeoJSONOptions;
    const layer = L.geoJSON(data as unknown as GeoJSON.GeoJsonObject, opts);
    map.addLayer(layer);
    return () => { map.removeLayer(layer); };
  }, [data, map]);
  return null;
}

export default function LeafletMap({
  center, zoom = 10,
  searchZones, predictedCenter,
  lastKnownPosition, driftTrack, driftSector,
  className,
}: MapProps) {
  const [landGeo, setLandGeo] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    loadKoreaGeoJSON().then(setLandGeo).catch(console.error);
  }, []);

  const leafletCenter: [number, number] = [center[1], center[0]];

  const trackPositions: [number, number][] = driftTrack
    ? driftTrack.map((c) => [c.lat, c.lon])
    : [];

  const fullTrack: [number, number][] =
    lastKnownPosition && trackPositions.length > 0
      ? [[lastKnownPosition.lat, lastKnownPosition.lon], ...trackPositions]
      : trackPositions;

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
        opacity={0.55}
      />
      {/* SetupPanes must come first — its effect runs before layer effects */}
      <SetupPanes />
      <RecenterView center={leafletCenter} zoom={zoom} />

      {/* ── lyrZones (400): sector + search zones ── */}
      {driftSector && driftSector.distanceNm > 0 && (
        <Polygon
          pane="lyrZones"
          positions={buildSectorPositions(
            driftSector.origin,
            driftSector.directionDeg,
            driftSector.halfAngleDeg,
            driftSector.distanceNm,
          )}
          pathOptions={{
            color: "#22d3ee",
            fillColor: "#22d3ee",
            fillOpacity: 0.10,
            weight: 1.5,
            dashArray: "6 4",
            opacity: 0.55,
          }}
        />
      )}
      {searchZones && (
        <GeoJSON
          pane="lyrZones"
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
              { permanent: false, className: "drift-tooltip" },
            );
          }}
        />
      )}

      {/* ── lyrLand (420): Korea land mask — clips zones at coastline ── */}
      {landGeo && <KoreaLandMask data={landGeo} />}

      {/* ── lyrTrack (450): drift track + position markers ── */}
      {fullTrack.length >= 2 && (
        <Polyline
          pane="lyrTrack"
          positions={fullTrack}
          pathOptions={{
            color: "#22d3ee",
            weight: 1.5,
            dashArray: "6 5",
            opacity: 0.65,
          }}
        />
      )}
      {predictedCenter && (
        <CircleMarker
          pane="lyrTrack"
          center={[predictedCenter.lat, predictedCenter.lon]}
          radius={6}
          pathOptions={{
            color: "#22d3ee",
            fillColor: "#22d3ee",
            fillOpacity: 0.9,
            weight: 2,
          }}
        />
      )}
      {lastKnownPosition && (
        <>
          <CircleMarker
            pane="lyrTrack"
            center={[lastKnownPosition.lat, lastKnownPosition.lon]}
            radius={10}
            pathOptions={{
              color: "#f59e0b",
              fillColor: "#f59e0b",
              fillOpacity: 0.15,
              weight: 2,
              dashArray: "4 3",
            }}
          />
          <CircleMarker
            pane="lyrTrack"
            center={[lastKnownPosition.lat, lastKnownPosition.lon]}
            radius={4}
            pathOptions={{
              color: "#f59e0b",
              fillColor: "#f59e0b",
              fillOpacity: 1,
              weight: 0,
            }}
          />
        </>
      )}
    </MapContainer>
  );
}
