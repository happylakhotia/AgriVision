import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, X, Minimize2, Loader2 } from 'lucide-react';

const KisanMitraChat = ({ isOpen, onClose, onMinimize }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your Kisan Mitra (Farmer Friend). I can help you with soil health, crop care, irrigation, and pest control. What would you like to know?",
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

  const formatMessageText = (text) => {
    if (!text) return "";
    
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, (match, content) => content)
      .replace(/__(.*?)__/g, (match, content) => content);
    
    formatted = formatted.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, (match, content) => {
      if (/^\d+\./.test(content.trim()) || /^[-*]\s/.test(content.trim())) {
        return match;
      }
      return content;
    });
    
    const lines = formatted.split('\n');
    
    return lines.map((line, lineIndex) => {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        return <React.Fragment key={lineIndex}>{lineIndex > 0 && <br />}</React.Fragment>;
      }
      
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
      
      const bulletMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        return (
          <React.Fragment key={lineIndex}>
            {lineIndex > 0 && <br />}
            <span>• {bulletMatch[1]}</span>
          </React.Fragment>
        );
      }
      
      return (
        <React.Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          <span>{line}</span>
        </React.Fragment>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[calc(100vw-2rem)] sm:w-[420px] h-[650px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 animate-slide-up overflow-hidden">
      {/* Header */}
      <div className="bg-green-600 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-md">
              <Bot className="h-6 w-6 text-green-600" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white"></div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-lg text-white">Kisan Mitra</h3>
            <p className="text-sm text-white font-normal">Your AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            onClick={onMinimize}
            className="p-2 hover:bg-green-700 rounded-lg transition-colors"
            title="Minimize"
          >
            <Minimize2 className="h-5 w-5 text-white" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-green-700 rounded-lg transition-colors"
            title="Close"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div className={`flex gap-2.5 max-w-[85%] ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.sender === 'user' 
                  ? 'bg-blue-500' 
                  : 'bg-green-600'
              }`}>
                {message.sender === 'user' ? (
                  <User className="h-4 w-4 text-white" />
                ) : (
                  <Bot className="h-4 w-4 text-white" />
                )}
              </div>

              {/* Message Bubble */}
              <div className={`rounded-2xl px-4 py-2.5 ${
                message.sender === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              }`}>
                <div className={`text-sm leading-relaxed ${
                  message.sender === 'user' ? 'text-white' : 'text-gray-900'
                }`}>
                  {message.sender === 'bot' ? formatMessageText(message.text) : message.text}
                </div>
                <p className={`text-xs mt-1.5 ${
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
          <div className="flex justify-start animate-fade-in">
            <div className="flex gap-2.5">
              <div className="shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-green-600 animate-spin" />
                  <span className="text-sm text-gray-900">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white rounded-b-2xl">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask your question..."
            className="flex-1 px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="bg-green-600 text-white px-4 py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
        
        {/* Quick Suggestions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            "Soil Health Test",
            "Fertilizer Dose",
            "Irrigation Time",
            "Pest Control"
          ].map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setInputMessage(suggestion)}
              className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs hover:bg-green-200 transition-colors border border-green-200"
              disabled={isLoading}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default KisanMitraChat;

