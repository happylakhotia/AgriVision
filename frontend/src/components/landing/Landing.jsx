import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/authcontext/Authcontext";
import logo from "./logo.png";

const Landing = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { userLoggedIn } = useAuth();

  const handleAuthClick = () => {
    if (userLoggedIn) {
      navigate('/home');
    } else {
      navigate('/login');
    }
  };

  const handleDashboardClick = () => {
    if (userLoggedIn) {
      navigate('/home');
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="antialiased text-gray-900 bg-neutral-900 w-screen min-h-screen overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="shrink-0">
              <img
                src={logo}
                alt="AgriVision AI"
                className="h-16 w-auto"
              />
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex md:items-center md:space-x-8">
              {[
                "Home",
                "Earth Explorer",
                "Dashboard",
                "Features",
                "Technology",
                "Contact",
              ].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(" ", "-")}`}
                  className="text-neutral-700 hover:text-[#22c55e] transition-colors font-medium"
                >
                  {item}
                </a>
              ))}
            </div>

            {/* Mobile Button */}
            <div className="md:hidden">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                type="button"
                className="text-neutral-700 hover:text-[#22c55e] p-2"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d={
                      menuOpen
                        ? "M6 18L18 6M6 6l12 12"
                        : "M4 6h16M4 12h16M4 18h16"
                    }
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        id="hero"
        className="relative w-screen min-h-screen flex items-center justify-center overflow-hidden bg-linear-to-br from-neutral-900 via-neutral-800 to-neutral-900"
      >
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1599536798012-b5c7ab677195?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
            alt="Aerial farmland drone"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-linear-to-r from-neutral-900/80 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
              Monitor Crops with{" "}
              <span className="text-[#84cc16]">AI Precision</span>
            </h1>
            <p className="text-xl lg:text-2xl text-neutral-300 mb-8 leading-relaxed">
              Harness hyperspectral imaging and sensor data to detect crop
              stress, soil conditions, and pest risks before they impact your
              yield.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleAuthClick}
                className="px-8 py-4 bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl"
              >
                {userLoggedIn ? 'Go to Dashboard' : 'Login'}
              </button>
              <button 
                onClick={handleDashboardClick}
                className="px-8 py-4 border-2 border-neutral-400 text-neutral-200 hover:bg-neutral-800 font-semibold rounded-lg transition-colors"
              >
                {userLoggedIn ? 'View Dashboard' : 'Sign Up'}
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1599536729092-b2cea26169cf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                  alt="Corn harvest aerial view"
                  className="w-full h-48 object-cover"
                />
              </div>
              <div className="rounded-xl overflow-hidden shadow-2xl mt-8">
                <img
                  src="https://images.unsplash.com/photo-1545292470-391a7b77b8a2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                  alt="Flying over countryside"
                  className="w-full h-48 object-cover"
                />
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 w-72 h-72 bg-[#84cc16]/20 rounded-full blur-3xl"></div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
