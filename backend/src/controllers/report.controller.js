import PDFDocument from 'pdfkit';
import { db } from '../config/firebase.js';
import axios from 'axios';
import FormData from 'form-data';

const CLIENT_ID = "2869324a-556d-47ef-8a86-51d6afa72823";
const CLIENT_SECRET = "Dwwx2LD2ZAqBktucTUIF5QmeksgItyw3";
const AI_BASE_URL = "https://itvi-1234-indexesall.hf.space";

// Helper: Get Sentinel Token
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

// Helper: Get BBox
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

// Helper: Fetch heatmap for a given index type
async function fetchHeatmap(lat, lng, indexType, radius) {
  try {
    const token = await getSentinelToken();
    const modelParam = indexType.toLowerCase();
    const searchRadius = radius || 1.0;

    const evalscript = `
      //VERSION=3
      function setup() {
        return {
          input: [{ 
            bands: ["B02", "B03", "B04", "B05", "B08"], 
            units: "DN" 
          }],
          output: { 
            bands: 5, 
            sampleType: "UINT16" 
          }
        };
      }
      function evaluatePixel(sample) { 
        return [sample.B02, sample.B03, sample.B04, sample.B05, sample.B08]; 
      }
    `;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 60);

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

    const form = new FormData();
    form.append('file', Buffer.from(sentinelResponse.data), { filename: 'sentinel_5band.tiff' });

    const targetApiUrl = `${AI_BASE_URL}/predict?model_type=${modelParam}`;
    const aiResponse = await axios.post(targetApiUrl, form, {
      headers: { ...form.getHeaders() }
    });

    return {
      success: true,
      heatmap_base64: aiResponse.data.heatmap_base64,
      statistics: aiResponse.data.statistics,
      model_used: aiResponse.data.model_used
    };
  } catch (error) {
    console.error(`Error fetching ${indexType} heatmap:`, error.message);
    return null;
  }
}

