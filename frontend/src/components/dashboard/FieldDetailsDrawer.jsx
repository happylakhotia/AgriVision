import React, { useState } from "react";
import { useAuth } from "../../contexts/authcontext/Authcontext";
import { db } from "../../firebase/firebase";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";

const FieldDetailsDrawer = ({ open, onClose, coordinates, centroid, suggestedFieldName = "", onSaveSuccess }) => {
  const { currentUser } = useAuth();
  const [cropName, setCropName] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [sowingDate, setSowingDate] = useState("");
  const [area, setArea] = useState("");
  const [radius, setRadius] = useState(""); // 🔥 NEW: Radius State
  const [loading, setLoading] = useState(false);

  // Pre-fill field name with suggestion when drawer opens
  React.useEffect(() => {
    if (open && suggestedFieldName && !fieldName) {
      setFieldName(suggestedFieldName);
    }
  }, [open, suggestedFieldName]);

  // Debug: Log when component mounts
  React.useEffect(() => {
    console.log("🎯 FieldDetailsDrawer mounted");
    console.log("DB object:", db);
    console.log("Current user:", currentUser);
  }, [currentUser]);

  const calculateArea = (coords) => {
    if (!coords || coords.length < 3) return 0;
    
    // Calculate area using shoelace formula (approximate)
    let area = 0;
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      area += coords[i].lat * coords[j].lng;
      area -= coords[j].lat * coords[i].lng;
    }
    area = Math.abs(area / 2);
    
    // Convert to acres (very rough approximation)
    // 1 degree ≈ 69 miles, 1 sq mile = 640 acres
    const sqDegrees = area;
    const sqMiles = sqDegrees * 69 * 69;
    const acres = sqMiles * 640;
    
    return acres.toFixed(2);
  };

  const handleSave = async () => {
    console.log("🔍 handleSave called");
    console.log("currentUser:", currentUser);
    console.log("centroid:", centroid);
    console.log("coordinates:", coordinates);

    if (!currentUser) {
      alert("User not authenticated!");
      return;
    }

    if (!centroid) {
      alert("Please draw a field on the map first!");
      return;
    }

    if (!cropName || !fieldName) {
      alert("Please fill in all required fields!");
      return;
    }

    setLoading(true);

    try {
      console.log("🔥 Attempting to save to Firestore...");
      console.log("User ID:", currentUser.uid);
      
      // Calculate area if not provided
      const calculatedArea = area || calculateArea(coordinates);
      
      // Save field to user's fields subcollection
      const fieldsCollectionRef = collection(db, "users", currentUser.uid, "fields");
      
      const fieldData = {
        cropName,
        fieldName,
        sowingDate,
        area: `${calculatedArea} Acres`,
        lat: centroid.lat,
        lng: centroid.lng,
        radius: radius ? parseFloat(radius) : 1.0, // 🔥 NEW: Save Radius (Default to 1.0 if empty)
        coordinates: coordinates || [],
        ndvi: 0.72, // Default NDVI value
        soil: 85, // Default soil health
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: currentUser.uid
      };
      
      console.log("📝 Field data to save:", fieldData);
      
      const docRef = await addDoc(fieldsCollectionRef, fieldData);
      
      // Also save to old structure for backward compatibility
      const legacyFieldRef = doc(db, "fields", currentUser.uid);
      await setDoc(legacyFieldRef, fieldData, { merge: true });

      console.log("✅ Field details saved successfully with ID:", docRef.id);
      alert(`Field "${fieldName}" saved successfully! You can now draw another field.`);
      
      // Reset form
      setCropName("");
      setFieldName("");
      setSowingDate("");
      setArea("");
      setRadius(""); // Reset radius
      
      // Call success callback
      if (onSaveSuccess) {
        onSaveSuccess();
      } else {
        onClose();
      }
    } catch (error) {
      console.error("❌ Error saving field details:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      alert(`Failed to save field details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-96 bg-white shadow-xl border-l border-gray-200 z-50 transform transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">Add Field Details</h2>
        <button onClick={onClose} className="text-gray-500 text-xl hover:text-gray-700">
          ✕
        </button>
      </div>

      {/* Form Content */}
      <div className="p-4 space-y-4">

        {/* Crop Name */}
        <div>
          <label className="block text-sm font-medium mb-1">Crop Name *</label>
          <input
            type="text"
            placeholder="Corn, Wheat…"
            value={cropName}
            onChange={(e) => setCropName(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-600"
          />
        </div>

        {/* Field Name */}
        <div>
          <label className="block text-sm font-medium mb-1">Field Name *</label>
          <input
            type="text"
            placeholder="North Block A"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-600"
          />
        </div>

        {/* Sowing Date */}
        <div>
          <label className="block text-sm font-medium mb-1">Sowing Date</label>
          <input
            type="date"
            value={sowingDate}
            onChange={(e) => setSowingDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-600"
          />
        </div>

        {/* Area */}
        <div>
          <label className="block text-sm font-medium mb-1">Area (Acres)</label>
          <input
            type="number"
            placeholder="Auto-calculated or enter manually"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            step="0.1"
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-600"
          />
        </div>

        {/* 🔥 NEW: Radius Input */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Scan Radius (km) <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="5"
            placeholder="Default: 1.0 km"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-600"
          />
          <p className="text-xs text-gray-500 mt-1">
            Distance from center to scan (e.g. 0.5 for small fields)
          </p>
        </div>

        {/* Coordinates Info */}
        {centroid && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm">
            <p className="font-medium text-green-800">✓ Field Area Selected</p>
            <p className="text-green-600 text-xs mt-1">
              Lat: {centroid.lat.toFixed(6)}, Lng: {centroid.lng.toFixed(6)}
            </p>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className={`w-full text-white py-2 rounded-md mt-4 ${
            loading 
              ? "bg-gray-400 cursor-not-allowed" 
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {loading ? "Saving..." : "Save Field Details"}
        </button>
      </div>
    </div>
  );
};

export default FieldDetailsDrawer;
