import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  FlaskConical
} from "lucide-react";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, name: "Dashboard", href: "/home" },
    { icon: Layers, name: "Features", href: "/features" },
    { icon: MapPin, name: "Farm Selection", href: "/farm-selection" },
    { icon: Leaf, name: "Disease Detection", href: "/disease-detection"},
    { icon: Bug, name: "Pest-Scanner", href: "/pest-scanner"},
    { icon: FlaskConical, name: "Soil Analysis", href: "/soil-analysis"},
    { icon: BarChart3, name: "Analytics", href: "#" },
    { icon: Bell, name: "Alerts", href: "/alerts" },
    { icon: FileText, name: "Reports", href: "#" },
    { icon: HeadphonesIcon, name: "Support", href: "#" },
    // { icon: DollarSign, name: "Pricing", href: "#" },
    { icon: User, name: "Account", href: "/profile" },
  ];

  const handleClick = (e, href) => {
    if (href.startsWith("/")) {
      e.preventDefault();
      navigate(href);
    }
  };

  return (
    <aside className="w-64 bg-card border-r border-border h-screen fixed left-0 top-0 flex flex-col pt-20">
      
      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
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
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
