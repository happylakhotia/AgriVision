import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = { lat: 17.3266, lng: 78.1695 };

// Index descriptions based on color/value ranges
const getIndexDescriptions = (indexType) => {
  switch (indexType) {
    case "NDVI":
    case "SAVI":
      return {
        healthy: {
          color: "#1a9641",
          title: "Excellent Health",
          description: "Your crop is thriving! Dense, healthy vegetation with optimal chlorophyll levels. Continue current practices.",
        },
        good: {
          color: "#a6d96a",
          title: "Good Health",
          description: "Healthy vegetation detected. Crops are growing well with adequate nutrient uptake.",
        },
        moderate: {
          color: "#fdae61",
          title: "Moderate Stress",
          description: "Some stress detected. Consider checking for water, nutrient deficiency, or early pest issues.",
        },
        poor: {
          color: "#d7191c",
          title: "High Stress / Bare Soil",
          description: "Low vegetation or high stress area. May indicate disease, drought, or bare soil. Immediate attention recommended.",
        },
      };
    case "EVI":
      return {
        healthy: {
          color: "#1a9641",
          title: "Dense Canopy",
          description: "Very dense vegetation with high biomass. Excellent canopy coverage and plant health.",
        },
        good: {
          color: "#a6d96a",
          title: "Good Canopy",
          description: "Good vegetation density. Healthy canopy development with adequate leaf area.",
        },
        moderate: {
          color: "#fdae61",
          title: "Moderate Density",
          description: "Moderate vegetation density. May benefit from improved growing conditions.",
        },
        poor: {
          color: "#d7191c",
          title: "Sparse Vegetation",
          description: "Low vegetation density detected. Check for growth issues or bare soil areas.",
        },
      };
    case "NDRE":
      return {
        healthy: {
          color: "#c49a00",
          title: "Maturity Stage",
          description: "Crop is in maturity/flowering stage. Monitor for harvest readiness.",
        },
        good: {
          color: "#1b8a3c",
          title: "Active Growth",
          description: "Strong vegetative growth with high chlorophyll activity. Optimal growing phase.",
        },
        moderate: {
          color: "#b2ff59",
          title: "Early Growth",
          description: "Early vegetative stage. Ensure adequate nutrients for continued growth.",
        },
        poor: {
          color: "#bdbdbd",
          title: "Dormant / Bare",
          description: "Minimal vegetation activity. Could be dormant, harvested, or bare soil.",
        },
      };
    default:
      return null;
  }
};

// Calculate color distance (Euclidean in RGB space)
const colorDistance = (r1, g1, b1, r2, g2, b2) => {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2)
  );
};

// Convert hex to RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
};

// Find closest matching description based on pixel color
const getDescriptionFromColor = (r, g, b, indexType) => {
  const descriptions = getIndexDescriptions(indexType);
  if (!descriptions) return null;

  // Skip transparent or near-transparent pixels
  if (r === 0 && g === 0 && b === 0) return null;

  let closestMatch = null;
  let minDistance = Infinity;

  Object.entries(descriptions).forEach(([key, value]) => {
    const rgb = hexToRgb(value.color);
    if (rgb) {
      const distance = colorDistance(r, g, b, rgb.r, rgb.g, rgb.b);
      if (distance < minDistance) {
        minDistance = distance;
        closestMatch = { key, ...value };
      }
    }
  });

  // Only return match if color is reasonably close (threshold)
  return minDistance < 150 ? closestMatch : null;
};

