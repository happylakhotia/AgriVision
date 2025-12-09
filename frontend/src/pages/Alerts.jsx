import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Bell,
  Trash2,
  Clock11,
  RefreshCw,
  Droplets,
  Activity,
  Bug,
  Leaf,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";

import { useAuth } from "../contexts/authcontext/Authcontext";
import { Navigate, useNavigate } from "react-router-dom";
import Navbar from "../components/dashboard/Navbar";
import Sidebar from "../components/dashboard/Sidebar";
import { doSignOut } from "../firebase/auth";

import { db } from "../firebase/firebase";
import { doc, getDoc, collection, query, where, onSnapshot, getDocs } from "firebase/firestore";

/* -------------------------------------------------------
   Utility: cn()
------------------------------------------------------- */
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/* -------------------------------------------------------
   UI Components
------------------------------------------------------- */
const Card = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  >
    {children}
  </div>
));
Card.displayName = "Card";

function Badge({ variant = "default", className, children }) {
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
    outline: "bg-transparent border text-foreground",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

const Button = React.forwardRef(({ variant = "default", size = "default", className, children, ...props }, ref) => {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    ghost: "bg-transparent hover:bg-accent",
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 px-3 text-sm",
  };
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
Button.displayName = "Button";

/* -------------------------------------------------------
   Tabs
------------------------------------------------------- */
function Tabs({ value, onValueChange, children }) {
  return <div>{React.Children.map(children, (child) => React.cloneElement(child, { value, onValueChange }))}</div>;
}

function TabsList({ value, onValueChange, children }) {
  return (
    <div className="inline-flex items-center gap-2">
      {React.Children.map(children, (child) => React.cloneElement(child, { selectedValue: value, onValueChange }))}
    </div>
  );
}

function TabsTrigger({ value: triggerValue, selectedValue, onValueChange, children }) {
  const isActive = triggerValue === selectedValue;
  return (
    <button
      onClick={() => onValueChange?.(triggerValue)}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all",
        isActive 
          ? "bg-gray-100 text-gray-900 shadow-sm" 
          : "bg-white text-gray-700 hover:bg-gray-50"
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------
   PRIORITY CONFIG
------------------------------------------------------- */
const priorityConfig = {
  high: { badgeVariant: "destructive", icon: AlertCircle, iconClass: "text-green-700" },
  medium: { badgeVariant: "default", icon: Clock, iconClass: "text-yellow-600" },
  low: { badgeVariant: "secondary", icon: CheckCircle2, iconClass: "text-green-600" },
};

/* =======================================================
   MAIN: Alerts (UI + LSTM integration)
   ======================================================= */
export default function Alerts() {
  const { currentUser, userLoggedIn } = useAuth();
  const navigate = useNavigate();

  // Alerts storage
  const [alerts, setAlerts] = useState({
    daily: [],
    weekly: [],
    biweekly: [],
  });

  const [selectedType, setSelectedType] = useState("daily");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userType, setUserType] = useState(null);
  const [chatAlerts, setChatAlerts] = useState([]);
  
  // Field selection for farmers
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [lastLoadedFieldId, setLastLoadedFieldId] = useState(null);
  
  // Descriptions for metrics
  const [descriptions, setDescriptions] = useState({});
  const [loadingDescriptions, setLoadingDescriptions] = useState({});

  const handleLogout = async () => {
    try {
      await doSignOut();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  useEffect(() => {
    const fetchUserType = async () => {
      if (!currentUser) {
        setUserType(null);
        return;
      }

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserType(data.userType || "farmer");
        } else {
          setUserType("farmer");
        }
      } catch (err) {
        console.error("Error fetching user type in Alerts:", err);
        setUserType("farmer");
      }
    };

    fetchUserType();
  }, [currentUser]);

  // Fetch fields for farmers
  useEffect(() => {
    const fetchFields = async () => {
      if (!currentUser || userType !== "farmer") {
        setFieldsLoading(false);
        return;
      }

      try {
        const fieldsRef = collection(db, "users", currentUser.uid, "fields");
        const fieldsSnapshot = await getDocs(fieldsRef);
        
        const fetchedFields = [];
        fieldsSnapshot.forEach((doc) => {
          fetchedFields.push({
            id: doc.id,
            name: doc.data().fieldName || "Unnamed Field",
            lat: doc.data().lat,
            lng: doc.data().lng,
            createdAt: doc.data().createdAt || new Date().toISOString(),
          });
        });

        // Sort by creation date
        fetchedFields.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        setFields(fetchedFields);
        
        // Auto-select first field if available
        if (fetchedFields.length > 0 && !selectedField) {
          setSelectedField(fetchedFields[0]);
        }
      } catch (err) {
        console.error("Error fetching fields:", err);
      } finally {
        setFieldsLoading(false);
      }
    };

    if (userType) {
      fetchFields();
    }
  }, [currentUser, userType]);

  /* ----------------------------------------------------
     CACHE UTILITIES
  ---------------------------------------------------- */
  const getCacheKey = (fieldId) => `alerts_cache_${currentUser?.uid}_${fieldId}`;
  
  const saveAlertsToCache = (fieldId, alertsData) => {
    if (!fieldId || !currentUser) return;
    try {
      const cacheData = {
        alerts: alertsData,
        timestamp: Date.now(),
        fieldId: fieldId,
      };
      const cacheKey = getCacheKey(fieldId);
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      // Dispatch custom event to notify dashboard
      window.dispatchEvent(new CustomEvent('alertsUpdated', {
        detail: { fieldId, cacheKey }
      }));
      
      console.log("Alerts saved to cache and event dispatched:", cacheKey);
    } catch (err) {
      console.error("Error saving alerts to cache:", err);
    }
  };

  const loadAlertsFromCache = (fieldId) => {
    if (!fieldId || !currentUser) return null;
    try {
      const cached = localStorage.getItem(getCacheKey(fieldId));
      if (!cached) return null;
      
      const cacheData = JSON.parse(cached);
      // Check if cache is for the same field
      if (cacheData.fieldId === fieldId) {
        return cacheData.alerts;
      }
      return null;
    } catch (err) {
      console.error("Error loading alerts from cache:", err);
      return null;
    }
  };

  /* ----------------------------------------------------
     2. LSTM API + convert into alert UI format (FULL)
  ---------------------------------------------------- */
  const API_URL = "https://itvi-1234-lstmnew.hf.space/predict";

  // small text cleaner
  const clean = (t) => {
    if (!t && t !== 0) return "";
    try {
      return String(t)
        .replace(/Day \d+:/gi, "")
        .replace(/Action:/gi, "")
        .replace(/Warning:/gi, "")
        .replace(/Status:/gi, "")
        .trim();
    } catch {
      return String(t);
    }
  };

  // collect + clean + dedupe advisory entries
  const getFullAdvisory = (adv) => {
    if (!adv) return [];
    const all = [
      ...(adv.alerts || []),
      ...(adv.action || []),
      ...(adv.warning || []),
      ...(adv.status || []),
    ];
    const cleaned = all.map((t) => clean(t)).filter(Boolean);
    // preserve order but remove exact duplicates
    const seen = new Set();
    const out = [];
    for (const item of cleaned) {
      if (!seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
    return out;
  };

  const buildAlert = (key, title, forecast = {}, advisory = {}, stressIndex = 0) => {
    // New LSTM fields include *_change and current_status; we use forecast values and attach deltas
    const ndvi = forecast.ndvi ?? forecast.NDVI ?? "-";
    const sm = forecast.sm ?? forecast.SM ?? "-";
    const disease = forecast.disease_risk ?? forecast.diseaseRisk ?? 0;
    const pest = forecast.pest_risk ?? forecast.pestRisk ?? 0;

    const ndviChange = forecast.ndvi_change ?? forecast.ndviChange ?? null;
    const smChange = forecast.sm_change ?? forecast.smChange ?? null;
    const diseaseChange = forecast.disease_change ?? forecast.diseaseChange ?? null;
    const pestChange = forecast.pest_change ?? forecast.pestChange ?? null;

    // priority: if any risk > 60 or stressIndex > 60 -> high
    const priority = (Number(disease) > 60 || Number(pest) > 60 || Number(stressIndex) > 60) ? "high" : "medium";

    return {
      id: `${key}_full`,
      title,
      metrics: {
        ndvi: ndvi,
        moisture: sm,
        diseaseRisk: Number(disease) || 0,
        pestRisk: Number(pest) || 0,
        stressIndex: Number(stressIndex) || 0,
        ndviChange,
        moistureChange: smChange,
        diseaseChange,
        pestChange,
      },
      priority,
      actions: getFullAdvisory(advisory),
      timestamp: title,
      raw: { forecast, advisory }, // keep raw if you want expansion later
    };
  };

  // Fetch descriptions for alert metrics
  const fetchDescriptions = async (alertId, metrics, advisoryActions = [], fieldId = null) => {
    try {
      // Create unique key that includes field ID to prevent conflicts between fields
      const descriptionKey = fieldId ? `${fieldId}_${alertId}` : alertId;
      
      setLoadingDescriptions(prev => ({ ...prev, [descriptionKey]: true }));
      
      console.log('Fetching descriptions for alert:', alertId, 'Field:', fieldId, metrics);
      
      const response = await fetch('http://localhost:5000/api/ai/alert-descriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          metrics,
          advisoryActions: advisoryActions || []
        }),
      });

      const data = await response.json();
      console.log('Description API response:', data);
      
      if (response.ok && data.success && data.descriptions) {
        console.log('Setting descriptions for alert:', descriptionKey, data.descriptions);
        setDescriptions(prev => ({
          ...prev,
          [descriptionKey]: data.descriptions
        }));
      } else {
        console.error('Failed to fetch descriptions:', data);
        // Set empty descriptions to avoid loading state
        setDescriptions(prev => ({
          ...prev,
          [descriptionKey]: {}
        }));
      }
    } catch (error) {
      console.error('Error fetching descriptions:', error);
      // Set empty descriptions on error
      const descriptionKey = fieldId ? `${fieldId}_${alertId}` : alertId;
      setDescriptions(prev => ({
        ...prev,
        [descriptionKey]: {}
      }));
    } finally {
      const descriptionKey = fieldId ? `${fieldId}_${alertId}` : alertId;
      setLoadingDescriptions(prev => ({ ...prev, [descriptionKey]: false }));
    }
  };

  const runLSTM = useCallback(async (latVal, lonVal) => {
    console.log("Running LSTM with coordinates:", latVal, lonVal);
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: latVal, lon: lonVal }),
      });

      console.log("LSTM API Response status:", resp.status);
      const result = await resp.json();
      console.log("LSTM API Result:", result);

      if (!result || !result.success) {
        setError("LSTM API returned unsuccessful response");
        setAlerts({ daily: [], weekly: [], biweekly: [] });
        setLoading(false);
        return;
      }

      const data = result.data || {};

      // Defensive checks for forecast + advisory_report
      const forecast = data.forecast || {};
      const advisory = data.advisory_report || {};

      // build one combined card per period (Option A)
      const newAlerts = {
        daily: [
          buildAlert(
            "day_1",
            "Tomorrow",
            forecast.day_1 || {},
            advisory.day_1 || {},
            data.stress_index ?? 0
          ),
        ],
        weekly: [
          buildAlert(
            "day_7",
            "Next Week",
            forecast.day_7 || {},
            advisory.day_7 || {},
            data.stress_index ?? 0
          ),
        ],
        biweekly: [
          buildAlert(
            "day_14",
            "Next Two Weeks",
            forecast.day_14 || {},
            advisory.day_14 || {},
            data.stress_index ?? 0
          ),
        ],
      };

      setAlerts(newAlerts);
      
      // Save to cache if we have a selected field
      if (selectedField?.id) {
        saveAlertsToCache(selectedField.id, newAlerts);
      }
      
      // Fetch descriptions for all alerts (include field ID to prevent conflicts)
      const fieldId = selectedField?.id || null;
      Object.values(newAlerts).flat().forEach(alert => {
        if (alert.metrics) {
          fetchDescriptions(alert.id, alert.metrics, alert.actions || [], fieldId);
        }
      });
      
      console.log("Alerts updated successfully");
      setLoading(false);
    } catch (err) {
      console.error("LSTM Fetch Error:", err);
      setError(err.message || "Failed to fetch alerts");
      setAlerts({ daily: [], weekly: [], biweekly: [] });
      setLoading(false);
    }
  }, []);

  /* ----------------------------------------------------
     1. Load Coordinates from Selected Field
  ---------------------------------------------------- */
  const loadFieldData = useCallback(async (forceRefresh = false) => {
    if (!selectedField) {
      console.log("No field selected");
      return;
    }

    console.log("Loading field data:", selectedField.name);
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedAlerts = loadAlertsFromCache(selectedField.id);
      if (cachedAlerts) {
        console.log("Loading alerts from cache");
        setAlerts(cachedAlerts);
        setLastLoadedFieldId(selectedField.id);
        setError(null);
        
        // Fetch descriptions for cached alerts too (with field ID)
        const fieldId = selectedField.id;
        Object.values(cachedAlerts).flat().forEach(alert => {
          if (alert.metrics) {
            fetchDescriptions(alert.id, alert.metrics, alert.actions || [], fieldId);
          }
        });
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      if (selectedField.lat && selectedField.lng) {
        // auto-run prediction for selected field
        await runLSTM(selectedField.lat, selectedField.lng);
        setLastLoadedFieldId(selectedField.id);
      } else {
        setError("Field coordinates not found. Please draw this field on the map.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Error loading field data:", err);
      setError("Failed to load field data");
      setLoading(false);
    }
  }, [selectedField, runLSTM, currentUser]);

  useEffect(() => {
    if (userType === "farmer" && selectedField && !fieldsLoading) {
      // Only load if field changed or we haven't loaded this field yet
      if (selectedField.id !== lastLoadedFieldId) {
        // Clear descriptions when field changes to prevent showing wrong descriptions
        setDescriptions({});
        setLoadingDescriptions({});
        loadFieldData();
      }
    }
  }, [selectedField?.id, userType, fieldsLoading, lastLoadedFieldId, loadFieldData]);

  useEffect(() => {
    if (!currentUser || userType !== "vendor") {
      return;
    }

    setLoading(true);
    setError(null);

    const convQuery = query(
      collection(db, "conversations"),
      where("participants", "array-contains", currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      convQuery,
      (snapshot) => {
        const items = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const participants = data.participants || [];
          const names = data.participantNames || {};
          const unreadFor = data.unreadFor || [];

          // Only show conversations where the current vendor has unread messages
          if (!unreadFor.includes(currentUser.uid)) {
            return;
          }

          const otherId =
            participants.find((id) => id !== currentUser.uid) || null;

          if (!otherId) {
            return;
          }

          const displayName = names[otherId] || "Farmer";

          items.push({
            id: docSnap.id,
            farmerName: displayName,
            lastMessage: data.lastMessageText || "",
            lastSenderName: data.lastMessageSenderName || "",
            updatedAt: data.updatedAt,
            otherUserId: otherId,
          });
        });

        items.sort((a, b) => {
          const ta =
            a.updatedAt && a.updatedAt.toMillis
              ? a.updatedAt.toMillis()
              : 0;
          const tb =
            b.updatedAt && b.updatedAt.toMillis
              ? b.updatedAt.toMillis()
              : 0;
          return tb - ta;
        });

        setChatAlerts(items);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading vendor chat notifications:", err);
        setError("Failed to load notifications");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, userType]);

  /* ----------------------------------------------------
     Delete Alert
  ---------------------------------------------------- */
  /* ----------------------------------------------------
     Send Alert via Agentic AI Webhook
  ---------------------------------------------------- */
  const sendAlertToAgenticAI = async (alert, showAlert = true) => {
    try {
      // Fetch user's name from Firestore
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      let userName = "Farmer";
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const firstName = userData.firstName || "";
        const lastName = userData.lastName || "";
        userName = `${firstName} ${lastName}`.trim() || userData.email?.split("@")[0] || "Farmer";
      }

      // Build the message from alert data
      let message = `Alert: ${alert.title}\n`;
      
      if (alert.metrics) {
        const metrics = alert.metrics;
        message += `\nMetrics:\n`;
        message += `- NDVI: ${metrics.ndvi}\n`;
        message += `- Soil Moisture: ${metrics.moisture}\n`;
        message += `- Disease Risk: ${metrics.diseaseRisk}%\n`;
        message += `- Pest Risk: ${metrics.pestRisk}%\n`;
        message += `- Stress Index: ${metrics.stressIndex}%\n`;
      }
      
      if (alert.actions && alert.actions.length > 0) {
        message += `\nActions Required:\n`;
        alert.actions.forEach((action, i) => {
          message += `${i + 1}. ${action}\n`;
        });
      }

      // Send to webhook with hardcoded phone and email
      const response = await fetch(
        "https://primary-production-569f.up.railway.app/webhook/a9d2af3a-197e-4127-9c42-4076bba6cf44",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            body: {
              name: userName,
              email: "omjain110305@gmail.com",
              phone: "7355074001",
              message: message,
            },
          }),
        }
      );

      if (response.ok) {
        console.log("Alert sent successfully to Agentic AI");
        if (showAlert) {
          alert("Alert sent successfully to phone number 7355074001!");
        }
        return true;
      } else {
        console.error("Failed to send alert:", response.statusText);
        if (showAlert) {
          alert("Failed to send alert. Please try again.");
        }
        return false;
      }
    } catch (error) {
      console.error("Error sending alert to Agentic AI:", error);
      if (showAlert) {
        alert("Error sending alert. Please check your connection and try again.");
      }
      return false;
    }
  };

  /* ----------------------------------------------------
     Send All Alerts for Current Period
  ---------------------------------------------------- */
  const sendAllAlerts = async () => {
    if (currentAlerts.length === 0) {
      alert("No alerts to send!");
      return;
    }

    const confirmSend = window.confirm(
      `Send ${currentAlerts.length} alert(s) to phone number 7355074001?`
    );
    
    if (!confirmSend) return;

    let successCount = 0;
    for (const alertItem of currentAlerts) {
      const success = await sendAlertToAgenticAI(alertItem, false);
      if (success) successCount++;
    }

    if (successCount === currentAlerts.length) {
      alert(`Successfully sent all ${currentAlerts.length} alerts to phone number 7355074001!`);
    } else {
      alert(`Sent ${successCount} out of ${currentAlerts.length} alerts. Some alerts failed to send.`);
    }
  };

  const deleteAlert = (id) => {
    setAlerts((prev) => {
      const next = { ...prev };
      for (const t of Object.keys(next)) {
        next[t] = next[t].filter((a) => a.id !== id);
      }
      return next;
    });
  };

  const currentAlerts = useMemo(() => alerts[selectedType] ?? [], [alerts, selectedType]);
  const isVendor = userType === "vendor";

  if (!userLoggedIn) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
      <Navbar currentUser={currentUser} onLogout={handleLogout} />
      <Sidebar />

      <main className="pt-20 lg:ml-64 px-6 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6 py-6">
          
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
                <Bell className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {isVendor ? "Vendor Notifications" : "Farm Alerts"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isVendor
                    ? "Notifications when farmers contact you via chat"
                    : "Smart alerts based on your farm's satellite data"}
                </p>
              </div>
            </div>
            
            {/* Field Selector & Refresh Button for Farmers */}
            {!isVendor && (
              <div className="flex items-center gap-3">
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
                
                {/* Refresh Button */}
              <button
                onClick={() => loadFieldData(true)}
                  disabled={loading || !selectedField}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh'}
              </button>
                
                {/* Send Alerts Button */}
                <button
                  onClick={sendAllAlerts}
                  disabled={loading || currentAlerts.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <Bell className="h-4 w-4" />
                  Send Alerts to Phone
                </button>
              </div>
            )}
          </div>

          {/* No Fields Message */}
          {!isVendor && fields.length === 0 && !fieldsLoading && (
            <Card className="p-8 text-center border-2 border-yellow-200 bg-yellow-50">
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="h-12 w-12 text-yellow-600" />
                <h3 className="text-lg font-semibold text-yellow-900">No Fields Found</h3>
                <p className="text-yellow-700 max-w-md">
                  Please add your fields in the Farm Selection page to get alerts for your farm.
                </p>
                <button
                  onClick={() => navigate("/farm-selection")}
                  className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Go to Farm Selection
                </button>
              </div>
            </Card>
          )}

          {/* Tabs */}
          {!isVendor && fields.length > 0 && (
          <Tabs value={selectedType} onValueChange={setSelectedType}>
            <TabsList value={selectedType} onValueChange={setSelectedType}>
              <TabsTrigger value="daily"><Clock11 className="h-4 w-4" /> Daily</TabsTrigger>
              <TabsTrigger value="weekly"><Clock className="h-4 w-4" /> Weekly</TabsTrigger>
              <TabsTrigger value="biweekly"><Clock className="h-4 w-4" /> Biweekly</TabsTrigger>
            </TabsList>
          </Tabs>
          )}

          {/* Loading State */}
          {loading && (
            <Card className="p-8 text-center border-2">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-green-600" />
                <p className="text-gray-600">Loading alerts from satellite data...</p>
              </div>
            </Card>
          )}

          {/* Error State */}
          {error && !loading && (
            <Card className="p-6 border-2 border-red-200 bg-red-50">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900">Error Loading Alerts</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  <button
                    onClick={() => loadFieldData(true)}
                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Alerts Grid */}
          {!loading && !error && !isVendor && (
          <div className="space-y-6">
            {currentAlerts.map((alert) => {
              const conf = priorityConfig[alert.priority] || priorityConfig.medium;
              const Icon = conf.icon;
              
              // Handle both new format (metrics) and old format (description)
              let metrics = alert.metrics;
              if (!metrics && alert.description) {
                // Parse old format description
                const desc = alert.description;
                const ndviMatch = desc.match(/NDVI\s*=\s*([^\n]+)/i);
                const smMatch = desc.match(/Moisture\s*=\s*([^\n]+)/i);
                const diseaseMatch = desc.match(/Disease Risk\s*=\s*(\d+)/i);
                const pestMatch = desc.match(/Pest Risk\s*=\s*(\d+)/i);
                
                metrics = {
                  ndvi: ndviMatch ? ndviMatch[1].trim() : "-",
                  moisture: smMatch ? smMatch[1].trim() : "-",
                  diseaseRisk: diseaseMatch ? parseInt(diseaseMatch[1]) : 0,
                  pestRisk: pestMatch ? parseInt(pestMatch[1]) : 0,
                  stressIndex: 0,
                };
              }
              
              if (!metrics) {
                metrics = {
                  ndvi: "-",
                  moisture: "-",
                  diseaseRisk: 0,
                  pestRisk: 0,
                  stressIndex: 0,
                };
              }

              // Helper function to get metric status color with variety
              const getMetricStatus = (value, type) => {
                if (type === 'ndvi') {
                  if (value === "-" || value === null || value === undefined) return { color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" };
                  const num = parseFloat(value);
                  if (isNaN(num)) return { color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" };
                  if (num >= 0.7) return { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" };
                  if (num >= 0.4) return { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" };
                  return { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" };
                }
                if (type === 'moisture') {
                  if (value === "-" || value === null || value === undefined) return { color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" };
                  const num = parseFloat(value);
                  if (isNaN(num)) return { color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" };
                  if (num >= 0.7) return { color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200" };
                  if (num >= 0.4) return { color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-200" };
                  return { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" };
                }
                if (type === 'diseaseRisk') {
                  const num = Number(value) || 0;
                  if (num >= 60) return { color: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
                  if (num >= 30) return { color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" };
                  return { color: "text-lime-600", bg: "bg-lime-50", border: "border-lime-200" };
                }
                if (type === 'pestRisk') {
                  const num = Number(value) || 0;
                  if (num >= 60) return { color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" };
                  if (num >= 30) return { color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-200" };
                  return { color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200" };
                }
                if (type === 'stressIndex') {
                  const num = Number(value) || 0;
                  if (num >= 60) return { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" };
                  if (num >= 30) return { color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" };
                  return { color: "text-green-600", bg: "bg-green-50", border: "border-green-200" };
                }
                return { color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" };
              };

              // Helper to style change badges consistently
              const getChangeBadge = (change) => {
                if (change === null || change === undefined || isNaN(change)) return null;
                const num = parseFloat(change);
                const sign = num > 0 ? "+" : "";
                let colorClasses = "bg-gray-50 text-gray-600 border-gray-200";
                if (num > 5) colorClasses = "bg-green-100 text-green-700 border-green-200";
                else if (num > 0) colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
                else if (num < -5) colorClasses = "bg-rose-100 text-rose-700 border-rose-200";
                else if (num < 0) colorClasses = "bg-amber-50 text-amber-700 border-amber-200";

                return {
                  label: num === 0 ? "No change" : `${sign}${num.toFixed(1)}%`,
                  colorClasses
                };
              };

              const ndviStatus = getMetricStatus(metrics.ndvi, 'ndvi');
              const moistureStatus = getMetricStatus(metrics.moisture, 'moisture');
              const diseaseStatus = getMetricStatus(metrics.diseaseRisk, 'diseaseRisk');
              const pestStatus = getMetricStatus(metrics.pestRisk, 'pestRisk');
              const stressStatus = getMetricStatus(metrics.stressIndex, 'stressIndex');

              // Color scheme based on priority - using green shades for all
              const priorityColors = {
                high: {
                  card: "border-green-400 bg-gradient-to-br from-green-50/60 to-white",
                  header: "bg-green-100/60 border-green-300",
                  iconBg: "bg-green-300",
                  advisory: "bg-amber-50/50 border-amber-200",
                  advisoryIcon: "bg-amber-200 text-amber-700",
                  advisoryDot: "bg-amber-500"
                },
                medium: {
                  card: "border-green-300 bg-gradient-to-br from-green-50/40 to-white",
                  header: "bg-green-100/40 border-green-200",
                  iconBg: "bg-green-200",
                  advisory: "bg-teal-50/50 border-teal-200",
                  advisoryIcon: "bg-teal-200 text-teal-700",
                  advisoryDot: "bg-teal-500"
                },
                low: {
                  card: "border-green-200 bg-gradient-to-br from-green-50/30 to-white",
                  header: "bg-green-100/30 border-green-200",
                  iconBg: "bg-green-200",
                  advisory: "bg-emerald-50/50 border-emerald-200",
                  advisoryIcon: "bg-emerald-200 text-emerald-700",
                  advisoryDot: "bg-emerald-500"
                }
              };

              const colors = priorityColors[alert.priority] || priorityColors.medium;

              return (
                <Card 
                  key={alert.id} 
                  className={cn(
                    "group overflow-hidden border-2 transition-all duration-300 shadow-md hover:shadow-xl",
                    colors.card
                  )}
                >
                  {/* Header Section */}
                  <div className={cn(
                    "px-6 py-5 border-b",
                    colors.header
                  )}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "rounded-lg p-2.5",
                          colors.iconBg
                        )}>
                          <Icon className={cn("h-5 w-5", conf.iconClass)} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{alert.title}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{alert.timestamp}</p>
                        </div>
                      </div>
                      <Badge 
                        variant={conf.badgeVariant} 
                        className={cn(
                          "capitalize text-xs px-2.5 py-1",
                          alert.priority === "high" && "animate-pulse bg-green-600 text-white border-green-700",
                          alert.priority === "medium" && "bg-green-500 text-white border-green-600",
                          alert.priority === "low" && "bg-green-400 text-white border-green-500"
                        )}
                      >
                        {alert.priority}
                      </Badge>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
                      {/* NDVI Metric */}
                      <div className={cn(
                        "rounded-lg p-4 border-2 bg-white transition-all hover:shadow-md min-h-[140px] flex flex-col",
                        ndviStatus.border,
                        "shadow-md"
                      )}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Leaf className={cn("h-4 w-4", ndviStatus.color)} />
                          <span className="text-xs font-semibold text-gray-700">NDVI</span>
                        </div>
                        <p className={cn("text-2xl font-bold mb-1", ndviStatus.color)}>
                          {metrics.ndvi === "-" || metrics.ndvi === null || metrics.ndvi === undefined 
                            ? "-" 
                            : (isNaN(parseFloat(metrics.ndvi)) ? "-" : parseFloat(metrics.ndvi).toFixed(2))}
                        </p>
                        {(() => {
                          const badge = getChangeBadge(metrics.ndviChange);
                          return badge ? (
                            <div className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border",
                              badge.colorClasses
                            )}>
                              <span>{badge.label}</span>
                              <span className="text-[10px] text-gray-500">vs prev</span>
                            </div>
                          ) : null;
                        })()}
                          <p className="text-xs text-gray-500 mb-2">Vegetation</p>
                        <div className="mt-auto pt-2 border-t border-gray-200">
                          {(() => {
                            const descKey = selectedField?.id ? `${selectedField.id}_${alert.id}` : alert.id;
                            return descriptions[descKey]?.ndvi ? (
                              <p className="text-xs text-gray-800 leading-relaxed font-medium">
                                {descriptions[descKey].ndvi}
                              </p>
                            ) : loadingDescriptions[descKey] ? (
                              <p className="text-xs text-gray-400 italic">Generating description...</p>
                            ) : (
                            <p className="text-xs text-gray-600 italic">
                              {(() => {
                                const ndvi = parseFloat(metrics.ndvi) || 0;
                                if (ndvi >= 0.7) return 'Excellent crop health. Vegetation is very healthy.';
                                if (ndvi >= 0.4) return 'Good crop health. Monitor regularly.';
                                if (ndvi >= 0.2) return 'Moderate health. Some areas need attention.';
                                return 'Poor health. Action may be required.';
                              })()}
                            </p>
                          );
                          })()}
                        </div>
                      </div>

                      {/* Moisture Metric */}
                      <div className={cn(
                        "rounded-lg p-4 border-2 bg-white transition-all hover:shadow-md min-h-[140px] flex flex-col",
                        moistureStatus.border,
                        "shadow-md"
                      )}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Droplets className={cn("h-4 w-4", moistureStatus.color)} />
                          <span className="text-xs font-semibold text-gray-700">Moisture</span>
                        </div>
                        <p className={cn("text-2xl font-bold mb-1", moistureStatus.color)}>
                          {metrics.moisture === "-" || metrics.moisture === null || metrics.moisture === undefined 
                            ? "-" 
                            : (isNaN(parseFloat(metrics.moisture)) ? "-" : parseFloat(metrics.moisture).toFixed(2))}
                        </p>
                        {(() => {
                          const badge = getChangeBadge(metrics.moistureChange);
                          return badge ? (
                            <div className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border",
                              badge.colorClasses
                            )}>
                              <span>{badge.label}</span>
                              <span className="text-[10px] text-gray-500">vs prev</span>
                            </div>
                          ) : null;
                        })()}
                          <p className="text-xs text-gray-500 mb-2">Soil</p>
                        <div className="mt-auto pt-2 border-t border-gray-200">
                          {(() => {
                            const descKey = selectedField?.id ? `${selectedField.id}_${alert.id}` : alert.id;
                            return descriptions[descKey]?.moisture ? (
                              <p className="text-xs text-gray-800 leading-relaxed font-medium">
                                {descriptions[descKey].moisture}
                              </p>
                            ) : loadingDescriptions[descKey] ? (
                              <p className="text-xs text-gray-400 italic">Generating description...</p>
                            ) : (
                            <p className="text-xs text-gray-600 italic">
                              {(() => {
                                const moisture = parseFloat(metrics.moisture) || 0;
                                if (moisture >= 60) return 'Adequate moisture. Irrigation may not be needed.';
                                if (moisture >= 40) return 'Moderate moisture. Monitor and irrigate if needed.';
                                return 'Soil is dry. Irrigation recommended.';
                              })()}
                            </p>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Disease Risk Metric */}
                      <div className={cn(
                        "rounded-lg p-4 border-2 bg-white transition-all hover:shadow-md min-h-[140px] flex flex-col",
                        diseaseStatus.border,
                        "shadow-md"
                      )}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Activity className={cn("h-4 w-4", diseaseStatus.color)} />
                          <span className="text-xs font-semibold text-gray-700">Disease</span>
                        </div>
                        <p className={cn("text-2xl font-bold mb-1", diseaseStatus.color)}>
                          {metrics.diseaseRisk}%
                        </p>
                        {(() => {
                          const badge = getChangeBadge(metrics.diseaseChange);
                          return badge ? (
                            <div className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border",
                              badge.colorClasses
                            )}>
                              <span>{badge.label}</span>
                              <span className="text-[10px] text-gray-500">vs prev</span>
                            </div>
                          ) : null;
                        })()}
                        <p className="text-xs text-gray-500 mb-2">Risk</p>
                        <div className="mt-auto pt-2 border-t border-gray-200">
                          {(() => {
                            const descKey = selectedField?.id ? `${selectedField.id}_${alert.id}` : alert.id;
                            return descriptions[descKey]?.diseaseRisk ? (
                              <p className="text-xs text-gray-800 leading-relaxed font-medium">
                                {descriptions[descKey].diseaseRisk}
                              </p>
                            ) : loadingDescriptions[descKey] ? (
                              <p className="text-xs text-gray-400 italic">Generating description...</p>
                            ) : (
                            <p className="text-xs text-gray-600 italic">
                              {(() => {
                                const risk = parseInt(metrics.diseaseRisk) || 0;
                                if (risk >= 60) return 'High disease risk. Take preventive measures immediately.';
                                if (risk >= 30) return 'Moderate risk. Monitor crops closely.';
                                return 'Low disease risk. Continue regular monitoring.';
                              })()}
                            </p>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Pest Risk Metric */}
                      <div className={cn(
                        "rounded-lg p-4 border-2 bg-white transition-all hover:shadow-md min-h-[140px] flex flex-col",
                        pestStatus.border,
                        "shadow-md"
                      )}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Bug className={cn("h-4 w-4", pestStatus.color)} />
                          <span className="text-xs font-semibold text-gray-700">Pest</span>
                        </div>
                        <p className={cn("text-2xl font-bold mb-1", pestStatus.color)}>
                          {metrics.pestRisk}%
                        </p>
                        {(() => {
                          const badge = getChangeBadge(metrics.pestChange);
                          return badge ? (
                            <div className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border",
                              badge.colorClasses
                            )}>
                              <span>{badge.label}</span>
                              <span className="text-[10px] text-gray-500">vs prev</span>
                            </div>
                          ) : null;
                        })()}
                        <p className="text-xs text-gray-500 mb-2">Risk</p>
                        <div className="mt-auto pt-2 border-t border-gray-200">
                          {(() => {
                            const descKey = selectedField?.id ? `${selectedField.id}_${alert.id}` : alert.id;
                            return descriptions[descKey]?.pestRisk ? (
                              <p className="text-xs text-gray-800 leading-relaxed font-medium">
                                {descriptions[descKey].pestRisk}
                              </p>
                            ) : loadingDescriptions[descKey] ? (
                              <p className="text-xs text-gray-400 italic">Generating description...</p>
                            ) : (
                            <p className="text-xs text-gray-600 italic">
                              {(() => {
                                const risk = parseInt(metrics.pestRisk) || 0;
                                if (risk >= 60) return 'High pest risk. Apply pest control measures.';
                                if (risk >= 30) return 'Moderate risk. Monitor for pest activity.';
                                return 'Low pest risk. Continue regular monitoring.';
                              })()}
                            </p>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Stress Index Metric */}
                      <div className={cn(
                        "rounded-lg p-4 border-2 bg-white transition-all hover:shadow-md min-h-[140px] flex flex-col",
                        stressStatus.border,
                        "shadow-md"
                      )}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <AlertCircle className={cn("h-4 w-4", stressStatus.color)} />
                          <span className="text-xs font-semibold text-gray-700">Stress</span>
                        </div>
                        <p className={cn("text-2xl font-bold mb-1", stressStatus.color)}>
                          {metrics.stressIndex}%
                        </p>
                        <p className="text-xs text-gray-500 mb-2">Index</p>
                        <div className="mt-auto pt-2 border-t border-gray-200">
                          {(() => {
                            const descKey = selectedField?.id ? `${selectedField.id}_${alert.id}` : alert.id;
                            return descriptions[descKey]?.stressIndex ? (
                              <p className="text-xs text-gray-800 leading-relaxed font-medium">
                                {descriptions[descKey].stressIndex}
                              </p>
                            ) : loadingDescriptions[descKey] ? (
                              <p className="text-xs text-gray-400 italic">Generating description...</p>
                            ) : (
                            <p className="text-xs text-gray-600 italic">
                              {(() => {
                                const stress = parseInt(metrics.stressIndex) || 0;
                                if (stress >= 60) return 'High crop stress. Check irrigation and nutrients.';
                                if (stress >= 30) return 'Moderate stress. Monitor conditions.';
                                return 'Low crop stress. Crops are healthy.';
                              })()}
                            </p>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Advisory Section */}
                    <div className={cn(
                      "rounded-lg p-5 border-2 bg-white shadow-md",
                      alert.priority === "high" ? "border-amber-300" :
                      alert.priority === "medium" ? "border-teal-300" :
                      "border-emerald-300"
                    )}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className={cn(
                          "rounded-md p-2",
                          colors.advisoryIcon
                        )}>
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <h4 className="text-base font-bold text-gray-900">Farm Advisory</h4>
                      </div>
                      <ul className="space-y-4 mb-4">
                        {(alert.actions && alert.actions.length > 0) ? (
                          alert.actions.map((a, i) => (
                            <li key={i} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-b-0 last:pb-0">
                              <div className={cn(
                                "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                                colors.advisoryDot
                              )} />
                              <div className="flex-1">
                                <span className="text-sm text-gray-900 leading-relaxed font-bold block">
                                  {a}
                                </span>
                              </div>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-gray-500 italic">No specific advisory available at this time.</li>
                        )}
                      </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 mt-6">
                      <Button 
                        variant="outline" 
                        onClick={() => sendAlertToAgenticAI(alert)}
                        className="px-6 border-blue-500 text-blue-600 hover:bg-blue-50"
                      >
                        <Bell className="h-4 w-4" /> Send to Phone
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={() => deleteAlert(alert.id)}
                        className="px-6 hover:bg-red-700"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          )}

          {!loading && !error && isVendor && (
          <div className="space-y-4">
            {chatAlerts.length === 0 ? (
              <Card className="p-12 text-center border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-white">
                <div className="flex flex-col items-center gap-4">
                  <div className="rounded-full bg-gray-100 p-4">
                    <Bell className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-gray-900">No new queries</p>
                    <p className="text-sm text-gray-600 mt-2">
                      You don't have any unread messages from farmers.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              chatAlerts.map((item) => (
                <Card
                  key={item.id}
                  className="group overflow-hidden border-2 border-green-200 bg-gradient-to-br from-green-50/50 to-white shadow-md hover:shadow-xl transition-all duration-300"
                >
                  {/* Header */}
                  <div className="px-6 py-4 border-b-2 border-green-200 bg-green-100/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 rounded-xl p-3 bg-green-200 shadow-sm">
                          <Bell className="h-6 w-6 text-green-700" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            New Query from {item.farmerName}
                          </h3>
                          {item.lastSenderName && (
                            <p className="text-sm text-gray-600 mt-1">
                              Last message by {item.lastSenderName}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant="default" 
                        className="capitalize text-sm px-3 py-1.5 bg-blue-600 text-white shadow-sm animate-pulse"
                      >
                        Unread
                      </Badge>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="p-6">
                    {item.lastMessage && (
                      <div className="rounded-xl p-5 bg-blue-50/50 border-2 border-blue-200 mb-6">
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {item.lastMessage}
                        </p>
                      </div>
                    )}
                    
                    <Button
                      variant="outline"
                      className="w-full border-2 hover:bg-green-50 hover:border-green-300 text-base py-6"
                      onClick={() => navigate(`/chat/${item.otherUserId}`)}
                    >
                      <Bell className="h-5 w-5 mr-2" />
                      Open Chat Conversation
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
          )}

          {/* Summary */}
          {!loading && !error && !isVendor && (
          <Card className="overflow-hidden border-2 border-green-400 bg-gradient-to-br from-green-50/60 to-white shadow-md hover:shadow-xl transition-all duration-300">
            {/* Header Section */}
            <div className="px-6 py-5 border-b bg-green-100/60 border-green-300">
              <div className="flex items-center gap-4">
                <div className="rounded-lg p-2.5 bg-green-300">
                  <Bell className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Alert Summary</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Total alerts for selected period</p>
                </div>
              </div>
            </div>
            
            {/* Content Section */}
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg p-4 border-2 border-green-300 bg-white shadow-md">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Total Alerts</p>
                  <p className="text-4xl font-bold text-green-700">{currentAlerts.length}</p>
                </div>
              </div>
            </div>
          </Card>
          )}

          {!loading && !error && isVendor && (
          <Card className="overflow-hidden border-2 border-green-400 bg-gradient-to-br from-green-50/60 to-white shadow-md hover:shadow-xl transition-all duration-300">
            {/* Header Section */}
            <div className="px-6 py-5 border-b bg-green-100/60 border-green-300">
              <div className="flex items-center gap-4">
                <div className="rounded-lg p-2.5 bg-green-300">
                  <Bell className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Notification Summary</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Total unread queries from farmers</p>
                </div>
              </div>
            </div>
            
            {/* Content Section */}
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg p-4 border-2 border-green-300 bg-white shadow-md">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Total Unread Queries</p>
                  <p className="text-4xl font-bold text-green-700">{chatAlerts.length}</p>
                </div>
              </div>
            </div>
          </Card>
          )}

        </div>
      </main>
    </div>
  );
}