export const generateReport = async (req, res) => {
  try {
    const userId = req.user?.uid || req.body.userId;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Fetch user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userDoc.data();

    // Fetch user's fields
    const fieldsRef = db.collection('users').doc(userId).collection('fields');
    const fieldsSnapshot = await fieldsRef.get();
    const fields = [];
    fieldsSnapshot.forEach(doc => {
      fields.push({ id: doc.id, ...doc.data() });
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields found for this user" });
    }

    // Use selected field or first field
    const fieldId = req.body.fieldId;
    let selectedField = fields[0];
    if (fieldId) {
      const foundField = fields.find(f => f.id === fieldId);
      if (foundField) {
        selectedField = foundField;
      }
    }
    const fieldLat = selectedField.lat;
    const fieldLng = selectedField.lng;
    const fieldRadius = selectedField.radius || 1.0;

    if (!fieldLat || !fieldLng) {
      return res.status(400).json({ error: "Field coordinates not found" });
    }

    // Fetch analytics data
    let analyticsData = null;
    try {
      const analyticsResponse = await axios.post(
        "https://itvi-1234-newcollectordata.hf.space/generate_data",
        {
          lat: fieldLat,
          lon: fieldLng,
          field_name: selectedField.fieldName || "Field_1"
        }
      );
      analyticsData = analyticsResponse.data;
    } catch (error) {
      console.error("Error fetching analytics data:", error.message);
    }

    // Fetch heatmaps for different indices
    const heatmaps = {};
    const indexTypes = ['NDVI', 'NDRE', 'EVI', 'SAVI'];
    for (const indexType of indexTypes) {
      const heatmapData = await fetchHeatmap(fieldLat, fieldLng, indexType, fieldRadius);
      if (heatmapData) {
        heatmaps[indexType] = heatmapData;
      }
    }

    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="agrivision-report-${Date.now()}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Helper function to add image from base64
    const addBase64Image = async (base64String, x, y, width, height) => {
      try {
        const imageBuffer = Buffer.from(base64String, 'base64');
        doc.image(imageBuffer, x, y, { width, height });
      } catch (error) {
        console.error("Error adding image:", error);
        doc.text("Image not available", x, y);
      }
    };

    // Helper function to add section header
    const addSectionHeader = (text, y, size = 12, xPos = 50) => {
      doc.fontSize(size)
         .fillColor('#22c55e')
         .font('Helvetica-Bold')
         .text(text, xPos, y)
         .font('Helvetica')
         .fillColor('#000000');
      return y + size + 4; // Return position for content below header (compact spacing)
    };

    // Helper: Get Google Maps Static Image for field
    const getFieldMapImage = async () => {
      try {
        if (!selectedField.coordinates || selectedField.coordinates.length === 0) {
          return null;
        }

        // Calculate bounds
        const lats = selectedField.coordinates.map(c => c.lat || c[1]);
        const lngs = selectedField.coordinates.map(c => c.lng || c[0]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;

        // Create path string for polygon
        const path = selectedField.coordinates
          .map(c => `${c.lat || c[1]},${c.lng || c[0]}`)
          .join('|');

        // Google Maps Static API URL
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
          `center=${centerLat},${centerLng}&` +
          `zoom=15&` +
          `size=600x400&` +
          `maptype=satellite&` +
          `path=color:0x00FF00|weight:3|fillcolor:0x00FF0080|${path}&` +
          `key=AIzaSyDKR_CVLRbV0lqjy_8JRWZAVDdO5Xl7jRk`;

        const response = await axios.get(mapUrl, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
      } catch (error) {
        console.error("Error fetching map image:", error.message);
        return null;
      }
    };

    // Helper: Draw simple line chart
    const drawSimpleChart = (data, xKey, yKey, x, y, width, height, label) => {
      if (!data || data.length === 0) {
        doc.fontSize(8)
           .fillColor('#999999')
           .text(`${label}: No data`, x, y);
        return y + 30;
      }
      
      const padding = 20;
      const chartWidth = width - (padding * 2);
      const chartHeight = height - (padding * 2);
      const chartX = x + padding;
      const chartY = y + padding + 15;

      // Find min/max values
      const values = data.map(d => d[yKey] || 0).filter(v => !isNaN(v) && isFinite(v));
      if (values.length === 0) {
        doc.fontSize(8)
           .fillColor('#999999')
           .text(`${label}: Invalid data`, x, y);
        return y + 30;
      }
      
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const range = maxVal - minVal || 1;

      // Draw chart title
      doc.fontSize(9)
         .fillColor('#22c55e')
         .text(label, chartX, y + 5);

      // Draw axes
      doc.strokeColor('#cccccc')
         .lineWidth(1)
         .moveTo(chartX, chartY)
         .lineTo(chartX, chartY + chartHeight)
         .lineTo(chartX + chartWidth, chartY + chartHeight)
         .stroke();

      // Draw min/max labels
      doc.fontSize(7)
         .fillColor('#999999')
         .text(maxVal.toFixed(1), chartX - 25, chartY - 5)
         .text(minVal.toFixed(1), chartX - 25, chartY + chartHeight - 5);

      // Draw data line
      if (data.length > 1) {
        doc.strokeColor('#22c55e')
           .lineWidth(2);
        
        let firstPoint = true;
        data.forEach((point, idx) => {
          const val = point[yKey] || 0;
          if (isNaN(val) || !isFinite(val)) return;
          
          const normalizedVal = (val - minVal) / range;
          const px = chartX + (idx / (data.length - 1)) * chartWidth;
          const py = chartY + chartHeight - (normalizedVal * chartHeight);
          
          if (firstPoint) {
            doc.moveTo(px, py);
            firstPoint = false;
          } else {
            doc.lineTo(px, py);
          }
        });
        doc.stroke();
      }

      return y + height + 15;
    };

    // PAGE 1: Header + Farmer Details + Field Info + Map (Compact)
    let yPos = 40;
    
    // Logo and Header
    doc.rect(250, yPos, 60, 60)
       .fillColor('#22c55e')
       .fill('#22c55e')
       .fillColor('#ffffff')
       .fontSize(18)
       .text('AV', 265, yPos + 20)
       .fillColor('#000000');
    
    yPos += 65;
    doc.fontSize(22)
       .fillColor('#22c55e')
       .text('AgriVision Report', 50, yPos, { align: 'center' })
       .fontSize(9)
       .fillColor('#666666')
       .text(`Generated: ${new Date().toLocaleDateString()} | Field: ${selectedField.fieldName || 'N/A'}`, 50, yPos + 22, { align: 'center' });
    
    yPos += 35;

    // Two column layout: Left - Farmer Details, Right - Field Info
    const sectionStartY = yPos;
    
    // Left Column Header
    const leftHeaderY = addSectionHeader('Farmer Details', sectionStartY, 12, 50);
    const leftContentY = leftHeaderY + 3; // Compact gap after header
    const lineHeight = 11; // Compact but readable line spacing
    doc.fontSize(9)
       .text(`Name: ${userData.firstName || 'N/A'} ${userData.lastName || ''}`, 50, leftContentY)
       .text(`Email: ${userData.email || 'N/A'}`, 50, leftContentY + lineHeight)
       .text(`Phone: ${userData.phone || 'N/A'}`, 50, leftContentY + (lineHeight * 2))
       .text(`Address: ${userData.farmAddress || 'N/A'}`, 50, leftContentY + (lineHeight * 3))
       .text(`Total Acres: ${userData.acres || 'N/A'}`, 50, leftContentY + (lineHeight * 4));

    // Right Column Header (same Y position as left)
    const rightHeaderY = addSectionHeader('Field Information', sectionStartY, 12, 300);
    const rightContentY = rightHeaderY + 3; // Compact gap after header
    doc.fontSize(9)
       .text(`Field: ${selectedField.fieldName || 'N/A'}`, 300, rightContentY)
       .text(`Crop: ${selectedField.cropName || 'N/A'}`, 300, rightContentY + lineHeight)
       .text(`Area: ${selectedField.area || 'N/A'}`, 300, rightContentY + (lineHeight * 2))
       .text(`Sowing: ${selectedField.sowingDate || 'N/A'}`, 300, rightContentY + (lineHeight * 3))
       .text(`Location: ${fieldLat.toFixed(4)}, ${fieldLng.toFixed(4)}`, 300, rightContentY + (lineHeight * 4));

    // Field Map Image - Start after both columns (use the bottom of the content)
    const bottomOfColumns = Math.max(leftContentY + (lineHeight * 5), rightContentY + (lineHeight * 5));
    yPos = bottomOfColumns + 15; // Compact spacing before map section
    const mapHeaderY = addSectionHeader('Field Map', yPos, 12);
    const mapImageY = mapHeaderY + 3; // Compact gap after header
    
    const mapImage = await getFieldMapImage();
    if (mapImage) {
      try {
        doc.image(mapImage, 50, mapImageY, { width: 500, height: 300, fit: [500, 300] });
        yPos = mapImageY + 310;
      } catch (error) {
        doc.fontSize(9)
           .fillColor('#999999')
           .text('Map image unavailable', 50, mapImageY);
        yPos = mapImageY + 30;
      }
    } else {
      doc.fontSize(9)
         .fillColor('#999999')
         .text('Field map coordinates not available', 50, mapImageY);
      yPos = mapImageY + 30;
    }

    // If we're past page 1, add new page
    if (yPos > 700) {
      doc.addPage();
      yPos = 40;
    }

    // Heat Maps (Small, side by side)
    yPos += 15; // Compact spacing before heat maps section
    const heatmapHeaderY = addSectionHeader('Vegetation Index Heat Maps', yPos, 12);
    const heatmapIndexTypes = Object.keys(heatmaps);
    const heatmapWidth = 240;
    const heatmapHeight = 180;
    let heatmapX = 50;
    let heatmapRowY = heatmapHeaderY + 8; // Compact gap after header
    
    for (let i = 0; i < Math.min(heatmapIndexTypes.length, 4); i++) {
      const indexType = heatmapIndexTypes[i];
      const heatmapData = heatmaps[indexType];
      
      if (i > 0 && i % 2 === 0) {
        heatmapRowY += heatmapHeight + 35; // Compact space for label and stat
        heatmapX = 50;
        if (heatmapRowY + heatmapHeight > 700) {
          doc.addPage();
          heatmapRowY = 50;
        }
      }
      
      if (heatmapData && heatmapData.heatmap_base64) {
        try {
          // Add label above image with proper spacing
          const labelY = heatmapRowY - 10;
          doc.fontSize(9)
             .fillColor('#22c55e')
             .font('Helvetica-Bold')
             .text(indexType, heatmapX, labelY)
             .font('Helvetica');
          
          const imageBuffer = Buffer.from(heatmapData.heatmap_base64, 'base64');
          doc.image(imageBuffer, heatmapX, heatmapRowY, { width: heatmapWidth, height: heatmapHeight, fit: [heatmapWidth, heatmapHeight] });
          
          // Add key stat below image with proper spacing
          if (heatmapData.statistics) {
            const maxKey = Object.keys(heatmapData.statistics).reduce((a, b) => 
              heatmapData.statistics[a] > heatmapData.statistics[b] ? a : b
            );
            doc.fontSize(7)
               .fillColor('#666666')
               .text(`${maxKey}: ${heatmapData.statistics[maxKey]?.toFixed(2) || 'N/A'}`, heatmapX, heatmapRowY + heatmapHeight + 5);
          }
        } catch (error) {
          doc.fontSize(8)
             .fillColor('#999999')
             .text(`${indexType}: N/A`, heatmapX, heatmapRowY);
        }
      }
      
      heatmapX += heatmapWidth + 20;
    }

    // PAGE 2: Analytics Graphs + Disease/Soil Analysis
    doc.addPage();
    yPos = 40;

    // Process analytics data
    let processedData = [];
    if (analyticsData && typeof analyticsData === 'string') {
      const lines = analyticsData.trim().split("\n");
      const headers = lines[0].split(",");
      const rawData = lines.slice(1).map(line => {
        const values = line.split(",");
        const obj = {};
        headers.forEach((header, index) => {
          const val = values[index];
          obj[header.trim()] = isNaN(val) ? val : parseFloat(val);
        });
        return obj;
      });

      // Calculate soil moisture (same logic as frontend)
      let currentMoisture = 50;
      processedData = rawData.map((d, i) => {
        if (d.precipitation > 0) {
          currentMoisture += d.precipitation * 2;
        } else {
          currentMoisture -= (d.vpd * 0.8) + 0.5;
        }
        currentMoisture = Math.max(10, Math.min(90, currentMoisture));

        // Cumulative GDD
        const prevGDD = i > 0 ? rawData[i-1].cum_gdd || 0 : 0;
        const cum_gdd = prevGDD + (d.gdd || 0);

        return {
          ...d,
          dateShort: d.date ? d.date.substring(5) : '',
          soil_moisture: d.soil_moisture || parseFloat(currentMoisture.toFixed(1)),
          cum_gdd: cum_gdd
        };
      });
    }

    if (processedData.length > 0) {
      // Calculate stats
      const avgNDVI = processedData.reduce((s, d) => s + (d.ndvi || 0), 0) / processedData.length;
      const totalRain = processedData.reduce((s, d) => s + (d.precipitation || 0), 0);
      const stressDays = processedData.filter(d => d.vpd > 1.5).length;
      const diseaseDays = processedData.filter(d => (d.leaf_wetness_hours || 0) > 10).length;

      // Analytics Summary Stats
      const analyticsHeaderY = addSectionHeader('Analytics Summary', yPos, 12);
      const analyticsContentY = analyticsHeaderY + 3;
      doc.fontSize(9)
         .text(`Avg NDVI: ${avgNDVI.toFixed(2)} | Total Rain: ${totalRain.toFixed(0)}mm | Stress Days: ${stressDays} | Disease Risk: ${diseaseDays}`, 50, analyticsContentY, { width: 500 });
      yPos = analyticsContentY + 20;

      // Charts - Two columns
      const chartWidth = 240;
      const chartHeight = 120;
      
      // Chart 1: NDVI Trend
      yPos = drawSimpleChart(
        processedData.slice(0, 30), // Last 30 data points
        'dateShort',
        'ndvi',
        50,
        yPos,
        chartWidth,
        chartHeight,
        'NDVI Trend'
      );

      // Chart 2: Precipitation
      yPos = drawSimpleChart(
        processedData.slice(0, 30),
        'dateShort',
        'precipitation',
        300,
        yPos - chartHeight - 15,
        chartWidth,
        chartHeight,
        'Precipitation'
      );

      // Chart 3: Soil Moisture
      yPos = drawSimpleChart(
        processedData.slice(0, 30),
        'dateShort',
        'soil_moisture',
        50,
        yPos,
        chartWidth,
        chartHeight,
        'Soil Moisture'
      );

      // Chart 4: VPD (Water Stress)
      yPos = drawSimpleChart(
        processedData.slice(0, 30),
        'dateShort',
        'vpd',
        300,
        yPos - chartHeight - 15,
        chartWidth,
        chartHeight,
        'Water Stress (VPD)'
      );
    }

    // Disease Prediction & Soil Analysis (Compact)
    yPos += 20;
    if (yPos > 600) {
      doc.addPage();
      yPos = 40;
    }

    const diseaseHeaderY = addSectionHeader('Disease Prediction & Soil Analysis', yPos, 12);
    const diseaseContentY = diseaseHeaderY + 3;
    doc.fontSize(9)
       .fillColor('#666666')
       .text('Disease prediction and soil analysis data will be included when available.', 50, diseaseContentY)
       .text('Use the Disease Detection and Soil Analysis features to generate data.', 50, diseaseContentY + 12);

    // Footer
    yPos = 750;
    doc.fontSize(8)
       .fillColor('#999999')
       .text('Generated by AgriVision Agricultural Intelligence Platform', 50, yPos, { align: 'center' })
       .text(`Report ID: ${Date.now()}`, 50, yPos + 12, { align: 'center' });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ error: error.message });
  }
};

