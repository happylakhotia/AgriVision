import React, { useState, useEffect } from "react";
import { Sprout, ChevronDown, RefreshCw, Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/authcontext/Authcontext";
import { db } from "../../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";

const VegetationIndexCard = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [ndviData, setNdviData] = useState(null);
  const [error, setError] = useState(null);
  const [coordinates, setCoordinates] = useState(null);
  
  // 🔥 Naya State: Default NDVI rahega
  const [indexType, setIndexType] = useState("NDVI");

  // 1. Fetch Field Coordinates
  useEffect(() => {
    const fetchFieldData = async () => {
      if (!currentUser) return;
      try {
        const fieldRef = doc(db, "fields", currentUser.uid);
        const fieldSnap = await getDoc(fieldRef);
        
        if (fieldSnap.exists()) {
          const data = fieldSnap.data();
          if (data.lat && data.lng) {
            setCoordinates({ lat: data.lat, lng: data.lng });
          }
        }
      } catch (err) {
        console.error("Error fetching field:", err);
      }
    };
    fetchFieldData();
  }, [currentUser]);

  // 2. Jb Coordinates mil jayein YA IndexType change ho, tab API call karo
  useEffect(() => {
    if (coordinates) {
      fetchAnalysis(coordinates.lat, coordinates.lng, indexType);
    }
  }, [coordinates, indexType]); // <--- indexType change hone par auto-refresh hoga

  const fetchAnalysis = async (lat, lng, type) => {
    setLoading(true);
    setError(null);
    setNdviData(null); // Purana data hatao loading ke time
    
    try {
      console.log(`🚀 Requesting ${type} Analysis...`);
      
      const response = await fetch("http://localhost:5000/api/analyze-ndvi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 🔥 Ab hum 'indexType' bhi bhej rahe hain
        body: JSON.stringify({ lat, lng, indexType: type }),
      });

      const data = await response.json();

      if (data.success) {
        setNdviData(data);
      } else {
        setError(`Failed to process ${type} data.`);
      }
    } catch (err) {
      console.error(err);
      setError("Server connection failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (coordinates) {
      fetchAnalysis(coordinates.lat, coordinates.lng, indexType);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 shadow-md bg-white/70 backdrop-blur-xl flex flex-col h-full">
      
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white/50 backdrop-blur-md rounded-t-2xl">
        <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Sprout className="h-5 w-5 text-green-600" />
          Vegetation Index
        </h3>

        <div className="flex gap-2">
          {coordinates && (
            <button 
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          
          <div className="relative">
            {/* 🔥 Dropdown ab 'indexType' state ko control karega */}
            <select
              value={indexType}
              onChange={(e) => setIndexType(e.target.value)}
              className="appearance-none w-28 px-3 py-1 bg-white border border-gray-300
                         rounded-md text-xs text-gray-700 font-medium focus:ring-2 
                         focus:ring-green-300 outline-none cursor-pointer"
            >
              <option value="NDVI">NDVI</option>
              <option value="EVI">EVI</option>
              <option value="SAVI">SAVI</option>
              <option value="MSAVI">MSAVI</option>
            </select>
            <ChevronDown className="h-3 w-3 absolute right-2 top-2 text-gray-600 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Visualization Area */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex-1 rounded-xl bg-gray-50 border border-gray-200 shadow-inner flex flex-col items-center justify-center overflow-hidden relative min-h-[300px]">
          
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
              <p className="text-sm text-gray-500">Processing {indexType} Data...</p>
            </div>
          ) : error ? (
            <div className="text-center p-4">
              <p className="text-red-500 text-sm mb-2">{error}</p>
              <button onClick={handleRefresh} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded">Try Again</button>
            </div>
          ) : ndviData && ndviData.heatmap_base64 ? (
            <>
              <img 
                src={`data:image/png;base64,${ndviData.heatmap_base64}`} 
                alt={`${indexType} Heatmap`} 
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-3 text-white">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-sm">Index: {indexType}</span>
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                    ndviData.dominant_condition?.includes('High') ? 'bg-green-500' : 'bg-yellow-500'
                  }`}>
                    {ndviData.dominant_condition}
                  </span>
                </div>
              </div>
            </>
          ) : (
             <div className="text-center text-gray-400">
                <p>No Data Available</p>
                <p className="text-xs mt-1">{coordinates ? `Select ${indexType} to analyze` : "Draw a field first"}</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VegetationIndexCard;