import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/authcontext/Authcontext";
import { useSidebar } from "../../contexts/sidebarcontext/SidebarContext";
import { db } from "../../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { X } from "lucide-react";
import {
  LayoutDashboard,
  Layers,
  MapPin,
  BarChart3,
  Bell,
  FileText,
  HeadphonesIcon,
  DollarSign,
  User,
  Leaf,
  Bug,
  FlaskConical,
  Package,
  Shield,
  Wrench,
  Users,
  Store,
  Briefcase
} from "lucide-react";
import { useTranslation } from "react-i18next";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const { isOpen, closeSidebar } = useSidebar();
  const { t } = useTranslation();
  // Initialize from sessionStorage first to avoid flash
  const [userType, setUserType] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('userType') || null;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchUserType();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const fetchUserType = async () => {
    try {
      // First check sessionStorage for immediate value
      const sessionType = sessionStorage.getItem('userType');
      if (sessionType) {
        setUserType(sessionType);
        setLoading(false);
      }

      // Then fetch from Firestore for accurate value
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const fetchedType = data.userType || "farmer";
        setUserType(fetchedType);
        // Update sessionStorage with fetched value
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('userType', fetchedType);
        }
      } else if (!sessionType) {
        // Only default to farmer if we don't have sessionStorage either
        setUserType("farmer");
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('userType', 'farmer');
        }
      }
    } catch (error) {
      console.error("Error fetching user type:", error);
      // On error, use sessionStorage if available, otherwise default
      if (!userType) {
        setUserType("farmer");
      }
    } finally {
      setLoading(false);
    }
  };

  const farmerMenuItems = [
    { icon: LayoutDashboard, key: "sidebar_dashboard", href: "/home" },
    { icon: MapPin, key: "sidebar_farm_selection", href: "/farm-selection" },
    { icon: FlaskConical, key: "sidebar_soil_analysis", href: "/soil-analysis"},
     { icon: Bug, key: "sidebar_pest_scanner", href: "/pest-scanner"},
    { icon: Leaf, key: "sidebar_disease_detection", href: "/disease-detection"},
   
    
    { icon: Package, key: "sidebar_logistics", href: "/logistics"},
    { icon: Shield, key: "sidebar_insurance", href: "/insurance"},
    { icon: Wrench, key: "sidebar_machinery", href: "/machinery"},
    { icon: Users, key: "sidebar_find_customers", href: "/find-customers"},
    { icon: BarChart3, key: "sidebar_analytics", href: "/analytics" },
    { icon: FileText, key: "sidebar_reports", href: "/reports" },
    { icon: Bell, key: "sidebar_alerts", href: "/alerts" },
    { icon: User, key: "sidebar_account", href: "/profile" },
  ];

  const vendorMenuItems = [
    { icon: LayoutDashboard, key: "sidebar_dashboard", href: "/home" },
    { icon: Store, key: "sidebar_vendor_dashboard", href: "/vendor-dashboard" },
    { icon: Briefcase, key: "sidebar_vendor_opportunities", href: "/vendor-opportunities" },
    { icon: Bell, key: "sidebar_alerts", href: "/alerts" },
    { icon: User, key: "sidebar_account", href: "/profile" },
  ];

  // Determine menu items based on userType, but don't render until we know the type
  const menuItems = userType === "vendor" ? vendorMenuItems : (userType === "farmer" ? farmerMenuItems : []);

  const handleClick = (e, href) => {
    if (href.startsWith("/")) {
      e.preventDefault();
      navigate(href);
      // Close sidebar on mobile after navigation
      if (window.innerWidth < 1024) {
        closeSidebar();
      }
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col pt-20 z-50
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Close button for mobile */}
        <button
          onClick={closeSidebar}
          className="lg:hidden absolute top-4 right-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <ul className="space-y-1">
              {menuItems.map((item, index) => {
                const active = location.pathname === item.href;

                return (
                  <li key={index}>
                    <a
                      href={item.href}
                      onClick={(e) => handleClick(e, item.href)}
                      className={`
                        flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors
                        ${active
                          ? "bg-green-100 text-green-700 font-medium"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        }
                      `}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{t(item.key)}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
