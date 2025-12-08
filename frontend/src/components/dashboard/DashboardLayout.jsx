import React, { useState, useEffect } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import StatsCards from "./StatsCards";
import FieldMap from "./FieldMap";
import VegetationIndexCard from "./VegetationIndexCard";
import NewsSection from "./NewsSection";
import KisanMitraChat from "./KisanMitraChat";
import { Bot, Trash2, MessageCircle } from "lucide-react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";

const DashboardLayout = ({ currentUser, onLogout }) => {
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alertsData, setAlertsData] = useState({ total: 0, highPriority: 0 });
  const [heatmapOverlay, setHeatmapOverlay] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  // Fetch alerts for selected field
  useEffect(() => {
    const fetchAlerts = async () => {
      if (!selectedField || !selectedField.lat || !selectedField.lng) {
        setAlertsData({ total: 0, highPriority: 0 });
        return;
      }

      try {
        const response = await fetch("http://localhost:5001/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: selectedField.lat,
            lng: selectedField.lng
          })
        });

        if (response.ok) {
          const data = await response.json();
          
          // Count total alerts and high priority alerts
          let total = 0;
          let highPriority = 0;

          ['daily', 'weekly', 'biweekly'].forEach(period => {
            if (data[period]) {
              total += 1; // Each period is one alert
              
              // Check if any risk is high (>60)
              const forecast = data[period];
              const disease = forecast.disease_risk ?? 0;
              const pest = forecast.pest_risk ?? 0;
              const stressIndex = forecast.water_stress_index ?? 0;
              
              if (Number(disease) > 60 || Number(pest) > 60 || Number(stressIndex) > 60) {
                highPriority += 1;
              }
            }
          });

          setAlertsData({ total, highPriority });
        } else {
          setAlertsData({ total: 0, highPriority: 0 });
        }
      } catch (err) {
        console.error("Error fetching alerts:", err);
        setAlertsData({ total: 0, highPriority: 0 });
      }
    };

    fetchAlerts();
  }, [selectedField]);

  // Fetch fields from Firebase
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchFields = async () => {
      try {
        console.log("🔍 Fetching fields for user:", currentUser.uid);
        
        // Fetch fields from subcollection
        const fieldsRef = collection(db, "users", currentUser.uid, "fields");
        const fieldsSnapshot = await getDocs(fieldsRef);
        
        const fetchedFields = [];
        fieldsSnapshot.forEach((doc) => {
          fetchedFields.push({
            id: doc.id,
            name: doc.data().fieldName || "Unnamed Field",
            area: doc.data().area || "N/A",
            ndvi: doc.data().ndvi || 0.72,
            soil: doc.data().soil || 85,
            lat: doc.data().lat,
            lng: doc.data().lng,
            coordinates: doc.data().coordinates || [],
            cropName: doc.data().cropName,
            createdAt: doc.data().createdAt || new Date().toISOString(),
            ...doc.data()
          });
        });

        // Sort fields by creation date (oldest first) to maintain field numbering
        fetchedFields.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        console.log("✅ Fetched fields:", fetchedFields);

        if (fetchedFields.length === 0) {
          // No fields found, create a default one
          console.log("⚠️ No fields found, using default");
          const defaultField = {
            id: "default",
            name: "My Field",
            area: "2.5 Acres",
            ndvi: 0.72,
            soil: 85,
            lat: null,
            lng: null,
            coordinates: []
          };
          setFields([defaultField]);
          setSelectedField(defaultField);
        } else {
          setFields(fetchedFields);
          
          // Check for saved field preference
          const userRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists() && userDoc.data().selectedFieldId) {
            const savedFieldId = userDoc.data().selectedFieldId;
            const savedField = fetchedFields.find(f => f.id === savedFieldId);
            if (savedField) {
              setSelectedField(savedField);
            } else {
              setSelectedField(fetchedFields[0]);
            }
          } else {
            // Default to first field
            setSelectedField(fetchedFields[0]);
          }
        }
      } catch (error) {
        console.error("❌ Error fetching fields:", error);
        // Fallback to default field
        const defaultField = {
          id: "default",
          name: "My Field",
          area: "2.5 Acres",
          ndvi: 0.72,
          soil: 85,
          lat: null,
          lng: null,
          coordinates: []
        };
        setFields([defaultField]);
        setSelectedField(defaultField);
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, [currentUser]);

  // Save selected field to user preferences
  const handleFieldChange = async (fieldId) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    
    setSelectedField(field);
    setHeatmapOverlay(null);
    
    // Save to Firebase
    if (currentUser) {
      try {
        const userRef = doc(db, "users", currentUser.uid);
        await setDoc(userRef, { selectedFieldId: fieldId }, { merge: true });
        console.log("✅ Saved field preference:", fieldId);
      } catch (error) {
        console.error("❌ Error saving field preference:", error);
      }
    }
  };

  // Delete field function
  const handleDeleteField = async (fieldId) => {
    if (!currentUser) return;
    
    const fieldToDelete = fields.find(f => f.id === fieldId);
    if (!fieldToDelete) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${fieldToDelete.name}"? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    try {
      // Delete from Firebase
      const fieldRef = doc(db, "users", currentUser.uid, "fields", fieldId);
      await deleteDoc(fieldRef);
      
      console.log("✅ Field deleted:", fieldId);
      
      // Update local state
      const updatedFields = fields.filter(f => f.id !== fieldId);
      setFields(updatedFields);
      
      // If deleted field was selected, select another field
      if (selectedField?.id === fieldId) {
        if (updatedFields.length > 0) {
          setSelectedField(updatedFields[0]);
          // Update user preference
          const userRef = doc(db, "users", currentUser.uid);
          await setDoc(userRef, { selectedFieldId: updatedFields[0].id }, { merge: true });
        } else {
          setSelectedField(null);
        }
      }
      
      alert(`Field "${fieldToDelete.name}" deleted successfully!`);
    } catch (error) {
      console.error("❌ Error deleting field:", error);
      alert(`Failed to delete field: ${error.message}`);
    }
  };

  return (
    <>
      <Navbar currentUser={currentUser} onLogout={onLogout} />
      <Sidebar />

      {/* Light green + glass effect */}
      <div
  className="
    pt-20 lg:ml-64 p-6 min-h-screen 
    bg-linear-to-br from-green-50 via-white to-green-100
  "
>
        <div className="max-w-screen-2xl mx-auto">

          {/* ✅ FIELD SELECTOR DROPDOWN */}
          {loading ? (
            <div className="mb-6 text-center text-gray-500">
              Loading fields...
            </div>
          ) : (
            <div className="mb-6 flex items-center gap-4 flex-wrap">
              <label className="text-sm font-semibold text-gray-700">
                Select Field:
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedField?.id || ""}
                  onChange={(e) => handleFieldChange(e.target.value)}
                  className="px-4 py-2 border border-green-200 bg-white rounded-lg shadow-sm focus:ring-2 focus:ring-green-400"
                >
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.name} ({field.area})
                    </option>
                  ))}
                </select>
                
                {/* Delete Field Button */}
                {selectedField && selectedField.id !== "default" && (
                  <button
                    onClick={() => handleDeleteField(selectedField.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete this field"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PASS SELECTED FIELD */}
          {selectedField && <StatsCards field={selectedField} totalFields={fields.length} alertsData={alertsData} />}

          {/* Larger map + larger vegetation card */}
          {selectedField && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* BIGGER FIELD MAP */}
            <div className="lg:col-span-2">
              <div className="h-[600px]">
                  <FieldMap field={selectedField} heatmapOverlay={heatmapOverlay} />
              </div>
            </div>

              {/* BIGGER VEGETATION INDEX - Matched to Field Map height */}
              <div className="h-[600px]">
                <VegetationIndexCard field={selectedField} onHeatmapReady={setHeatmapOverlay} />
            </div>

          </div>
          )}

          <NewsSection selectedField={selectedField} />
        </div>
      </div>

      {/* Floating Kisan Mitra Button */}
      {!isChatOpen && (
        <button
          onClick={() => {
            setIsChatOpen(true);
            setIsChatMinimized(false);
          }}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-green-600 hover:bg-green-700 text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center gap-3 z-40"
          aria-label="Open Kisan Mitra Chat"
        >
          <div className="relative">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
          </div>
          <div className="flex flex-col items-start">
            <span className="font-bold text-base sm:text-lg">Kisan Mitra</span>
            <span className="text-xs text-white">AI Assistant</span>
          </div>
        </button>
      )}

      {/* Kisan Mitra Chat Widget */}
      <KisanMitraChat
        isOpen={isChatOpen && !isChatMinimized}
        onClose={() => setIsChatOpen(false)}
        onMinimize={() => setIsChatMinimized(true)}
      />

      {/* Minimized Chat Button */}
      {isChatMinimized && (
        <button
          onClick={() => {
            setIsChatMinimized(false);
            setIsChatOpen(true);
          }}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center gap-2.5 z-40"
          aria-label="Restore Kisan Mitra Chat"
        >
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-green-600" />
          </div>
          <span className="font-bold text-sm sm:text-base">Kisan Mitra</span>
        </button>
      )}
    </>
  );
};

export default DashboardLayout;
