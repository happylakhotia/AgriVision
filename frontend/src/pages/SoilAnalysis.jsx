import React, { useState } from "react";
import Navbar from "../components/dashboard/Navbar";
import Sidebar from "../components/dashboard/Sidebar";
import { useAuth } from "../contexts/authcontext/Authcontext";
import { Navigate, useNavigate } from "react-router-dom";
import { doSignOut } from "../firebase/auth";

const SoilAnalysis = () => {
  const { currentUser, userLoggedIn } = useAuth();
  const navigate = useNavigate();
  
  const [sensorCode, setSensorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  const handleLogout = async () => {
    try {
      await doSignOut();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (!userLoggedIn) return <Navigate to="/login" replace />;

  const API_URL = "https://itvi-1234-npk.hf.space/predict";

  const analyzeData = async () => {
    // Reset states
    setError("");
    setResults(null);

    // Validation
    if (sensorCode.trim().length !== 30) {
      setError("⚠️ Error: Code must be exactly 30 digits.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: sensorCode.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data);
      } else {
        setError("Server Error: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      setError("❌ Connection Failed! Check your internet or API URL.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) {
      analyzeData();
    }
  };

  // Function to format text by removing markdown syntax and rendering properly
  const formatText = (text) => {
    if (!text) return "";
    
    // Remove markdown bold syntax (**text** or __text__) and make it bold
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, (match, content) => content)
      .replace(/__(.*?)__/g, (match, content) => content);
    
    // Remove markdown italic syntax (*text* or _text_)
    formatted = formatted
      .replace(/\*(.*?)\*/g, (match, content) => content)
      .replace(/_(.*?)_/g, (match, content) => content);
    
    // Split by lines to handle multi-line text
    const lines = formatted.split('\n').filter(line => line.trim() !== '');
    
    return lines.map((line, lineIndex) => {
      // Handle numbered lists (1. text) - remove the number prefix
      const numberedMatch = line.match(/^\d+\.\s(.+)$/);
      if (numberedMatch) {
        return (
          <React.Fragment key={lineIndex}>
            {lineIndex > 0 && <br />}
            <span>{numberedMatch[1]}</span>
          </React.Fragment>
        );
      }
      
      // Handle bullet points (- or *) - remove the bullet
      const bulletMatch = line.match(/^[-*]\s(.+)$/);
      if (bulletMatch) {
        return (
          <React.Fragment key={lineIndex}>
            {lineIndex > 0 && <br />}
            <span>{bulletMatch[1]}</span>
          </React.Fragment>
        );
      }
      
      return (
        <React.Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          <span>{line.trim()}</span>
        </React.Fragment>
      );
    });
  };

  // Function to format recommendations (handles both string and array)
  const formatRecommendation = (rec) => {
    if (typeof rec === 'string') {
      return formatText(rec);
    }
    return rec;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
      <Navbar currentUser={currentUser} onLogout={handleLogout} />
      <Sidebar />

      <div className="pt-20 lg:ml-64 px-8 pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">
              🌱 Smart Agriculture System
            </h1>
            <p className="text-gray-600 text-base">
              Enter your 30-digit sensor code to analyze soil health
            </p>
          </div>

          {/* Input Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <input
                type="text"
                value={sensorCode}
                onChange={(e) => {
                  setSensorCode(e.target.value);
                  setError("");
                }}
                onKeyPress={handleKeyPress}
                placeholder="e.g. 000200000200000200000100000100"
                maxLength={30}
                className="flex-1 w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg 
                         focus:outline-none focus:border-green-500 transition-colors
                         font-mono tracking-wider"
              />
              <button
                onClick={analyzeData}
                disabled={loading}
                className={`px-6 py-3 text-lg font-medium rounded-lg text-white transition-colors
                  ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
              >
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 text-center">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Loader */}
            {loading && (
              <div className="flex justify-center mt-6">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {/* Results Section */}
          {results && (
            <div className="space-y-6">
              {/* Sensor Values Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-white rounded-lg shadow-md border-t-4 border-green-500 p-5 text-center">
                  <h3 className="text-sm text-gray-600 mb-2">Nitrogen (N)</h3>
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {results.readings?.nitrogen || "--"}
                  </div>
                  <span className="text-xs text-gray-500">mg/kg</span>
                </div>

                <div className="bg-white rounded-lg shadow-md border-t-4 border-green-500 p-5 text-center">
                  <h3 className="text-sm text-gray-600 mb-2">Phosphorus (P)</h3>
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {results.readings?.phosphorus || "--"}
                  </div>
                  <span className="text-xs text-gray-500">mg/kg</span>
                </div>

                <div className="bg-white rounded-lg shadow-md border-t-4 border-green-500 p-5 text-center">
                  <h3 className="text-sm text-gray-600 mb-2">Potassium (K)</h3>
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {results.readings?.potassium || "--"}
                  </div>
                  <span className="text-xs text-gray-500">mg/kg</span>
                </div>

                <div className="bg-white rounded-lg shadow-md border-t-4 border-green-500 p-5 text-center">
                  <h3 className="text-sm text-gray-600 mb-2">Moisture</h3>
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {results.readings?.soil_moisture || "--"}
                  </div>
                  <span className="text-xs text-gray-500">%</span>
                </div>

                <div className="bg-white rounded-lg shadow-md border-t-4 border-green-500 p-5 text-center">
                  <h3 className="text-sm text-gray-600 mb-2">Temperature</h3>
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {results.readings?.air_temperature || "--"}
                  </div>
                  <span className="text-xs text-gray-500">°C</span>
                </div>
              </div>

              {/* Analysis Report */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                  📝 Analysis Report
                </h2>

                {/* Summary */}
                <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4 mb-6">
                  <div className="text-gray-800 font-medium leading-relaxed whitespace-pre-line">
                    {formatText(results.result?.summary || "Loading summary...")}
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Recommendations:
                  </h3>
                  <ul className="space-y-3">
                    {results.result?.recommendations?.map((rec, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 bg-gray-50 border-b border-gray-200 p-4 rounded-lg"
                      >
                        <span className="text-green-600 text-lg flex-shrink-0 mt-0.5">✅</span>
                        <div className="text-gray-800 leading-relaxed flex-1">
                          {formatRecommendation(rec)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SoilAnalysis;

