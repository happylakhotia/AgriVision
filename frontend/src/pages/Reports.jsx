import React, { useState, useEffect } from "react";
import Navbar from "../components/dashboard/Navbar";
import Sidebar from "../components/dashboard/Sidebar";
import { useAuth } from "../contexts/authcontext/Authcontext";
import { Navigate, useNavigate } from "react-router-dom";
import { doSignOut } from "../firebase/auth";
import { FileText, Download, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";

const Reports = () => {
  const { currentUser, userLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (currentUser) {
      fetchFields();
    }
  }, [currentUser]);

  const fetchFields = async () => {
    try {
      const fieldsRef = collection(db, "users", currentUser.uid, "fields");
      const fieldsSnap = await getDocs(fieldsRef);
      
      const fetchedFields = fieldsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      fetchedFields.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setFields(fetchedFields);
      
      if (fetchedFields.length > 0 && !selectedFieldId) {
        setSelectedFieldId(fetchedFields[0].id);
      }
    } catch (err) {
      console.error("Error fetching fields:", err);
      setError("Failed to load fields");
    }
  };

  const handleLogout = async () => {
    try {
      await doSignOut();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const generateReport = async () => {
    if (!selectedFieldId) {
      setError("Please select a field first");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Get Firebase auth token
      const token = await currentUser.getIdToken();
      
      const response = await fetch("http://localhost:5000/api/report/generate", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fieldId: selectedFieldId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate report");
      }

      // Create blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agrivision-report-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess("Report generated and downloaded successfully!");
    } catch (err) {
      console.error("Error generating report:", err);
      setError(err.message || "Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!userLoggedIn) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
      <Navbar />
      <Sidebar />
      
      <div className="lg:ml-64 pt-20 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-8 h-8 text-green-600" />
              <h1 className="text-3xl font-bold text-gray-800">Generate Report</h1>
            </div>
            <p className="text-gray-600">
              Generate a comprehensive PDF report containing farmer details, field maps, 
              disease predictions, soil analysis, heat maps, and analytics graphs.
            </p>
          </div>

          {/* Field Selection */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Field</h2>
            
            {fields.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">No fields found. Please add a field first.</p>
                <button
                  onClick={() => navigate("/farm-selection")}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Go to Farm Selection
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose a field to generate report for:
                </label>
                <select
                  value={selectedFieldId}
                  onChange={(e) => setSelectedFieldId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.fieldName || "Unnamed Field"} - {field.cropName || "No Crop"} ({field.area || "N/A"})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Report Contents Preview */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Report Contents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-800">Farmer Details</p>
                  <p className="text-sm text-gray-600">Name, contact, and farm information</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-800">Field Map</p>
                  <p className="text-sm text-gray-600">Field boundaries and coordinates</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-800">Disease Prediction</p>
                  <p className="text-sm text-gray-600">If disease detection was used</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-800">Soil Analysis</p>
                  <p className="text-sm text-gray-600">If soil analysis was performed</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-800">Heat Maps</p>
                  <p className="text-sm text-gray-600">NDVI, NDRE, EVI, SAVI heat maps</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-800">Analytics Graphs</p>
                  <p className="text-sm text-gray-600">Weather and crop analytics data</p>
                </div>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-green-800 text-sm">{success}</p>
              </div>
            )}

            <button
              onClick={generateReport}
              disabled={loading || fields.length === 0 || !selectedFieldId}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Generate & Download PDF Report
                </>
              )}
            </button>

            <p className="text-sm text-gray-500 text-center mt-4">
              The report generation may take a few moments. Please be patient.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
