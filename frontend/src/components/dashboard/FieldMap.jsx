import React, { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useAuth } from "../../contexts/authcontext/Authcontext";
import { db } from "../../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";

const DEFAULT_CENTER = { lat: 17.3266, lng: 78.1695 };

const FieldMap = ({ field }) => {
  const { currentUser } = useAuth();
  const mapRef = useRef(null);
  const [savedCoordinates, setSavedCoordinates] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Prioritize field prop coordinates
    if (field && field.coordinates && field.coordinates.length > 0) {
      console.log("🎯 Using selected field coordinates:", field);
      setSavedCoordinates(field.coordinates);
      setLoading(false);
      return;
    }

    if (!currentUser) {
      setLoading(false);
      setSavedCoordinates(null);
      setUserLocation(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch field data from Firebase (fallback)
        const fieldRef = doc(db, "fields", currentUser.uid);
        const fieldSnap = await getDoc(fieldRef);
        if (fieldSnap.exists()) {
          const data = fieldSnap.data();
          setSavedCoordinates(Array.isArray(data.coordinates) ? data.coordinates : null);
        } else {
          setSavedCoordinates(null);
        }

        // Fetch user location
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.location) {
            setUserLocation({
              lat: userData.location.latitude,
              lng: userData.location.longitude
            });
          }
        }
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load data. Please try again later.");
        setSavedCoordinates(null);
        setUserLocation(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, field]);

  useEffect(() => {
    if (!mapRef.current) return;

    loadGoogleMaps(() => {
      // Use user location as center if available, otherwise use field centroid or default
      const center = computeCentroid(savedCoordinates) || userLocation || DEFAULT_CENTER;
      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: savedCoordinates?.length ? 17 : (userLocation ? 15 : 13),
        mapTypeId: "satellite",
      });

      if (savedCoordinates?.length) {
        new window.google.maps.Polygon({
          paths: savedCoordinates,
          strokeColor: "#00FF00",
          strokeWeight: 2,
          fillColor: "#00FF00",
          fillOpacity: 0.4,
          map,
        });

        new window.google.maps.Marker({
          position: center,
          map,
          icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 0 },
          label: {
            text: "Saved Field",
            color: "white",
            fontSize: "16px",
          },
        });
      } else if (userLocation) {
        // Show user location marker when no field is saved
        new window.google.maps.Marker({
          position: userLocation,
          map,
          title: "Your Location",
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      }
    });
  }, [savedCoordinates, userLocation]);

  function computeCentroid(coords) {
    if (!coords?.length) return null;
    const lat = coords.reduce((sum, point) => sum + (point.lat ?? 0), 0) / coords.length;
    const lng = coords.reduce((sum, point) => sum + (point.lng ?? 0), 0) / coords.length;
    return { lat, lng };
  }

  function loadGoogleMaps(callback) {
    if (window.google) {
      callback();
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=AIzaSyDKR_CVLRbV0lqjy_8JRWZAVDdO5Xl7jRk&libraries=places,drawing";
    script.async = true;
    script.defer = true;
    script.onload = callback;
    document.body.appendChild(script);
  }

  return (
    <div className="rounded-2xl border border-gray-200 shadow-md bg-white/70 backdrop-blur-xl">
      <div className="p-4 border-b border-gray-200 flex items-center gap-2 bg-white/50 backdrop-blur-md rounded-t-2xl">
        <MapPin className="h-5 w-5 text-green-600" />
        <h2 className="text-lg font-semibold text-gray-700">Map of {field.name}</h2>
      </div>

      <div className="p-4 space-y-3">
        {loading && (
          <p className="text-sm text-gray-500">Loading your saved field and location...</p>
        )}
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="relative h-[500px] rounded-2xl border border-gray-200 shadow-inner bg-gray-100 overflow-hidden">
          {!savedCoordinates?.length && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
              <p className="text-gray-700 font-medium text-lg">
                {userLocation ? "Draw your field in Farm Selection to see it here." : "Draw your field in Farm Selection to see it here."}
              </p>
              <p className="text-sm text-gray-500">
                {userLocation 
                  ? "We will show the exact area you drew on the Farm Selection map. Your current location is marked."
                  : "We will show the exact area you drew on the Farm Selection map."}
              </p>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full"></div>
        </div>
      </div>
    </div>
  );
};

export default FieldMap;
