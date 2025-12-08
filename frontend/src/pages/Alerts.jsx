import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Bell,
  Trash2,
  Clock11,
  RefreshCw
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
    <div className="inline-flex h-10 w-full max-w-md items-center gap-1 rounded-md bg-muted p-1 text-muted-foreground">
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
        "inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-sm transition-all",
        isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60"
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
  high: { badgeVariant: "destructive", icon: AlertCircle, iconClass: "text-destructive" },
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
    const ndvi = forecast.ndvi ?? forecast.NDVI ?? "-";
    const sm = forecast.sm ?? forecast.SM ?? "-";
    const disease = forecast.disease_risk ?? 0;
    const pest = forecast.pest_risk ?? 0;

    // priority: if any risk > 60 or stressIndex > 60 -> high
    const priority = (Number(disease) > 60 || Number(pest) > 60 || Number(stressIndex) > 60) ? "high" : "medium";

    return {
      id: `${key}_full`,
      title,
      description: `NDVI = ${ndvi}\nMoisture = ${sm}\nDisease Risk = ${disease}%\nPest Risk = ${pest}%`,
      priority,
      actions: getFullAdvisory(advisory),
      timestamp: title,
      raw: { forecast, advisory }, // keep raw if you want expansion later
    };
  };

  const runLSTM = useCallback(async (latVal, lonVal) => {
    console.log("🌾 Running LSTM with coordinates:", latVal, lonVal);
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: latVal, lon: lonVal }),
      });

      console.log("📡 LSTM API Response status:", resp.status);
      const result = await resp.json();
      console.log("📊 LSTM API Result:", result);

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
            "Day 1 (Tomorrow)",
            forecast.day_1 || {},
            advisory.day_1 || {},
            data.stress_index ?? 0
          ),
        ],
        weekly: [
          buildAlert(
            "day_7",
            "Day 7 (Next Week)",
            forecast.day_7 || {},
            advisory.day_7 || {},
            data.stress_index ?? 0
          ),
        ],
        biweekly: [
          buildAlert(
            "day_14",
            "Day 14 (Two Weeks)",
            forecast.day_14 || {},
            advisory.day_14 || {},
            data.stress_index ?? 0
          ),
        ],
      };

      setAlerts(newAlerts);
      console.log("✅ Alerts updated successfully");
      setLoading(false);
    } catch (err) {
      console.error("❌ LSTM Fetch Error:", err);
      setError(err.message || "Failed to fetch alerts");
      setAlerts({ daily: [], weekly: [], biweekly: [] });
      setLoading(false);
    }
  }, []);

  /* ----------------------------------------------------
     1. Load Coordinates from Selected Field
  ---------------------------------------------------- */
  const loadFieldData = useCallback(async () => {
    if (!selectedField) {
      console.log("⚠️ No field selected");
      return;
    }

    console.log("🔍 Loading field data:", selectedField.name);
    setLoading(true);
    setError(null);

    try {
      if (selectedField.lat && selectedField.lng) {
        // auto-run prediction for selected field
        await runLSTM(selectedField.lat, selectedField.lng);
      } else {
        setError("Field coordinates not found. Please draw this field on the map.");
        setLoading(false);
      }
    } catch (err) {
      console.error("❌ Error loading field data:", err);
      setError("Failed to load field data");
      setLoading(false);
    }
  }, [selectedField, runLSTM]);

  useEffect(() => {
    if (userType === "farmer" && selectedField && !fieldsLoading) {
      loadFieldData();
    }
  }, [selectedField, userType, fieldsLoading]);

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
                      className="px-4 py-2 border border-green-200 bg-white rounded-lg shadow-sm focus:ring-2 focus:ring-green-400 text-sm"
                    >
                      {fields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Refresh Button */}
                <button
                  onClick={loadFieldData}
                  disabled={loading || !selectedField}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Loading...' : 'Refresh'}
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
                    onClick={loadFieldData}
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currentAlerts.map((alert) => {
              const conf = priorityConfig[alert.priority] || priorityConfig.medium;
              const Icon = conf.icon;

              return (
                <Card key={alert.id} className="group p-6 border-2 hover:shadow-lg hover:scale-[1.02] transition-all">
                  <div className="relative space-y-4">

                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-md bg-muted/40 p-1.5">
                          <Icon className={cn("h-5 w-5", conf.iconClass)} />
                        </div>
                        <div>
                          <h3 className="font-semibold">{alert.title}</h3>
                          <p className="text-xs text-muted-foreground">{alert.timestamp}</p>
                        </div>
                      </div>
                      <Badge variant={conf.badgeVariant} className="capitalize">{alert.priority}</Badge>
                    </div>

                    {/* Description */}
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{alert.description}</pre>

                    {/* Action List */}
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-semibold uppercase">Advisory</p>
                      <ul className="space-y-1.5">
                        {(alert.actions && alert.actions.length > 0) ? (
                          alert.actions.map((a, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              <span className="text-muted-foreground">{a}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-xs text-gray-400">No specific advisory.</li>
                        )}
                      </ul>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-3">
                      <Button variant="outline" className="flex-1">View Details</Button>
                      <Button variant="destructive" onClick={() => deleteAlert(alert.id)}>
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {chatAlerts.length === 0 ? (
              <Card className="p-6 border-2 bg-card/70">
                <div className="space-y-2">
                  <p className="font-semibold">No new queries</p>
                  <p className="text-sm text-muted-foreground">
                    You don't have any unread messages from farmers.
                  </p>
                </div>
              </Card>
            ) : (
              chatAlerts.map((item) => (
                <Card
                  key={item.id}
                  className="group p-6 border-2 hover:shadow-lg hover:scale-[1.02] transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-md bg-muted/40 p-1.5">
                          <Bell className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">
                            New query from {item.farmerName}
                          </h3>
                          {item.lastSenderName && (
                            <p className="text-xs text-muted-foreground">
                              Last message by {item.lastSenderName}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="default" className="capitalize">
                        Unread
                      </Badge>
                    </div>
                    {item.lastMessage && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {item.lastMessage}
                      </p>
                    )}
                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/chat/${item.otherUserId}`)}
                      >
                        Open Chat
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
          )}

          {/* Summary */}
          {!loading && !error && !isVendor && (
          <Card className="p-6 border-2 bg-card/70">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total alerts</p>
                <p className="text-3xl font-bold">{currentAlerts.length}</p>
              </div>
            </div>
          </Card>
          )}

          {!loading && !error && isVendor && (
          <Card className="p-6 border-2 bg-card/70">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total unread queries</p>
                <p className="text-3xl font-bold">{chatAlerts.length}</p>
              </div>
            </div>
          </Card>
          )}

        </div>
      </main>
    </div>
  );
}
