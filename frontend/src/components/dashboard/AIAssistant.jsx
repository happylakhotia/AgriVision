import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';

const AIAssistant = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI Agriculture Assistant. I can help you with soil health, crop nutrients, irrigation schedules, pest control, and fertilizer recommendations for Indian crops. What would you like to know?",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Only scroll to bottom if user has already interacted with the chat
    if (messages.length > 1) {
      scrollToBottom();
    }
  }, [messages]);

  const generateGeminiResponse = async (userMessage) => {
    try {
      const response = await fetch('http://localhost:5000/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage
        })
      });

      const data = await response.json();
      
      if (response.ok && data.response) {
        return data.response.trim();
      } else {
        console.error('Backend API Error:', data);
        const errorMsg = data.error || 'Unknown error';
        return `API Error: ${errorMsg}. Please try again.`;
      }
    } catch (error) {
      console.error('Error calling backend AI API:', error);
      return "Network error. Please check your connection and try again.";
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;

    const userMsg = {
      id: messages.length + 1,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const botResponse = await generateGeminiResponse(inputMessage);
      
      const botMsg = {
        id: messages.length + 2,
        text: botResponse,
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Function to format text by removing markdown syntax and rendering properly
  const formatMessageText = (text) => {
    if (!text) return "";
    
    // First, handle bold syntax (**text** or __text__) - remove the markers
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, (match, content) => content)
      .replace(/__(.*?)__/g, (match, content) => content);
    
    // Handle italic syntax - be careful with single asterisks
    // Replace *text* but not **text** (already handled) or standalone asterisks
    formatted = formatted.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, (match, content) => {
      // Skip if it's part of a list or number pattern
      if (/^\d+\./.test(content.trim()) || /^[-*]\s/.test(content.trim())) {
        return match;
      }
      return content;
    });
    
    // Split by lines to handle multi-line text
    const lines = formatted.split('\n');
    
    return lines.map((line, lineIndex) => {
      const trimmedLine = line.trim();
      
      // Skip empty lines but preserve spacing
      if (!trimmedLine) {
        return <React.Fragment key={lineIndex}>{lineIndex > 0 && <br />}</React.Fragment>;
      }
      
      // Handle numbered lists (1. text or 1) text)
      const numberedMatch = trimmedLine.match(/^(\d+)\.\s*(.+)$/);
      if (numberedMatch) {
        return (
          <React.Fragment key={lineIndex}>
            {lineIndex > 0 && <br />}
            <span>
              <strong className="font-semibold">{numberedMatch[1]}.</strong> {numberedMatch[2]}
            </span>
          </React.Fragment>
        );
      }
      
      // Handle bullet points (- or *) - convert to bullet
      const bulletMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        return (
          <React.Fragment key={lineIndex}>
            {lineIndex > 0 && <br />}
            <span>• {bulletMatch[1]}</span>
          </React.Fragment>
        );
      }
      
      // Regular line - preserve it
      return (
        <React.Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          <span>{line}</span>
        </React.Fragment>
      );
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
      {/* Enhanced Header */}
      <div className="relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-linear-to-r from-green-600 via-green-700 to-emerald-600">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          {/* Decorative Elements */}
          <div className="absolute top-2 right-4 w-20 h-20 bg-white opacity-5 rounded-full blur-xl"></div>
          <div className="absolute bottom-2 left-4 w-16 h-16 bg-yellow-300 opacity-10 rounded-full blur-lg"></div>
        </div>
        
        {/* Header Content */}
        <div className="relative z-10 p-6 border-b border-green-500">
          <div className="flex items-center gap-4">
            {/* Enhanced Avatar */}
            <div className="relative">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <Bot className="h-7 w-7 text-green-600" />
              </div>
              <Sparkles className="h-5 w-5 text-yellow-300 absolute -top-1 -right-1 animate-pulse" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                AI Agriculture Assistant
                <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full">PRO</span>
              </h3>
              <p className="text-green-100 text-sm mt-1">Your Personal Farming Expert • 24/7 Available</p>
            </div>
            
            {/* Status Badge */}
            <div className="flex items-center gap-2 bg-white bg-opacity-20 backdrop-blur-sm px-3 py-2 rounded-full">
              <div className="relative">
                <div className="h-3 w-3 bg-green-400 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 h-3 w-3 bg-green-400 rounded-full animate-ping"></div>
              </div>
              <span className="text-white text-sm font-medium">Online</span>
            </div>
          </div>
          
          {/* Feature Pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              "🌱 Soil Health",
              "🌾 Crop Advice", 
              "💧 Irrigation",
              "🐛 Pest Control",
              "📊 Weather Insights"
            ].map((feature, index) => (
              <span key={index} className="px-3 py-1 bg-white bg-opacity-20 backdrop-blur-sm text-white text-xs rounded-full border border-white border-opacity-30">
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="h-[400px] overflow-y-auto bg-linear-to-b from-green-50 to-white p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.sender === 'user' 
                    ? 'bg-blue-500 ml-2' 
                    : 'bg-green-500 mr-2'
                }`}>
                  {message.sender === 'user' ? (
                    <User className="h-5 w-5 text-white" />
                  ) : (
                    <Bot className="h-5 w-5 text-white" />
                  )}
                </div>

                {/* Message Bubble */}
                <div className={`rounded-2xl px-4 py-3 ${
                  message.sender === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}>
                  <div className="text-sm leading-relaxed">
                    {message.sender === 'bot' ? formatMessageText(message.text) : message.text}
                  </div>
                  <p className={`text-xs mt-1 ${
                    message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-green-600 animate-spin" />
                    <span className="text-sm text-gray-600">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask your question..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="bg-green-600 text-white p-3 rounded-full hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
        
        {/* Quick Suggestions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            "How to test soil health?",
            "Fertilizer dose for wheat?",
            "Best irrigation time?",
            "Pest control solutions?"
          ].map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setInputMessage(suggestion)}
              className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs hover:bg-green-200 transition-colors"
              disabled={isLoading}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
