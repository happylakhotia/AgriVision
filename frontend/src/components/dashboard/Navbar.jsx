import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "../../contexts/sidebarcontext/SidebarContext";
import { Menu } from "lucide-react";
import logo from "./logo.png";
import LanguageSelector from "../../LanguageSelector";
import { useTranslation } from "react-i18next";

const Navbar = ({ onLogout, currentUser }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
    }
  }, [open]);

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-[60] overflow-visible">
      <div className="flex items-center w-full relative">
        
        {/* Hamburger Menu Button (Mobile) */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Logo Section - aligned with sidebar */}
        <div className="hidden lg:flex w-64 items-center gap-3 px-4 py-3 border-r border-gray-200">
          <img
            src={logo}
            alt="AgriVision AI"
            className="h-10 w-auto"
          />
          <span className="text-xl font-semibold text-gray-900">
            {t("brand_ai")}
          </span>
        </div>

        {/* Mobile Logo */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3">
          <img
            src={logo}
            alt="AgriVision AI"
            className="h-8 w-auto"
          />
          <span className="text-lg font-semibold text-gray-900">
            {t("brand_ai")}
          </span>
        </div>

        {/* Right section with profile */}
        <div className="flex-1 flex items-center justify-end px-4 py-3 min-w-0 relative">
          <div className="hidden md:block mr-4">
            <LanguageSelector />
          </div>
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setOpen(!open)}
              className="
                flex items-center gap-3 px-4 py-2
                bg-white text-gray-700
                hover:bg-green-50
                rounded-full shadow-sm
                border border-green-200
                transition-all duration-200
                whitespace-nowrap
              "
            >
              {/* Avatar */}
              <img
                src={
                  currentUser?.photoURL ||
                  `https://ui-avatars.com/api/?background=4ade80&color=fff&name=${
                    currentUser?.displayName || currentUser?.email
                  }`
                }
                alt="profile"
                className="w-8 h-8 rounded-full object-cover border border-white flex-shrink-0"
              />

              {/* Name */}
              <span className="text-sm font-medium hidden sm:block truncate max-w-[150px]">
                {currentUser?.displayName || currentUser?.email}
              </span>

              {/* Icon */}
              <svg
                className={`w-4 h-4 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown - Rendered via Portal */}
            {open && createPortal(
              <div 
                ref={dropdownRef}
                className="fixed w-48 bg-white shadow-xl border border-gray-200 rounded-lg py-2 z-[9999] animate-fadeIn"
                style={{
                  top: `${dropdownPosition.top}px`,
                  right: `${dropdownPosition.right}px`
                }}
              >
                <button
                  onClick={() => {
                    navigate("/profile");
                    setOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {t("profile")}
                </button>

                <button
                  onClick={onLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  {t("nav_logout")}
                </button>
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
