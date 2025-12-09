import axios from 'axios';

// Agentic AI API configuration
const AGENTIC_AI_WEBHOOK_URL = 'https://primary-production-569f.up.railway.app/webhook/a9d2af3a-197e-4127-9c42-4076bba6cf44';

/**
 * Send alert notification to user via Agentic AI API
 * @param {Object} userData - User information
 * @param {string} userData.name - User's name
 * @param {string} userData.email - User's email
 * @param {string} userData.phone - User's phone number
 * @param {string} message - Alert message to send
 * @returns {Promise<Object>} Response from the API
 */
export const sendAlertNotification = async (userData, message) => {
  try {
    const payload = {
      body: {
        name: userData.name || 'Farmer',
        email: userData.email,
        phone: userData.phone,
        message: message
      }
    };

    console.log(' Sending alert notification:', payload);

    const response = await axios.post(AGENTIC_AI_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log(' Alert notification sent successfully:', response.data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error(' Failed to send alert notification:', error.message);
    
    // Return error but don't throw - we don't want to break the main flow
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
};

/**
 * Send field monitoring alert
 * @param {Object} userData - User information
 * @param {Object} fieldData - Field information
 * @param {string} alertType - Type of alert (pest, disease, weather, etc.)
 * @param {string} customMessage - Optional custom message
 */
export const sendFieldAlert = async (userData, fieldData, alertType, customMessage = null) => {
  const messages = {
    pest: ` Pest attack expected soon in your area near ${fieldData.location || 'your field'}. Please take preventive measures.`,
    disease: `Disease outbreak detected in your region. Monitor your crops at ${fieldData.location || 'your field'} closely.`,
    weather: ` Weather alert for ${fieldData.location || 'your field'}. Adverse conditions expected. Please take necessary precautions.`,
    irrigation: ` Irrigation alert for ${fieldData.location || 'your field'}. Water stress detected based on vegetation indices.`,
    harvest: ` Your crops at ${fieldData.location || 'your field'} are approaching optimal harvest time based on vegetation analysis.`,
    general: customMessage || ` Update about your field at ${fieldData.location || 'your location'}.`
  };

  const message = messages[alertType] || messages.general;
  
  return await sendAlertNotification(userData, message);
};

/**
 * Send welcome notification to new users
 * @param {Object} userData - User information
 */
export const sendWelcomeNotification = async (userData) => {
  const message = `🎉 Welcome to AgriVision! You will receive timely alerts about your crops, weather conditions, and pest warnings to help you make informed farming decisions.`;
  
  return await sendAlertNotification(userData, message);
};

/**
 * Send notification when user adds a new field with indices
 * @param {Object} userData - User information
 * @param {Object} fieldData - Field information including indices
 */
export const sendFieldAddedNotification = async (userData, fieldData) => {
  const indices = fieldData.indices || [];
  const indicesText = indices.length > 0 
    ? `monitoring ${indices.join(', ')} indices` 
    : 'monitoring';
  
  const message = ` Your field has been successfully added to AgriVision! We are now ${indicesText} for your field at ${fieldData.location || 'your location'}. You will receive alerts about crop health, pest warnings, and weather conditions.`;
  
  return await sendAlertNotification(userData, message);
};

export default {
  sendAlertNotification,
  sendFieldAlert,
  sendWelcomeNotification,
  sendFieldAddedNotification
};



