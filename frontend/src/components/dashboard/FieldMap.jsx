import React, { useMemo } from "react";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = { lat: 17.3266, lng: 78.1695 };

const HeatmapImageOverlay = ({ imageUrl, bounds, polygon, opacity, visible }) => {
  const map = useMap();

  React.useEffect(() => {
    if (!map || !imageUrl || !bounds || !polygon?.length || !visible) return undefined;

    const leafletBounds = L.latLngBounds(
      [bounds.minLat, bounds.minLng],
      [bounds.maxLat, bounds.maxLng]
    );

    const overlay = L.imageOverlay(imageUrl, leafletBounds, {
      opacity,
      interactive: false,
      className: "heatmap-leaflet-overlay",
    }).addTo(map);

    const updateClip = () => {
      const img = overlay.getElement();
      if (!img) return;

      const topLeft = map.latLngToLayerPoint(leafletBounds.getNorthWest());
      const clipPoints = polygon
        .map((pt) => {
          const latLng = Array.isArray(pt) ? L.latLng(pt[0], pt[1]) : L.latLng(pt.lat, pt.lng);
          const projected = map.latLngToLayerPoint(latLng);
          return `${projected.x - topLeft.x}px ${projected.y - topLeft.y}px`;
        })
        .join(", ");

      const clipPath = `polygon(${clipPoints})`;
      img.style.clipPath = clipPath;
      img.style.webkitClipPath = clipPath;
    };

    map.on("zoom", updateClip);
    map.on("move", updateClip);
    map.on("viewreset", updateClip);
    overlay.on("load", updateClip);
    updateClip();

    return () => {
      map.off("zoom", updateClip);
      map.off("move", updateClip);
      map.off("viewreset", updateClip);
      overlay.remove();
    };
  }, [map, imageUrl, bounds, polygon, opacity, visible]);

  return null;
};

const FitPolygon = ({ polygon, bounds }) => {
  const map = useMap();
  React.useEffect(() => {
    if (!map) return;
    if (polygon?.length) {
      const polyBounds = L.latLngBounds(polygon);
      map.fitBounds(polyBounds, { padding: [20, 20] });
      return;
    }
    if (bounds) {
      const b = L.latLngBounds(
        [bounds.minLat, bounds.minLng],
        [bounds.maxLat, bounds.maxLng]
      );
      map.fitBounds(b, { padding: [20, 20] });
    }
  }, [map, polygon, bounds]);
  return null;
};

const FieldMap = ({ field, heatmapOverlay }) => {
  const { t } = useTranslation();

  const polygonCoords = useMemo(() => {
    if (field?.coordinates?.length) {
      return field.coordinates.map((c) => [c.lat, c.lng]);
    }
    return [];
  }, [field]);

  const centroid = useMemo(() => {
    if (!polygonCoords.length) return null;
    const sum = polygonCoords.reduce(
      (acc, [lat, lng]) => {
        acc.lat += lat;
        acc.lng += lng;
        return acc;
      },
      { lat: 0, lng: 0 }
    );
    return { lat: sum.lat / polygonCoords.length, lng: sum.lng / polygonCoords.length };
  }, [polygonCoords]);

  const mapCenter = centroid || DEFAULT_CENTER;

  return (
    <div className="rounded-2xl border border-gray-200 shadow-md bg-white/70 backdrop-blur-xl">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white/50 backdrop-blur-md rounded-t-2xl">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-700">
            Map of {field?.name || "Field"}
          </h2>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="relative h-[500px] rounded-2xl border border-gray-200 shadow-inner bg-gray-100 overflow-hidden">
          {!polygonCoords.length && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4 z-10 bg-white/90">
              <p className="text-gray-700 font-medium text-lg">
                {t("field_map_no_field_title")}
              </p>
              <p className="text-sm text-gray-500">
                {t("field_map_no_field_desc_without_location")}
              </p>
            </div>
          )}

          <MapContainer
            center={mapCenter}
            zoom={17}
            className="w-full h-full"
            scrollWheelZoom
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
            />
            <FitPolygon polygon={polygonCoords} bounds={heatmapOverlay?.bounds} />
            {polygonCoords.length > 0 && (
              <Polygon
                positions={polygonCoords}
                pathOptions={{
                  color: "#22c55e",
                  weight: 2,
                  fillColor: "#22c55e",
                  fillOpacity: 0.18,
                }}
              />
            )}
            {heatmapOverlay?.heatmapUrl && heatmapOverlay?.bounds && (
              <HeatmapImageOverlay
                imageUrl={heatmapOverlay.heatmapUrl}
                bounds={heatmapOverlay.bounds}
                polygon={heatmapOverlay.polygon || polygonCoords}
                opacity={heatmapOverlay.opacity ?? 0.6}
                visible={heatmapOverlay.visible ?? true}
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default FieldMap;
