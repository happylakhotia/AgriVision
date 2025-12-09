import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { CloudRain, Cloud, Sun, CloudDrizzle, Wind, Thermometer, MapPin, Loader2, RefreshCw, AlertTriangle, MapPinned } from "lucide-react";
import { useAuth } from "../../contexts/authcontext/Authcontext";
import { db } from "../../firebase/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";

const OPENWEATHER_API_KEY = "6af24b4f823c9044d1cbad4c94379de5";
const OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5";

const NewsSection = ({ selectedField }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fieldLocation, setFieldLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [usingFieldLocation, setUsingFieldLocation] = useState(false);
  const [locationAttempted, setLocationAttempted] = useState(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Update field location when selectedField changes
  useEffect(() => {
    if (selectedField && selectedField.lat && selectedField.lng) {
      console.log("Using selected field coordinates:", selectedField);
      setFieldLocation({
        latitude: selectedField.lat,
        longitude: selectedField.lng
      });
      setUsingFieldLocation(true);
    }
  }, [selectedField]);

  useEffect(() => {
    if (currentUser) {
      console.log("Current user detected, fetching field and location data...");
      fetchFieldAndLocation();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const fetchFieldAndLocation = async () => {
    if (!currentUser) {
      console.log("No current user");
      setLoading(false);
      return;
    }

    try {
      console.log(`Fetching field and location data (attempt ${retryCountRef.current + 1}/${maxRetries + 1})...`);
      
      // Fetch field data first (priority)
      const fieldRef = doc(db, "fields", currentUser.uid);
      const fieldSnap = await getDoc(fieldRef);
      
      let fieldData = null;
      if (fieldSnap.exists()) {
        fieldData = fieldSnap.data();
        console.log("Field data found:", {
          hasField: true,
          lat: fieldData.lat,
          lng: fieldData.lng,
          fieldName: fieldData.fieldName,
          cropName: fieldData.cropName
        });
        
        if (fieldData.lat && fieldData.lng) {
          const location = {
            lat: fieldData.lat,
            lon: fieldData.lng, // Note: OpenWeather uses 'lon' not 'lng'
            fieldName: fieldData.fieldName || "Your Field",
            cropName: fieldData.cropName
          };
          setFieldLocation(location);
          setUsingFieldLocation(true);
          setError(null);
          retryCountRef.current = 0;
          
          console.log("Using FIELD location for weather:", location);
          await fetchWeatherData(location.lat, location.lon, location.fieldName);
          return; // Exit early - we have field location
        }
      } else {
        console.log("No field data found");
      }
      
      // Fallback: Try to get user location if no field
      console.log("No field found, trying user location...");
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        console.log("User data:", {
          hasLocation: !!userData.location,
          latitude: userData.location?.latitude,
          longitude: userData.location?.longitude
        });
        
        if (userData.location && userData.location.latitude && userData.location.longitude) {
          const location = {
            lat: userData.location.latitude,
            lon: userData.location.longitude
          };
          console.log("Using USER location for weather:", location);
          setUserLocation(location);
          setUsingFieldLocation(false);
          setError(null);
          retryCountRef.current = 0;
          
          await fetchWeatherData(location.lat, location.lon, "Your Location");
          return;
        }
      }
      
      // No field and no user location
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;
        console.log(`⏳ No location data found, retrying in 2 seconds...`);
        
        setTimeout(() => {
          fetchFieldAndLocation();
        }, 2000);
      } else {
        console.log("No location available after retries, requesting from browser...");
        if (!locationAttempted) {
          setLocationAttempted(true);
          requestLocationNow();
        } else {
          setError("No field or location found. Please draw a field in Farm Selection or enable location access.");
          setLoading(false);
        }
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch location data. Please try again.");
      setLoading(false);
    }
  };

  const handleRetry = () => {
    console.log("🔄 Manual retry triggered");
    retryCountRef.current = 0;
    setError(null);
    setLoading(true);
    setWeatherData(null);
    setLocationAttempted(false);
    fetchFieldAndLocation();
  };

  const requestLocationNow = () => {
    console.log("Requesting location permission from browser...");
    
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setLoading(false);
      return;
    }

    if (!currentUser) {
      setError("No user logged in. Please log in first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    console.log("⏳ Waiting for location permission...");

    const options = {
      enableHighAccuracy: false,
      timeout: 30000,
      maximumAge: 300000
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log("Location obtained from browser:", { latitude, longitude });
        
        try {
          // Save to Firestore
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          const existingData = userSnap.exists() ? userSnap.data() : {};
          
          await setDoc(userRef, {
            ...existingData,
            location: {
              latitude,
              longitude,
              timestamp: new Date().toISOString()
            }
          }, { merge: true });
          
          console.log("💾 Location saved to Firestore successfully");
          
          // Update state and fetch weather
          setUserLocation({ lat: latitude, lon: longitude });
          setUsingFieldLocation(false);
          await fetchWeatherData(latitude, longitude, "Your Location");
        } catch (err) {
          console.error("Error saving location to Firestore:", err);
          // Even if save fails, still fetch weather
          console.log("Fetching weather anyway with obtained location...");
          setUserLocation({ lat: latitude, lon: longitude });
          setUsingFieldLocation(false);
          await fetchWeatherData(latitude, longitude, "Your Location");
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        let errorMsg = "Failed to get location. ";
        
        switch(err.code) {
          case 1:
            errorMsg += "Please allow location access in your browser. Look for the location icon in your address bar.";
            break;
          case 2:
            errorMsg += "Location information is unavailable. Please check your device's location settings.";
            break;
          case 3:
            errorMsg += "Location request timed out. Please try again or check your internet connection.";
            break;
          default:
            errorMsg += "Unknown error. Please try again.";
        }
        
        setError(errorMsg);
        setLoading(false);
      },
      options
    );
  };

  const fetchWeatherData = async (lat, lon, locationName = "Unknown") => {
    console.log(`Fetching weather data for ${locationName} - lat: ${lat}, lon: ${lon}`);
    console.log(`Using API key: ${OPENWEATHER_API_KEY}`);
    setLoading(true);
    setError(null);

    try {
      const weatherUrl = `${OPENWEATHER_BASE_URL}/weather`;
      const weatherParams = {
        lat: lat,
        lon: lon,
        appid: OPENWEATHER_API_KEY,
        units: 'metric'
      };
      
      console.log("Calling weather API:", weatherUrl, weatherParams);
      
      const weatherResponse = await axios.get(weatherUrl, {
        params: weatherParams,
        timeout: 10000
      });

      console.log("Current weather fetched:", weatherResponse.data);

      const forecastUrl = `${OPENWEATHER_BASE_URL}/forecast`;
      console.log("Calling forecast API:", forecastUrl);
      
      const forecastResponse = await axios.get(forecastUrl, {
        params: weatherParams,
        timeout: 10000
      });

      console.log("Forecast data fetched");

      setWeatherData({
        current: weatherResponse.data,
        forecast: forecastResponse.data,
        location: weatherResponse.data.name || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
        locationName: locationName
      });
      
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching weather data:", err);
      if (err.response) {
        console.error("API Error Response:", err.response.status, err.response.data);
        setError(`Weather API error: ${err.response.data.message || 'Failed to fetch weather data'}`);
      } else if (err.request) {
        console.error("Network Error:", err.message);
        setError("Network error. Please check your internet connection.");
      } else {
        console.error("Error:", err.message);
        setError("Failed to fetch weather information. Please try again later.");
      }
      setLoading(false);
    }
  };

  const getWeatherIcon = (main) => {
    const iconMap = {
      "Clear": Sun,
      "Clouds": Cloud,
      "Rain": CloudRain,
      "Drizzle": CloudDrizzle,
      "Thunderstorm": CloudRain,
      "Snow": CloudRain,
      "Mist": Cloud,
      "Fog": Cloud,
      "Haze": Cloud,
    };
    return iconMap[main] || Cloud;
  };

  const getWeatherColor = (main) => {
    const colorMap = {
      "Clear": { border: "border-yellow-300", bg: "bg-yellow-50", text: "text-yellow-700" },
      "Clouds": { border: "border-gray-300", bg: "bg-gray-50", text: "text-gray-700" },
      "Rain": { border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700" },
      "Drizzle": { border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700" },
      "Thunderstorm": { border: "border-purple-300", bg: "bg-purple-50", text: "text-purple-700" },
      "Snow": { border: "border-cyan-300", bg: "bg-cyan-50", text: "text-cyan-700" },
    };
    return colorMap[main] || { border: "border-gray-300", bg: "bg-gray-50", text: "text-gray-700" };
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const getWeatherNews = () => {
    if (!weatherData || !weatherData.current) return [];

    const news = [];
    const current = weatherData.current;
    const forecast = weatherData.forecast;
    const weatherMain = current.weather[0].main;
    const colors = getWeatherColor(weatherMain);
    const Icon = getWeatherIcon(weatherMain);

    // Current weather update
    news.push({
      title: `Current Weather: ${current.weather[0].description.charAt(0).toUpperCase() + current.weather[0].description.slice(1)}`,
      desc: `Temperature: ${Math.round(current.main.temp)}°C | Feels like: ${Math.round(current.main.feels_like)}°C | Humidity: ${current.main.humidity}% | Wind: ${current.wind.speed} m/s`,
      time: formatTime(current.dt),
      icon: Icon,
      ...colors,
      priority: "current"
    });

    // Check for rain in forecast (next 24 hours)
    if (forecast && forecast.list) {
      const next24Hours = forecast.list.slice(0, 8);
      const hasRain = next24Hours.some(item => 
        item.weather[0].main === "Rain" || item.weather[0].main === "Drizzle" || item.weather[0].main === "Thunderstorm"
      );
      
      if (hasRain) {
        const rainForecast = next24Hours.find(item => 
          item.weather[0].main === "Rain" || item.weather[0].main === "Drizzle" || item.weather[0].main === "Thunderstorm"
        );
        if (rainForecast) {
          news.push({
            title: t("weather_rain_title"),
            desc: t("weather_rain_desc", { time: new Date(rainForecast.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }),
            time: formatTime(rainForecast.dt),
            icon: CloudRain,
            border: "border-blue-300",
            bg: "bg-blue-50",
            text: "text-blue-700",
            priority: "alert"
          });
        }
      }
    }

    // Temperature alerts
    if (current.main.temp > 35) {
      news.push({
        title: t("weather_heat_title"),
        desc: t("weather_heat_desc", { value: Math.round(current.main.temp) }),
        time: formatTime(current.dt),
        icon: Thermometer,
        border: "border-red-300",
        bg: "bg-red-50",
        text: "text-red-700",
        priority: "alert"
      });
    } else if (current.main.temp < 10) {
      news.push({
        title: t("weather_cold_title"),
        desc: t("weather_cold_desc", { value: Math.round(current.main.temp) }),
        time: formatTime(current.dt),
        icon: Thermometer,
        border: "border-cyan-300",
        bg: "bg-cyan-50",
        text: "text-cyan-700",
        priority: "alert"
      });
    }

    // Wind alert
    if (current.wind.speed > 10) {
      news.push({
        title: t("weather_wind_title"),
        desc: t("weather_wind_desc", { value: current.wind.speed }),
        time: formatTime(current.dt),
        icon: Wind,
        border: "border-orange-300",
        bg: "bg-orange-50",
        text: "text-orange-700",
        priority: "alert"
      });
    }

    // Humidity alert
    if (current.main.humidity > 85) {
      news.push({
        title: t("weather_humidity_title"),
        desc: t("weather_humidity_desc", { value: current.main.humidity }),
        time: formatTime(current.dt),
        icon: CloudDrizzle,
        border: "border-teal-300",
        bg: "bg-teal-50",
        text: "text-teal-700",
        priority: "alert"
      });
    }

    return news;
  };

  const news = getWeatherNews();

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-700">{t("weather_title")}</h2>
          {weatherData && (
            <div className="flex flex-col gap-1 mt-1">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {weatherData.location}
              </p>
              {usingFieldLocation && fieldLocation && (
                <p className="text-xs text-green-600 flex items-center gap-1 font-medium">
                  <MapPinned className="h-3 w-3" />
                  {t("weather_using_field")} {fieldLocation.fieldName}
                  {fieldLocation.cropName && ` (${fieldLocation.cropName})`}
                </p>
              )}
              {!usingFieldLocation && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {t("weather_using_live")}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {weatherData && !loading && (
            <button
              onClick={handleRetry}
              className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
              title={t("weather_refresh_title")}
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          )}
          {loading && (
            <Loader2 className="h-5 w-5 text-green-600 animate-spin" />
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading && !weatherData && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 text-green-600 animate-spin mb-3" />
            <span className="text-gray-600 font-medium">{t("weather_loading")}</span>
            <span className="text-xs text-gray-400 mt-1">
              {usingFieldLocation ? t("weather_getting_field") : t("weather_getting_live")}
            </span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-300 p-4 rounded-lg">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700 font-medium mb-1">{t("weather_location_required")}</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={requestLocationNow}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors shadow-sm"
              >
                <MapPin className="h-4 w-4" />
                {t("weather_enable_now")}
              </button>
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-md transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                {t("weather_try_again")}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {t("weather_tip")}
            </p>
          </div>
        )}

        {!loading && !error && news.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Cloud className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>{t("weather_no_updates")}</p>
          </div>
        )}

        {news.length > 0 && news.map((item, i) => {
          const Icon = item.icon;

          return (
            <div
              key={i}
              className={`
                ${item.bg} border-l-4 ${item.border} 
                p-4 rounded-lg hover:shadow-md transition-all duration-200 cursor-default
              `}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-6 w-6 ${item.text} flex-shrink-0`} />

                <div className="flex-1">
                  <h4 className={`font-semibold ${item.text}`}>
                    {item.title}
                  </h4>

                  <p className="text-sm text-gray-600 mt-1">
                    {item.desc}
                  </p>

                  <p className="text-xs text-gray-400 mt-1">
                    {item.time}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NewsSection;
