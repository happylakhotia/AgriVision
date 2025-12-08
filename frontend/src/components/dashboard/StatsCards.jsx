import React from "react";
import { Leaf, Sprout, Trees, AlertTriangle } from "lucide-react";

const StatsCards = ({ field }) => {
  const stats = [
    {
      title: "Area",
      value: field.area,
      subtitle: "Size of selected field",
      icon: Trees,
      bg: "bg-green-50",
      border: "border-green-200",
      iconBg: "bg-green-100",
      text: "text-green-700",
    },
    {
      title: "Soil Conditions",
      value: `${field.soil}%`,
      subtitle: "Soil health score",
      icon: Leaf,
      bg: "bg-lime-50",
      border: "border-lime-200",
      iconBg: "bg-lime-100",
      text: "text-lime-700",
    },
    {
      title: "NDVI",
      value: field.ndvi,
      subtitle: "Vegetation health",
      icon: Sprout,
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      iconBg: "bg-yellow-100",
      text: "text-yellow-700",
    },
    {
      title: "Active Alerts",
      value: "3",
      subtitle: "2 high priority",
      icon: AlertTriangle,
      bg: "bg-red-50",
      border: "border-red-200",
      iconBg: "bg-red-100",
      text: "text-red-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((card, i) => {
        const Icon = card.icon;

        return (
          <div
            key={i}
            className={`
              rounded-xl p-6 border transition-all hover:shadow-md
              ${card.bg} ${card.border}
            `}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <h3 className={`text-sm font-medium ${card.text}`}>
                {card.title}
              </h3>

              <div className={`p-2 rounded-lg ${card.iconBg}`}>
                <Icon className={`w-5 h-5 ${card.text}`} />
              </div>
            </div>

            {/* Values (exact screenshot styling) */}
            <div className="space-y-1">
              <div
                className={`text-[1.75rem] font-semibold leading-tight ${card.text}`}
              >
                {card.value}
              </div>

              <p className={`text-[11px] opacity-60 ${card.text}`}>
                {card.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsCards;