const HeatmapImageOverlay = ({ imageUrl, bounds, polygon, opacity, visible, indexType, onHoverInfo }) => {
  const map = useMap();
  const canvasRef = useRef(null);
  const imageDataRef = useRef(null);

  // Simple point-in-polygon check (ray casting)
  const isPointInPolygon = useCallback((latlng, poly) => {
    if (!poly?.length) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = Array.isArray(poly[i]) ? poly[i][0] : poly[i].lat;
      const yi = Array.isArray(poly[i]) ? poly[i][1] : poly[i].lng;
      const xj = Array.isArray(poly[j]) ? poly[j][0] : poly[j].lat;
      const yj = Array.isArray(poly[j]) ? poly[j][1] : poly[j].lng;
      const intersect = yi > latlng.lng !== yj > latlng.lng
        && latlng.lat < ((xj - xi) * (latlng.lng - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }, []);

  // Load image into canvas for pixel color detection
  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      canvasRef.current = canvas;
      imageDataRef.current = { width: img.width, height: img.height };
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Get pixel color at a specific lat/lng position
  const getPixelColor = useCallback(
    (latlng) => {
      if (!canvasRef.current || !imageDataRef.current || !bounds) return null;

      const { width, height } = imageDataRef.current;

      // Convert lat/lng to pixel coordinates within the image
      const latRange = bounds.maxLat - bounds.minLat;
      const lngRange = bounds.maxLng - bounds.minLng;

      const x = Math.floor(((latlng.lng - bounds.minLng) / lngRange) * width);
      const y = Math.floor(((bounds.maxLat - latlng.lat) / latRange) * height);

      if (x < 0 || x >= width || y < 0 || y >= height) return null;

      const ctx = canvasRef.current.getContext("2d");
      const pixel = ctx.getImageData(x, y, 1, 1).data;

      // Return RGBA values
      return { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] };
    },
    [bounds]
  );

  useEffect(() => {
    if (!map || !imageUrl || !bounds || !polygon?.length || !visible) return undefined;

    const leafletBounds = L.latLngBounds(
      [bounds.minLat, bounds.minLng],
      [bounds.maxLat, bounds.maxLng]
    );

    const overlay = L.imageOverlay(imageUrl, leafletBounds, {
      opacity,
      interactive: true,
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

    // Handle mouse move for hover detection
    const handleMouseMove = (e) => {
      // Guard: only respond when cursor is inside polygon
      if (!polygon || !isPointInPolygon(e.latlng, polygon)) {
        onHoverInfo?.(null);
        return;
      }

      const pixel = getPixelColor(e.latlng);
      if (pixel && pixel.a > 50) {
        const description = getDescriptionFromColor(pixel.r, pixel.g, pixel.b, indexType);
        if (description) {
          onHoverInfo?.({
            ...description,
            position: e.containerPoint,
            latlng: e.latlng,
          });
        } else {
          onHoverInfo?.(null);
        }
      } else {
        onHoverInfo?.(null);
      }
    };

    const handleMouseOut = () => {
      onHoverInfo?.(null);
    };

    map.on("zoom", updateClip);
    map.on("move", updateClip);
    map.on("viewreset", updateClip);
    map.on("mousemove", handleMouseMove);
    map.on("mouseout", handleMouseOut);
    overlay.on("load", updateClip);
    updateClip();

    return () => {
      map.off("zoom", updateClip);
      map.off("move", updateClip);
      map.off("viewreset", updateClip);
      map.off("mousemove", handleMouseMove);
      map.off("mouseout", handleMouseOut);
      overlay.remove();
    };
  }, [map, imageUrl, bounds, polygon, opacity, visible, indexType, getPixelColor, onHoverInfo]);

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

// Tooltip component for hover info
const HoverTooltip = ({ info }) => {
  if (!info) return null;

  return (
    <div
      className="absolute z-[1000] pointer-events-none transition-opacity duration-150"
      style={{
        left: info.position.x + 15,
        top: info.position.y - 10,
        maxWidth: "280px",
      }}
    >
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-4 h-4 rounded-full border border-gray-300"
            style={{ backgroundColor: info.color }}
          />
          <span className="font-semibold text-gray-800 text-sm">{info.title}</span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">{info.description}</p>
      </div>
      {/* Arrow pointer */}
      <div
        className="absolute -left-2 top-4 w-0 h-0"
        style={{
          borderTop: "6px solid transparent",
          borderBottom: "6px solid transparent",
          borderRight: "8px solid white",
        }}
      />
    </div>
  );
};

const FieldMap = ({ field, heatmapOverlay }) => {
  const { t } = useTranslation();
  const [hoverInfo, setHoverInfo] = useState(null);

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

  const handleHoverInfo = useCallback((info) => {
    setHoverInfo(info);
  }, []);

  return (
    <div className="rounded-2xl border border-gray-200 shadow-md bg-white/70 backdrop-blur-xl">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white/50 backdrop-blur-md rounded-t-2xl">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-700">
            Map of {field?.name || "Field"}
          </h2>
        </div>
        {heatmapOverlay?.visible && heatmapOverlay?.indexType && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Hover over heatmap for details
          </span>
        )}
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
            attributionControl={false}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
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
                indexType={heatmapOverlay.indexType || "NDVI"}
                onHoverInfo={handleHoverInfo}
              />
            )}
          </MapContainer>

          {/* Hover Tooltip */}
          <HoverTooltip info={hoverInfo} />
        </div>
      </div>
    </div>
  );
};

export default FieldMap;