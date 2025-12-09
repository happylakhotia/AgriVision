import React, { useState } from "react";
import Navbar from "../components/dashboard/Navbar";
import Sidebar from "../components/dashboard/Sidebar";
import { useAuth } from "../contexts/authcontext/Authcontext";
import { Navigate, useNavigate } from "react-router-dom";
import { doSignOut } from "../firebase/auth";
import { useTranslation } from "react-i18next";

export default function PestScanner() {
  const { currentUser, userLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleLogout = async () => {
    try {
      await doSignOut();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (!userLoggedIn) return <Navigate to="/login" replace />;

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setFileName(f.name);
      setPreview(URL.createObjectURL(f)); // image preview
      setResult(null); // clear old result
    }
  };

  const checkPests = async () => {
    if (!file) return alert(t("pest_select_image"));

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:5000/api/pest/predict", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      alert(t("pest_server_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
      <Navbar currentUser={currentUser} onLogout={handleLogout} />
      <Sidebar />

      <div className="pt-28 lg:ml-64 px-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <h2 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            🦗 {t("pest_title")}
          </h2>
          <p className="text-gray-600 mb-6">
            {t("pest_subtitle")}
          </p>

          {/* MAIN CONTENT CARD */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-8 
                          grid grid-cols-1 lg:grid-cols-2 gap-10">

            {/* LEFT — IMAGE PREVIEW */}
            <div className="flex flex-col items-center">

              {/* Preview Box */}
              <div className="w-full h-96 bg-gray-100 rounded-xl border flex items-center justify-center overflow-hidden">
                {preview ? (
                  <img src={preview} className="w-full h-full object-cover" />
                ) : (
                  <p className="text-gray-400">{t("pest_no_image")}</p>
                )}
              </div>

              {/* Upload */}
              <label
                htmlFor="fileInput"
                className="mt-5 cursor-pointer bg-orange-600 hover:bg-orange-700 
                           text-white px-6 py-3 rounded-lg font-medium"
              >
                📸 {t("pest_upload")}
              </label>

              <input
                id="fileInput"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              {fileName && (
                <p className="text-gray-500 text-sm mt-2">{fileName}</p>
              )}
            </div>

            {/* RIGHT — RESULTS + BUTTON */}
            <div>
              {/* Scan Button */}
              <button
                disabled={loading}
                onClick={checkPests}
                className={`w-full py-4 rounded-lg text-white font-semibold text-lg transition 
                  ${loading ? "bg-gray-400" : "bg-orange-600 hover:bg-orange-700"}`}
              >
                {loading ? t("pest_scanning") : t("pest_scan_button")}
              </button>

              {loading && (
                <p className="text-orange-700 font-medium mt-3">
                  🐜 {t("pest_detecting")}
                </p>
              )}

{/* RESULTS */}
{result && (
  <div className="mt-8 space-y-6">

    {/* ====== DIAGNOSIS CARD (Red) ====== */}
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
  <div className="flex items-center gap-2 mb-1">
    <span className="text-red-600 text-xl">🩺</span>
    <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide">
      {t("pest_diagnosis_title")}
    </h3>
  </div>

  <div className="text-2xl font-extrabold text-red-700 leading-tight">

    {/* If SAFE */}
    {result.status === "SAFE" && t("pest_no_infection")}

    {/* If NOT SAFE → Show Pest Name Instead of Count */}
    {result.status !== "SAFE" &&
      `${result.report?.[0]?.pest || t("pest_detected")}`}
  </div>

  {result.status !== "SAFE" && (
    <p className="text-red-600 mt-1 text-sm">
      {t("pest_detected_desc")}
    </p>
  )}

  {result.status === "SAFE" && (
    <p className="text-red-600 mt-1 text-sm">
      {t("pest_safe_desc")}
    </p>
  )}
</div>


    {/* ====== SUGGESTED CURE CARD (Green) ====== */}
{result.status !== "SAFE" && (
  <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-green-700 text-xl">🌱</span>
      <h3 className="text-sm font-bold text-green-800 uppercase tracking-wide">
        {t("pest_cure_title")}
      </h3>
    </div>

    {/* Multiple pests → show multiple cures */}
    <div className="space-y-3">
      {result.report?.map((p, idx) => (
        <div
          key={idx}
          className="bg-white p-3 rounded-lg border border-green-200 shadow-inner 
                     flex justify-center items-center"
        >
          {/* Cure Text Centered */}
          <p className="text-gray-800 text-lg leading-relaxed text-center">
            {p.solution}
          </p>
        </div>
      ))}
    </div>
  </div>
)}



    {/* ====== BUY MEDICINE (Blue) ====== */}
    {result.status !== "SAFE" && (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-blue-700 text-xl">🛒</span>
          <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide">
            Buy Medicine
          </h3>
        </div>

      <div className="grid grid-cols-2 gap-3">

  {result.report?.map((p, idx) => (
    <a
      key={idx}
      href={p.links?.amazon}
      target="_blank"
      className="block bg-orange-500 hover:bg-orange-600 text-white 
                 text-sm text-center font-semibold py-2 rounded-md shadow-md"
    >
      Amazon
    </a>
  ))}

  {result.report?.map((p, idx) => (
    <a
      key={"f" + idx}
      href={p.links?.flipkart}
      target="_blank"
      className="block bg-blue-600 hover:bg-blue-700 text-white 
                 text-sm text-center font-semibold py-2 rounded-md shadow-md"
    >
      Flipkart
    </a>
  ))}

</div>

      </div>
    )}

  </div>
)}

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
