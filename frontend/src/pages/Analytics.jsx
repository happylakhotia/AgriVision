import React, { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area, ComposedChart, Bar, ScatterChart, Scatter, ReferenceLine
} from "recharts";
import { CloudRain, Sun, Droplets, Activity, Sprout, Wind, AlertTriangle } from "lucide-react";
import Navbar from "../components/dashboard/Navbar";
import Sidebar from "../components/dashboard/Sidebar";
import { useAuth } from "../contexts/authcontext/Authcontext";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { doSignOut } from "../firebase/auth";
import { useNavigate } from "react-router-dom";

const Analytics = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({
    avgNDVI: 0,
    waterStressDays: 0,
    totalRain: 0,
    diseaseRiskDays: 0
  });
  const [error, setError] = useState("");
  
  // Field selection
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [fieldsLoading, setFieldsLoading] = useState(true);

  const API_URL = "https://itvi-1234-newcollectordata.hf.space/generate_data";

  const handleLogout = () => {
    doSignOut().then(() => {
      navigate("/login");
    });
  };

  // Fetch user's fields
  useEffect(() => {
    const fetchFields = async () => {
      if (!currentUser) return;
      
      try {
        const fieldsRef = collection(db, "users", currentUser.uid, "fields");
        const fieldsSnap = await getDocs(fieldsRef);
        
        const fetchedFields = fieldsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort by creation date
        fetchedFields.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        setFields(fetchedFields);
        
        // Auto-select first field if available
        if (fetchedFields.length > 0) {
          setSelectedField(fetchedFields[0]);
        }
      } catch (err) {
        console.error("Error fetching fields:", err);
      } finally {
        setFieldsLoading(false);
      }
    };

    fetchFields();
  }, [currentUser]);

  // --- 🧠 SMART DATA PROCESSING ---
  const processData = (csvText) => {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",");
    
    let rawData = lines.slice(1).map(line => {
      const values = line.split(",");
      const obj = {};
      headers.forEach((header, index) => {
        const val = values[index];
        obj[header.trim()] = isNaN(val) ? val : parseFloat(val);
      });
      return obj;
    });

    // 1. Simulate Soil Moisture (Agar API me nahi hai)
    let currentMoisture = 50; 
    
    const processed = rawData.map((d, i) => {
      // Soil Moisture Logic
      if (d.precipitation > 0) {
        currentMoisture += d.precipitation * 2; 
      } else {
        currentMoisture -= (d.vpd * 0.8) + 0.5; 
      }
      currentMoisture = Math.max(10, Math.min(90, currentMoisture)); 

      // Cumulative GDD
      const prevGDD = i > 0 ? rawData[i-1].cum_gdd || 0 : 0;
      const cum_gdd = prevGDD + (d.gdd || 0);
      d.cum_gdd = cum_gdd;

      return {
        ...d,
        dateShort: d.date.substring(5), // MM-DD for X-Axis
        soil_moisture: d.soil_moisture || parseFloat(currentMoisture.toFixed(1)),
        ndvi_smooth: d.ndvi, 
      };
    });

    // 2. Apply Smoothing (7-Day Rolling Average)
    for (let i = 3; i < processed.length - 3; i++) {
      let sum = 0;
      for (let j = -3; j <= 3; j++) sum += processed[i+j].ndvi;
      processed[i].ndvi_smooth = parseFloat((sum / 7).toFixed(3));
    }

    return processed;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser || !selectedField || fieldsLoading) return;
      
      setLoading(true);
      setError("");
      
      try {
        // Use selected field's coordinates
        let lat = selectedField.lat || 31.22;
        let lon = selectedField.lng || 75.26;
        let fieldName = selectedField.name || "Field_1";

        // 2. Call API
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon, field_name: fieldName })
        });

        if (!response.ok) throw new Error("API Error");

        const csvText = await response.text();
        const finalData = processData(csvText);
        setData(finalData);

        // 3. Calculate KPI Stats
        const avgNDVI = finalData.reduce((s, d) => s + (d.ndvi || 0), 0) / finalData.length;
        const totalRain = finalData.reduce((s, d) => s + (d.precipitation || 0), 0);
        const stressDays = finalData.filter(d => d.vpd > 1.5).length;
        const diseaseDays = finalData.filter(d => d.leaf_wetness_hours > 10).length;

        setStats({
          avgNDVI: avgNDVI.toFixed(2),
          totalRain: totalRain.toFixed(0),
          waterStressDays: stressDays,
          diseaseRiskDays: diseaseDays
        });
      } catch (err) {
        console.error(err);
        setError("Failed to load data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, selectedField, fieldsLoading]);

  // --- 🛠 Custom Tooltip ---
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-xl rounded-lg z-50">
          <p className="text-xs font-bold text-gray-500 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="text-xs flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: entry.color }}></div>
              <span className="capitalize text-gray-700">{entry.name}:</span>
              <span className="font-bold text-gray-900">
                {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Show loading if fields are being fetched or data is loading
  if (fieldsLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-gray-500 font-medium animate-pulse">Loading fields...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar currentUser={currentUser} onLogout={handleLogout} />
      <Sidebar />

      <div className="pt-24 lg:ml-64 px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* No Fields Message */}
          {!fieldsLoading && fields.length === 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-center">
              <h2 className="text-xl font-bold text-yellow-900 mb-2">No Fields Found</h2>
              <p className="text-yellow-800 mb-4">
                You need to add at least one field to view analytics.
              </p>
              <button
                onClick={() => navigate("/farm-selection")}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Add Your First Field
              </button>
            </div>
          )}
          
          {/* Loading Data Indicator */}
          {loading && selectedField && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-gray-600 font-medium animate-pulse">
                Calculating Crop Metrics for {selectedField.name}...
              </p>
            </div>
          )}
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <p className="text-red-800 text-center">{error}</p>
            </div>
          )}
          
          {/* Show content only when we have data */}
          {!loading && !fieldsLoading && fields.length > 0 && data.length > 0 && (
            <>
          
          {/* HEADER */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics</h1>
              <p className="text-gray-500 mt-1">Satellite & Weather Intelligence for Precision Farming</p>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              {/* Field Selector */}
              {fields.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Field:
                  </label>
                  <select
                    value={selectedField?.id || ""}
                    onChange={(e) => {
                      const field = fields.find(f => f.id === e.target.value);
                      setSelectedField(field);
                    }}
                    className="min-w-[150px] px-4 py-2 border border-green-200 bg-white rounded-lg shadow-sm focus:ring-2 focus:ring-green-400 text-sm font-medium text-gray-900"
                  >
                    {fields.map((field, index) => (
                      <option key={field.id} value={field.id}>
                        Field {index + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Data Range Badge */}
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded border border-green-400 whitespace-nowrap">
                Data Range: Last 6 Months
              </span>
            </div>
          </div>

          {/* 📊 KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Avg Health (NDVI)" value={stats.avgNDVI} unit="Index" icon={Sprout} color="text-green-600" bg="bg-green-50" />
            <StatCard title="Total Rainfall" value={stats.totalRain} unit="mm" icon={CloudRain} color="text-blue-600" bg="bg-blue-50" />
            <StatCard title="High Stress Days" value={stats.waterStressDays} unit="days" icon={Sun} color="text-orange-600" bg="bg-orange-50" desc="VPD > 1.5 kPa" />
            <StatCard title="Disease Risk" value={stats.diseaseRiskDays} unit="days" icon={AlertTriangle} color="text-red-600" bg="bg-red-50" desc="High Leaf Wetness" />
          </div>

          {/* --- SECTION 1: WATER MANAGEMENT --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-blue-500" />
                  Soil Moisture vs Rainfall
                </h3>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dateShort" tick={{fontSize: 11}} minTickGap={30}/>
                    <YAxis yAxisId="left" label={{ value: 'Soil Moisture (%)', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Rain (mm)', angle: 90, position: 'insideRight' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={36}/>
                    <Bar yAxisId="right" dataKey="precipitation" name="Rainfall" fill="#60a5fa" barSize={10} radius={[4,4,0,0]} />
                    <Line yAxisId="left" type="monotone" dataKey="soil_moisture" name="Soil Moisture" stroke="#0ea5e9" strokeWidth={3} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* SCATTER PLOT: Soil vs NDVI */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-2">Moisture Efficiency</h3>
              <p className="text-xs text-gray-500 mb-6">Does more water equal better health?</p>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="soil_moisture" name="Soil Moisture" unit="%" domain={[0, 100]} label={{ value: 'Soil Moisture', position: 'bottom', offset: 0 }} />
                    <YAxis type="number" dataKey="ndvi" name="NDVI" unit="" domain={[0, 1]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                    <Scatter name="Health Correlation" data={data} fill="#16a34a" line={{stroke: "#16a34a", strokeWidth: 1}} lineType="fitting" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* --- SECTION 2: CROP STRESS & HEALTH (UPDATED) --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* VPD & TEMP */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Sun className="w-5 h-5 text-orange-500" />
                Water Stress (VPD) & Temperature
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dateShort" minTickGap={30} />
                    <YAxis yAxisId="left" label={{ value: 'VPD (kPa)', angle: -90, position: 'insideLeft' }}/>
                    <YAxis yAxisId="right" orientation="right" unit="°C"/>
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine yAxisId="left" y={1.5} label="High Stress" stroke="red" strokeDasharray="3 3" />
                    <Area yAxisId="left" type="monotone" dataKey="vpd" name="VPD (Stress)" stroke="#f97316" fill="#ffedd5" />
                    <Line yAxisId="right" type="monotone" dataKey="temperature_max" name="Max Temp" stroke="#ef4444" dot={false} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 🔥 MULTI-INDEX HEALTH (NDVI + EVI + SAVI + NDRE) */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-500" />
                Crop Health Indices Comparison
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dateShort" minTickGap={30} />
                    <YAxis domain={[0, 1]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="ndvi_smooth" name="NDVI (Smoothed)" stroke="#16a34a" strokeWidth={3} dot={false} />
                    
                    {/* 🔥 EVI Added Here */}
                    <Line type="monotone" dataKey="evi" name="EVI (Enhanced)" stroke="#2563eb" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                    
                    <Line type="monotone" dataKey="ndre" name="NDRE (Nitrogen)" stroke="#9333ea" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    <Line type="monotone" dataKey="savi" name="SAVI (Soil)" stroke="#ca8a04" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* --- SECTION 3: DISEASE & GROWTH --- */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Wind className="w-5 h-5 text-gray-600" />
              Disease Risk & Growth Tracking
            </h3>
            <p className="text-xs text-gray-500 mb-6">High Leaf Wetness + Moderate Temp = Fungal Risk</p>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dateShort" minTickGap={30} />
                  <YAxis yAxisId="left" label={{ value: 'Wet Hours', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'Cumulative GDD', angle: 90, position: 'insideRight' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="leaf_wetness_hours" name="Leaf Wetness (Hrs)" fill="#a5b4fc" />
                  <Line yAxisId="right" type="monotone" dataKey="cum_gdd" name="Crop Growth (GDD)" stroke="#f59e0b" strokeWidth={3} dot={false} />
                  {/* Disease Threshold Line */}
                  <ReferenceLine yAxisId="left" y={10} label="Disease Risk" stroke="red" strokeDasharray="3 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper Stats Component
const StatCard = ({ title, value, unit, icon: Icon, color, bg, desc }) => (
  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</p>
        <div className="flex items-baseline gap-1 mt-2">
          <span className={`text-3xl font-bold ${color}`}>{value}</span>
          <span className="text-xs text-gray-400 font-medium">{unit}</span>
        </div>
        {desc && <p className="text-[10px] text-gray-400 mt-1">{desc}</p>}
      </div>
      <div className={`p-2.5 rounded-lg ${bg}`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
    </div>
  </div>
);

export default Analytics;

