export const generateAIResponse = async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const prompt = `You are an agriculture expert AI.
You know soil health, crop nutrients, irrigation schedules, pest control, and fertilizer dosage for Indian crops.

Always reply in simple farmer-friendly English that is easy to understand.

If the user shares soil data (NPK values, pH, organic matter), give specific, practical recommendations.
If rainfall is predicted or mentioned, warn the user accordingly and suggest how to adjust their plan.
Never give unsafe advice. Focus on safe, realistic, and affordable options for small and medium farmers.

User message:
${message}

Based on the above instructions, give a clear, step-by-step answer in simple English:`;

    // Use the API key directly from environment or hardcoded
    const apiKey = process.env.GEMINI_API_KEY

    console.log('Attempting to call Gemini model gemini-2.5-flash with generateContent...');

    // Call a supported Gemini model (gemini-2.5-flash) using generateContent on v1beta
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    const rawText = await response.text();
    console.log('Gemini raw HTTP status:', response.status);
    console.log('Gemini raw response body:', rawText);

    let data;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON response:', parseError);
      return res.status(500).json({
        error: 'API Error: Gemini service returned a non-JSON response. Please try again later.',
      });
    }

    // If successful, extract the text from candidates (Gemini generateContent shape)
    const candidateText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      data.candidates?.[0]?.output;

    if (response.ok && candidateText) {
      const aiResponse = candidateText.trim();
      console.log('AI Response generated successfully');
      res.json({ response: aiResponse });
    } else {
      console.error('AI API Error:', data);
      const detailedError =
        data.error?.message ||
        (rawText && rawText.trim()) ||
        `HTTP ${response.status}`;
      res.status(500).json({ error: `API Error: ${detailedError}` });
    }
  } catch (error) {
    console.error('AI Controller Error:', error);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
};
