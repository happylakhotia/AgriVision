import React, { useState, useEffect } from "react";
import Navbar from "../components/dashboard/Navbar";
import Sidebar from "../components/dashboard/Sidebar";
import { useAuth } from "../contexts/authcontext/Authcontext";
import { Navigate, useNavigate } from "react-router-dom";
import { doSignOut } from "../firebase/auth";
import { rtdb } from "../firebase/firebase";
import { ref, query, limitToLast, get, orderByKey, remove } from "firebase/database";
import { useTranslation } from "react-i18next";

const SoilAnalysis = () => {
  const { currentUser, userLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleLogout = async () => {
    try {
      await doSignOut();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (!userLoggedIn) return <Navigate to="/login" replace />;

  const fetchLatestSoilData = async () => {
    setError("");
    setLoading(true);
    try {
      const soilRef = ref(rtdb, "soil");
      const soilQuery = query(soilRef, orderByKey(), limitToLast(10));
      const snapshot = await get(soilQuery);

      if (!snapshot.exists()) {
        setError(t("soil_no_data"));
        setResults(null);
        setEntries([]);
        return;
      }

      const data = snapshot.val();
      const list = Object.entries(data).map(([key, value]) => ({
        id: key,
        ...value,
      }));

      list.sort((a, b) => (a.id < b.id ? 1 : -1));

      setEntries(list);
      const latest = list[0];
      setSelectedEntry(latest.id);
      setResults({
        readings: {
          nitrogen: latest.nitrogen ?? "--",
          phosphorus: latest.phosphorous ?? latest.phosphorus ?? "--",
          potassium: latest.potassium ?? "--",
          soil_moisture: latest.moisture ?? "--",
          air_temperature: latest.temperature ?? "--",
          humidity: latest.humidity ?? "--",
        },
        sourceId: latest.id,
      });
    } catch (err) {
      console.error(err);
      setError(t("soil_load_failed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestSoilData();
  }, []);

  const handleSelectChange = (e) => {
    const entry = entries.find((item) => item.id === e.target.value);
    if (!entry) return;
    setSelectedEntry(entry.id);
    setResults({
      readings: {
        nitrogen: entry.nitrogen ?? "--",
        phosphorus: entry.phosphorous ?? entry.phosphorus ?? "--",
        potassium: entry.potassium ?? "--",
        soil_moisture: entry.moisture ?? "--",
        air_temperature: entry.temperature ?? "--",
        humidity: entry.humidity ?? "--",
      },
      sourceId: entry.id,
    });
  };

  const handleDelete = async () => {
    if (!selectedEntry) return;
    const confirmed = window.confirm(t("soil_delete_confirm"));
    if (!confirmed) return;
    setDeleting(true);
    setError("");
    try {
      await remove(ref(rtdb, `soil/${selectedEntry}`));
      // Refresh list
      await fetchLatestSoilData();
    } catch (err) {
      console.error(err);
      setError(t("soil_delete_failed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
      <Navbar currentUser={currentUser} onLogout={handleLogout} />
      <Sidebar />

      {/* Increased spacing below navbar */}
      <div className="pt-28 lg:ml-64 px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">
              🌱 {t("soil_title")}
            </h1>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <button
                onClick={fetchLatestSoilData}
                disabled={loading}
                className={`px-6 py-3 text-lg font-medium rounded-lg text-white transition-colors
                  ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
              >
                {loading ? t("loading") : t("soil_refresh")}
              </button>

              {entries.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <label className="text-sm font-semibold text-gray-700">
                    {t("soil_record_label")}
                  </label>
                  <select
                    value={selectedEntry || ""}
                    onChange={handleSelectChange}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-400"
                  >
                    {entries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.id}
                      </option>
                    ))}
                  </select>
                    <button
                      onClick={handleDelete}
                      disabled={!selectedEntry || deleting}
                      className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors
                        ${
                          !selectedEntry || deleting
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-red-500 hover:bg-red-600"
                        }`}
                    >
                      {deleting ? t("soil_deleting") : t("soil_delete")}
                    </button>
                </div>
              )}
            </div>

            <div className="mt-4 text-sm text-gray-500 text-center sm:text-left">
              {t("soil_description")}
            </div>

            {error && (
              <div className="mt-4 text-center">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {loading && (
              <div className="flex justify-center mt-6">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin"></div>
              </div>
            )}

            {!loading && !error && !results && (
              <div className="mt-6 text-center text-sm text-gray-600 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
                {t("soil_no_readings")}
              </div>
            )}
          </div>

          {results && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t("soil_snapshot_title")}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {t("soil_snapshot_sub")}
                  </p>
                </div>
                {results.sourceId && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700">
                    {t("soil_id_prefix")} {results.sourceId}
                  </span>
                )}
              </div>

              {/* Sensor Values Grid */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 md:gap-10">
  {[
    { label: t("soil_label_n"), value: results.readings?.nitrogen, unit: t("soil_unit_mgkg") },
    { label: t("soil_label_p"), value: results.readings?.phosphorus, unit: t("soil_unit_mgkg") },
    { label: t("soil_label_k"), value: results.readings?.potassium, unit: t("soil_unit_mgkg") },
    { label: t("soil_label_moisture"), value: results.readings?.soil_moisture, unit: t("soil_unit_percent") },
    { label: t("soil_label_temp"), value: results.readings?.air_temperature, unit: t("soil_unit_temp") },
    { label: t("soil_label_humidity"), value: results.readings?.humidity, unit: t("soil_unit_percent") },
  ].map((item, index) => (
    <div
      key={index}
      className="
        bg-white 
        min-w-[170px]
        rounded-xl 
        shadow-md 
        border border-gray-200 
        border-t-4 border-green-500 
        p-6 
        flex flex-col items-center justify-center 
        transition-all duration-200 
        hover:-translate-y-1 hover:shadow-lg hover:border-green-400 
      "
    >
      <h3 className="text-base font-semibold text-gray-700 mb-3 text-center">
        {item.label}
      </h3>

      <div className="text-3xl font-bold text-gray-900 flex items-baseline justify-center gap-2">
        <span>{item.value || "--"}</span>
        <span className="text-sm font-semibold text-gray-500">{item.unit}</span>
      </div>
    </div>
  ))}
</div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SoilAnalysis;
