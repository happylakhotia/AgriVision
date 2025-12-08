import React, { useState } from "react";
import { useAuth } from "../../contexts/authcontext/Authcontext";
import { db } from "../../firebase/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const AddFieldModal = ({ open, onClose }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [fieldName, setFieldName] = useState("");
  const [area, setArea] = useState("");
  const [cropType, setCropType] = useState("Wheat");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      alert("Please login first!");
      return;
    }

    if (!fieldName || !area) {
      alert("Please fill in all required fields!");
      return;
    }

    setLoading(true);

    try {
      // Save to user's fields subcollection
      const fieldsCollectionRef = collection(db, "users", currentUser.uid, "fields");
      
      const fieldData = {
        fieldName,
        area: `${area} Acres`,
        cropName: cropType,
        ndvi: 0.72, // Default NDVI
        soil: 85, // Default soil health
        lat: null, // To be updated when user draws field
        lng: null,
        coordinates: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: currentUser.uid
      };
      
      await addDoc(fieldsCollectionRef, fieldData);
      
      alert("Field added successfully! You can now draw it on the map in Farm Selection.");
      
      // Reset form
      setFieldName("");
      setArea("");
      setCropType("Wheat");
      
      onClose();
      
      // Ask if user wants to go to Farm Selection to draw the field
      if (window.confirm("Would you like to go to Farm Selection to draw this field on the map?")) {
        navigate("/farm-selection");
      } else {
        // Reload to show new field
        window.location.reload();
      }
    } catch (error) {
      console.error("Error saving field:", error);
      alert(`Failed to save field: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Add Field Details</h3>

          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Field Name *
            </label>
            <input 
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="e.g., Field 1, North Field"
              className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-600"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Area (Acres) *
            </label>
            <input 
              type="number"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              step="0.1"
              placeholder="e.g., 2.5"
              className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-600"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Crop Type</label>
            <select 
              value={cropType}
              onChange={(e) => setCropType(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-600"
            >
              <option>Wheat</option>
              <option>Corn</option>
              <option>Soybean</option>
              <option>Rice</option>
              <option>Cotton</option>
              <option>Sugarcane</option>
              <option>Other</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-100"
            >
              Cancel
            </button>

            <button 
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? "Saving..." : "Save Field"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFieldModal;
