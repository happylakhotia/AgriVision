import React, { useEffect, useMemo, useState } from "react";
import { Sprout, ChevronDown, RefreshCw, Loader2, Eye, EyeOff } from "lucide-react";
import { MapContainer, Polygon, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { useAuth } from "../../contexts/authcontext/Authcontext";
import { db } from "../../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India centroid fallback

// Imperative overlay so we can clip to an arbitrary polygon
const HeatmapImageOverlay = ({ imageUrl, bounds, polygon, opacity, visible }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !imageUrl || !bounds || !polygon?.length) return undefined;

    const leafletBounds = L.latLngBounds(
      [bounds.minLat, bounds.minLng], // south-west
      [bounds.maxLat, bounds.maxLng]  // north-east
    );

    // Remove overlay entirely when toggled off
    if (!visible) {
      return undefined;
    }

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
  useEffect(() => {
    if (!map) return;
    if (polygon?.length) {
      const polyBounds = L.latLngBounds(polygon);
      map.fitBounds(polyBounds, { padding: [20, 20] });
      return;
    }
    if (bounds) {
      const b = L.latLngBounds(
        [bounds.maxLat, bounds.minLng],
        [bounds.minLat, bounds.maxLng]
      );
      map.fitBounds(b, { padding: [20, 20] });
    }
  }, [map, polygon, bounds]);
  return null;
};

