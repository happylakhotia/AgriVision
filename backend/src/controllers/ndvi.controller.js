import axios from 'axios';
import FormData from 'form-data';

const CLIENT_ID = "2869324a-556d-47ef-8a86-51d6afa72823";
const CLIENT_SECRET = "Dwwx2LD2ZAqBktucTUIF5QmeksgItyw3";
const AI_BASE_URL = "https://itvi-1234-indexesall.hf.space"; 

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

// Helper: Dynamic BBox
function getBBox(lat, lng, radiusKm) {
  const distance_km = radiusKm;
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
    // Frontend se 'indexType' aayega: "NDVI", "EVI", "SAVI", "NDRE"
    const { lat, lng, indexType = "NDVI", radius } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude and Longitude required" });
    }
    const searchRadius = radius ? parseFloat(radius) : 1.0;

    // Model ID convert karo (lowercase for Python backend)
    // E.g., "NDVI" -> "ndvi", "NDRE" -> "ndre"
    const modelParam = indexType.toLowerCase();
    console.log(`🛰️ Processing ${indexType} (${modelParam}) for: ${lat}, ${lng} | Radius: ${searchRadius}km`);

    // 1. Token Generation
    const token = await getSentinelToken();

    // 2. UPDATED EVALSCRIPT (Critical Step!)
    // Hum ab 5 Bands fetch kar rahe hain: Blue(B02), Green(B03), Red(B04), RedEdge(B05), NIR(B08)
    // Yeh order Python backend ke 'process_tiff_for_model' function se match hona chahiye.
  const evalscript = `
      //VERSION=3
      function setup() {
        return {
          input: [{ 
            bands: ["B02", "B03", "B04", "B05", "B08", "B11"], 
            units: "DN" 
          }],
          output: { 
            bands: 6, 
            sampleType: "UINT16" 
          }
        };
      }

      function evaluatePixel(sample) { 
        // Index 0: Blue (B02)
        // Index 1: Green (B03)
        // Index 2: Red (B04)
        // Index 3: Red Edge (B05)
        // Index 4: NIR (B08)
        // Index 5: SWIR (B11) - NEW for SAVI
        return [sample.B02, sample.B03, sample.B04, sample.B05, sample.B08, sample.B11]; 
      }
    `;

    // 3. Date Range (Last 60 days to find cloud-free image)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 60);
    
    // 4. Sentinel API Call
    const bbox = getBBox(lat, lng, searchRadius);
    const sentinelResponse = await axios.post('https://services.sentinel-hub.com/api/v1/process', 
      {
        input: {
          bounds: { bbox: bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
          data: [{ 
            type: "sentinel-2-l1c", 
            dataFilter: { timeRange: { from: startDate.toISOString(), to: endDate.toISOString() }, mosaickingOrder: "leastCC" } 
          }]
        },
        output: { 
          width: 256, 
          height: 256, 
          responses: [{ identifier: "default", format: { type: "image/tiff" } }] 
        },
        evalscript: evalscript
      },
      {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'image/tiff' },
        responseType: 'arraybuffer'
      }
    );

    // 5. Send to Python AI Backend
    // Ab hum URL mein Query Parameter use kar rahe hain: ?model_type=ndvi
    const targetApiUrl = `${AI_BASE_URL}/predict?model_type=${modelParam}`;
    
    console.log(`🚀 Sending 5-Band TIFF to AI Model: ${modelParam}...`);
    
    const form = new FormData();
    form.append('file', Buffer.from(sentinelResponse.data), { filename: 'sentinel_5band.tiff' });

    const aiResponse = await axios.post(targetApiUrl, form, {
      headers: { ...form.getHeaders() }
    });

    console.log("✅ Analysis Complete");
    
    // 6. Response to Frontend
    return res.json({
        success: true,
        model_used: aiResponse.data.model_used, // "ndvi", "ndre", etc.
        heatmap_base64: aiResponse.data.heatmap_base64,
        statistics: aiResponse.data.statistics
        // Note: 'dominant_condition' python ne return nahi kiya tha pichle code me, 
        // agar chahiye to python code me wapas add kar lena stats calculation ke baad.
    });

  } catch (error) {
    let errorMessage = "Processing failed";
    if (error.response) {
       // Error handling logic (Same as before)
       try {
           const errorData = error.response.data instanceof Buffer ? error.response.data.toString() : JSON.stringify(error.response.data);
           console.error("❌ API ERROR:", errorData);
           errorMessage = `External API Error: ${errorData}`;
            } catch (e) {
           errorMessage = "Unknown Binary Error";
            }
        } else {
        console.error("❌ Code Error:", error.message);
        errorMessage = error.message;
    }
    res.status(500).json({ error: errorMessage });
  }
};