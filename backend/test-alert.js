/**
 * Test script for Agentic AI SMS Alert API
 * 
 * Usage:
 * node test-alert.js
 */

import axios from 'axios';

const AGENTIC_AI_WEBHOOK_URL = 'https://primary-production-569f.up.railway.app/webhook/a9d2af3a-197e-4127-9c42-4076bba6cf44';

// Test data - Replace with actual user data for testing
const testData = {
  body: {
    name: "Test Farmer",
    email: "test@example.com",
    phone: "7355074001", // Replace with your test phone number
    message: " This is a test alert from AgriVision! Your field monitoring is now active. You will receive alerts about pest attacks, irrigation needs, and harvest times."
  }
};

console.log('Testing Agentic AI SMS Alert API...\n');
console.log('Sending request to:', AGENTIC_AI_WEBHOOK_URL);
console.log('Payload:', JSON.stringify(testData, null, 2));
console.log('\n Sending...\n');

axios.post(AGENTIC_AI_WEBHOOK_URL, testData, {
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
})
  .then(response => {
    console.log(' SUCCESS! Alert sent successfully!\n');
    console.log(' Response Status:', response.status);
    console.log(' Response Data:', JSON.stringify(response.data, null, 2));
    console.log('\n Check your phone for the SMS alert!');
  })
  .catch(error => {
    console.error(' ERROR! Failed to send alert\n');
    if (error.response) {
      console.error(' Status:', error.response.status);
      console.error(' Response:', error.response.data);
    } else if (error.request) {
      console.error(' No response received from server');
      console.error(' Request:', error.request);
    } else {
      console.error(' Error:', error.message);
    }
    process.exit(1);
  });



