import React, { useState, useEffect } from "react";
import Navbar from "../components/dashboard/Navbar";
import Sidebar from "../components/dashboard/Sidebar";
import { useAuth } from "../contexts/authcontext/Authcontext";
import { Navigate, useNavigate } from "react-router-dom";
import { doSignOut } from "../firebase/auth";
import NewFieldMap from "../components/dashboard/NewFieldMap";
import { db } from "../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";
import { CheckCircle, ArrowRight } from "lucide-react";

const FarmSelection = () => {
  const { currentUser, userLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [showDrawer, setShowDrawer] = useState(false);
  const [savedFields, setSavedFields] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch existing fields
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchFields = async () => {
      try {
        const fieldsRef = collection(db, "users", currentUser.uid, "fields");
        const fieldsSnapshot = await getDocs(fieldsRef);
        
        const fields = [];
        fieldsSnapshot.forEach((doc) => {
          fields.push({
            id: doc.id,
            name: doc.data().fieldName || "Unnamed Field",
            area: doc.data().area || "N/A",
            cropName: doc.data().cropName,
            createdAt: doc.data().createdAt || new Date().toISOString(),
          });
        });
        
        // Sort fields by creation date (oldest first) to maintain field numbering
        fields.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        setSavedFields(fields);
      } catch (error) {
        console.error("Error fetching fields:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await doSignOut();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (!userLoggedIn) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
    
    <Navbar currentUser={currentUser} onLogout={handleLogout} />
    <Sidebar />

    <div className="pt-20 lg:ml-64 px-8 pb-8">

      <div className="mb-6 text-center">
        <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
          Farm Selection
        </h1>
        <p className="text-gray-600 mt-1 text-base">
          Draw your field boundaries on the map, add details, and save your farm information.
        </p>
      </div>

      {/* Saved Fields List */}
      {!loading && savedFields.length > 0 && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-green-900 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Your Saved Fields ({savedFields.length})
            </h3>
            <button
              onClick={() => navigate("/home")}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              View Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedFields.map((field, index) => (
              <div
                key={field.id}
                className="bg-white border border-green-200 rounded-lg p-3"
              >
                <div className="flex items-center gap-2">
                  <div className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{field.name}</p>
                    <p className="text-xs text-gray-600">
                      {field.area} • {field.cropName || "No crop"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <NewFieldMap showDrawer={showDrawer} setShowDrawer={setShowDrawer} />
    </div>
  </div>
  );
};

export default FarmSelection;