const VegetationIndexCard = ({ field, onHeatmapReady }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [ndviData, setNdviData] = useState(null);
  const [error, setError] = useState(null);
  const [dominantLabel, setDominantLabel] = useState("");

  const [indexType, setIndexType] = useState("NDVI");
  const [heatmapUrl, setHeatmapUrl] = useState("");
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.6);
  const [heatmapVisible, setHeatmapVisible] = useState(true);

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

  const polygonBounds = useMemo(() => {
    if (!polygonCoords.length) return null;
    const lats = polygonCoords.map((p) => p[0]);
    const lngs = polygonCoords.map((p) => p[1]);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [polygonCoords]);

  useEffect(() => {
    // Whenever polygon changes, clear any previous heatmap so it doesn't linger
    setHeatmapUrl("");
    setNdviData(null);
    onHeatmapReady?.(null);
  }, [polygonCoords]);

  useEffect(() => {
    if (!currentUser) return;
    if (!field?.lat || !field?.lng) return;
    fetchAnalysis(field.lat, field.lng, indexType, field.radius || 1.0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexType, currentUser, field?.lat, field?.lng, field?.radius]);

  const fetchAnalysis = async (lat, lng, type, rad) => {
    setLoading(true);
    setError(null);
    setNdviData(null);
    setDominantLabel("");
    setHeatmapUrl("");
    onHeatmapReady?.(null);
    
    try {
      console.log(`🚀 Requesting ${type} Analysis...`);
      
      const response = await fetch("http://localhost:5000/api/analyze-ndvi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            lat,
            lng,
            indexType: type,
            radius: rad,
            polygon: polygonCoords,
            bounds: polygonBounds
        }),
      });

      const data = await response.json();

      if (data.success) {
        setNdviData(data);
        const resolvedBounds = data.bounds || polygonBounds;
        if (data.heatmap_base64) {
          setHeatmapUrl(`data:image/png;base64,${data.heatmap_base64}`);
        }
        
        if (data.statistics) {
          const maxKey = Object.keys(data.statistics).reduce((a, b) => 
            data.statistics[a] > data.statistics[b] ? a : b
          );
          setDominantLabel(maxKey);
        }
        // Store bounds even if backend didn't return them
        if (resolvedBounds) {
          setNdviData((prev) => ({ ...prev, bounds: resolvedBounds }));
        }
        if (data.heatmap_base64 && resolvedBounds) {
          onHeatmapReady?.({
            heatmapUrl: `data:image/png;base64,${data.heatmap_base64}`,
            bounds: resolvedBounds,
            polygon: polygonCoords,
            opacity: heatmapOpacity,
            visible: heatmapVisible,
            indexType: type,
          });
        }
      } else {
        setError(data.error || `Failed to process ${type} data.`);
      }
    } catch (err) {
      console.error(err);
      setError("Server connection failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (field?.lat && field?.lng) {
      fetchAnalysis(field.lat, field.lng, indexType, field.radius || 1.0);
    }
  };

  const mapCenter = centroid || (field?.lat && field?.lng ? { lat: field.lat, lng: field.lng } : DEFAULT_CENTER);
  const overlayBounds = ndviData?.bounds || polygonBounds;

  // Keep parent overlay in sync when opacity/visibility change and we already have data
  useEffect(() => {
    if (!heatmapUrl || !overlayBounds || !polygonCoords.length) return;
    onHeatmapReady?.({
      heatmapUrl,
      bounds: overlayBounds,
      polygon: polygonCoords,
      opacity: heatmapOpacity,
      visible: heatmapVisible,
      indexType,
    });
  }, [heatmapOpacity, heatmapVisible, heatmapUrl, overlayBounds, polygonCoords, indexType]);

  return (
    <div className="rounded-2xl border border-gray-200 shadow-md bg-white/70 backdrop-blur-xl flex flex-col h-full">
      
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white/50 backdrop-blur-md rounded-t-2xl">
        <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Sprout className="h-5 w-5 text-green-600" />
          Crop Analysis {field && `- ${field.name}`}
        </h3>

        <div className="flex gap-2">
          {field?.lat && field?.lng && (
            <button 
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          
          <div className="relative flex items-center gap-2">
            <select
              value={indexType}
              onChange={(e) => setIndexType(e.target.value)}
              className="appearance-none w-32 px-3 py-1 bg-white border border-gray-300
                         rounded-md text-xs text-gray-700 font-medium focus:ring-2 
                         focus:ring-green-300 outline-none cursor-pointer"
            >
              <option value="NDVI">NDVI (Health)</option>
              <option value="NDRE">NDRE (Growth)</option>
              <option value="SAVI">SAVI (Soil)</option>
              <option value="EVI">EVI (Dense)</option>
            </select>
            <ChevronDown className="h-3 w-3 absolute right-2 top-2 text-gray-600 pointer-events-none" />
            <button
              onClick={() => setHeatmapVisible((prev) => !prev)}
              className="p-2 rounded-md border border-gray-200 hover:bg-gray-100"
              title={heatmapVisible ? "Hide heatmap" : "Show heatmap"}
            >
              {heatmapVisible ? <Eye className="h-4 w-4 text-gray-700" /> : <EyeOff className="h-4 w-4 text-gray-700" />}
            </button>
          </div>
        </div>
      </div>

      {/* Visualization Area */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex-1 rounded-xl bg-gray-900 border border-gray-200 shadow-inner flex flex-col overflow-hidden relative min-h-[450px]">
          
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-green-400 animate-spin" />
              <p className="text-sm text-gray-300">Running AI Model ({indexType})...</p>
            </div>
          ) : error ? (
            <div className="text-center p-4">
              <p className="text-red-400 text-sm mb-2">{error}</p>
              <button onClick={handleRefresh} className="text-xs bg-red-900/50 text-red-200 px-3 py-1 rounded border border-red-700">Retry</button>
            </div>
          ) : ndviData && heatmapUrl ? (
            <>
              <div className="relative h-full w-full">
                <MapContainer
                  center={mapCenter}
                  zoom={17}
                  className="h-full w-full"
                  style={{ minHeight: 450 }}
                  scrollWheelZoom
                >
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                  />
                  <FitPolygon polygon={polygonCoords} bounds={overlayBounds} />
                  {polygonCoords.length > 0 && (
                    <Polygon
                      positions={polygonCoords}
                      pathOptions={{
                        color: "#10b981",
                        weight: 2,
                        fillColor: "#10b981",
                        fillOpacity: 0.12,
                      }}
                    />
                  )}

                  {overlayBounds && heatmapUrl && (
                    <HeatmapImageOverlay
                      imageUrl={heatmapUrl}
                      bounds={overlayBounds}
                      polygon={polygonCoords}
                      opacity={heatmapOpacity}
                      visible={heatmapVisible}
                    />
                  )}
                </MapContainer>

                <div className="absolute left-3 bottom-3 z-[500] bg-black/70 text-white rounded-lg border border-white/10 p-3 space-y-2 shadow-lg">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-wide text-gray-200">Opacity</span>
                    <span className="text-xs font-semibold text-green-300">{Math.round(heatmapOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={heatmapOpacity}
                    onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
                    className="w-40 accent-green-400"
                  />
                  {!heatmapVisible && (
                    <p className="text-[11px] text-amber-200">Heatmap hidden</p>
                  )}
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-md p-4 text-white border-t border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-green-400">{indexType} Analysis</span>
                  <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded text-white border border-white/10">
                    Dominant: {dominantLabel}
                  </span>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {ndviData.statistics && Object.entries(ndviData.statistics).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-gray-300">{key}</span>
                      <span className="font-mono text-green-300">{val}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
             <div className="text-center text-gray-500">
                <p>No Data Available</p>
                <p className="text-xs mt-1">Select an index to analyze</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VegetationIndexCard;
