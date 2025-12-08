import axios from 'axios';
import FormData from 'form-data';

const CLIENT_ID = "2869324a-556d-47ef-8a86-51d6afa72823";
const CLIENT_SECRET = "Dwwx2LD2ZAqBktucTUIF5QmeksgItyw3";

// Helper: Auth Token Lena
async function getSentinelToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  const response = await axios.post('https://services.sentinel-hub.com/oauth/token', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return response.data.access_token;
}

// 🔥 NEW: getBBox now accepts dynamic radius (in km)
function getBBox(lat, lng, radiusKm) {
  const distance_km = radiusKm; // Using dynamic radius
  const lat_degree_km = 111.0;
  const lng_degree_km = 111.0 * Math.cos(lat * (Math.PI / 180));
  
  const r_lat = (distance_km / 2) / lat_degree_km;
  const r_lng = (distance_km / 2) / lng_degree_km;
  
  return [
    lng - r_lng, // minX
    lat - r_lat, // minY
    lng + r_lng, // maxX
    lat + r_lat  // maxY
  ];
}

export const analyzeNDVI = async (req, res) => {
  try {
    // 🔥 NEW: Receive 'radius' from frontend (default 1.0 if not provided)
    const { lat, lng, indexType = "NDVI", radius } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude and Longitude required" });
    }

    // Determine Scan Radius
    const searchRadius = radius ? parseFloat(radius) : 1.0;

    console.log(`🛰️ Processing ${indexType} for: ${lat}, ${lng} with Radius: ${searchRadius}km`);

    // 🔥 LOGIC SWITCH
    let targetApiUrl = "";
    switch (indexType) {
        case "NDVI":
            targetApiUrl = "https://itvi-1234-ndvi-msi.hf.space/predict";
            break;
        case "EVI":
        case "SAVI":
            console.log(`⚠️ Using Default API for ${indexType} (Change this later)`);
            targetApiUrl = "https://itvi-1234-ndvi-msi.hf.space/predict"; 
            break;
        default:
            targetApiUrl = "https://itvi-1234-ndvi-msi.hf.space/predict";
    }

    // 1. Token
    const token = await getSentinelToken();

    // 2. Evalscript
    const evalscript = `
      //VERSION=3
      function setup() {
        return {
          input: [{ bands: ["B02", "B03", "B04", "B08"], units: "DN" }],
          output: { bands: 4, sampleType: "UINT16" }
        };
      }
      function evaluatePixel(sample) { return [sample.B02, sample.B03, sample.B04, sample.B08]; }
    `;

    // 3. Date Range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 60);
    
    // 4. Sentinel Process
    // 🔥 Pass dynamic radius to getBBox
    const bbox = getBBox(lat, lng, searchRadius);

    const sentinelResponse = await axios.post('https://services.sentinel-hub.com/api/v1/process', 
      {
        input: {
          bounds: { bbox: bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
          data: [{ type: "sentinel-2-l1c", dataFilter: { timeRange: { from: startDate.toISOString(), to: endDate.toISOString() }, mosaickingOrder: "leastCC" } }]
        },
        output: { width: 256, height: 256, responses: [{ identifier: "default", format: { type: "image/tiff" } }] },
        evalscript: evalscript
      },
      {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'image/tiff' },
        responseType: 'arraybuffer'
      }
    );

    // 5. Send to AI
    console.log(`🚀 Sending image to ${indexType} AI Model...`);
    
    const form = new FormData();
    form.append('file', Buffer.from(sentinelResponse.data), { filename: 'image.tiff' });

    const aiResponse = await axios.post(targetApiUrl, form, {
      headers: { ...form.getHeaders() }
    });

    console.log("✅ Analysis Complete");
    
    return res.json({
        success: true,
        heatmap_base64: aiResponse.data.heatmap_base64,
        dominant_condition: aiResponse.data.dominant_condition,
        statistics: aiResponse.data.statistics
    });

  } catch (error) {
    let errorMessage = "Processing failed";
    if (error.response) {
        if (error.response.data instanceof Buffer) {
            try {
                const errorString = Buffer.from(error.response.data).toString('utf8');
                console.error("❌ SENTINEL/AI API ERROR:", errorString);
                errorMessage = `API Error: ${errorString}`;
            } catch (e) {
                console.error("❌ Binary Error Data:", error.response.data);
            }
        } else {
            console.error("❌ API Error:", error.response.data);
            errorMessage = JSON.stringify(error.response.data);
        }
    } else {
        console.error("❌ Network/Code Error:", error.message);
        errorMessage = error.message;
    }
    res.status(500).json({ error: errorMessage });
  }
};