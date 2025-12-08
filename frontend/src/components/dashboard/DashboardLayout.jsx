import React, { useState, useEffect } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import StatsCards from "./StatsCards";
import FieldMap from "./FieldMap";
import VegetationIndexCard from "./VegetationIndexCard";
import NewsSection from "./NewsSection";
import AIAssistant from "./AIAssistant";
import { Bot, Trash2 } from "lucide-react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";

const DashboardLayout = ({ currentUser, onLogout }) => {
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [loading, setLoading] = useState(true);

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
          {selectedField && <StatsCards field={selectedField} />}

          {/* Larger map + larger vegetation card */}
          {selectedField && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* BIGGER FIELD MAP */}
              <div className="lg:col-span-2">
                <div className="h-[600px]">
                  <FieldMap field={selectedField} />
                </div>
              </div>

              {/* BIGGER VEGETATION INDEX */}
              <div className="h-[420px]">
                <VegetationIndexCard field={selectedField} />
              </div>

            </div>
          )}

          {/* AI ASSISTANCE SECTION */}
          <section
            id="ai-assistance"
            className="mt-10 scroll-mt-24"
            aria-label="AI Assistance"
          >
            {/* Section Header */}
            <div className="flex flex-col gap-2 mb-4 md:mb-6">
              <div className="inline-flex items-center gap-2 text-green-700 text-sm font-semibold bg-green-50 px-3 py-1 rounded-full w-fit border border-green-100">
                <Bot className="h-4 w-4" />
                <span>AI Assistance</span>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  Smart help for your farm
                </h2>
                <p className="text-sm md:text-base text-gray-600 mt-1 max-w-2xl">
                  Ask questions about soil health, fertilizer dose, irrigation, and pest control.
                  The AI will respond in simple farmer-friendly English.
                </p>
              </div>
            </div>

            {/* Section Body */}
            <div className="bg-white/80 backdrop-blur-sm border border-green-100 rounded-3xl shadow-lg shadow-green-100/40 p-3 md:p-4 lg:p-5">
              <AIAssistant />
            </div>
          </section>

          <NewsSection selectedField={selectedField} />
        </div>
      </div>
    </>
  );
};

export default DashboardLayout;
