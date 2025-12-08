import React from "react";
import { Leaf, Sprout, Trees, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

const StatsCards = ({ field, totalFields = 1, alertsData = { total: 0, highPriority: 0 } }) => {
  const { t } = useTranslation();

  // Calculate percentage for active fields (assuming max 10 fields as 100%)
  const fieldPercentage = totalFields > 0 ? Math.min((totalFields / 10) * 100, 100).toFixed(0) : "0";
  
  // Calculate high priority percentage (out of total alerts)
  const highPriorityPercentage = alertsData.total > 0 
    ? ((alertsData.highPriority / alertsData.total) * 100).toFixed(0)
    : "0";

  const stats = [
    {
      titleKey: "stats_active_fields",
      subtitleKey: "stats_active_fields_sub",
      value: totalFields,
      percentage: `${fieldPercentage}% from the last week`,
      icon: Trees,
      bg: "bg-green-50",
      border: "border-green-200",
      iconBg: "bg-green-100",
      text: "text-green-700",
    },
    {
      titleKey: "stats_soil_conditions",
      subtitleKey: "stats_soil_conditions_sub",
      value: field && field.soil != null ? `${field.soil}%` : "--",
      icon: Leaf,
      bg: "bg-lime-50",
      border: "border-lime-200",
      iconBg: "bg-lime-100",
      text: "text-lime-700",
    },
    {
      titleKey: "stats_vegetation_indices",
      subtitleKey: "stats_vegetation_indices_sub",
      value: field && typeof field.ndvi === "number" ? field.ndvi.toFixed(2) : "0.72",
      icon: Sprout,
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      iconBg: "bg-yellow-100",
      text: "text-yellow-700",
    },
    {
      titleKey: "stats_active_alerts",
      subtitleKey: "stats_active_alerts_sub",
      value: alertsData.total,
      percentage: alertsData.total > 0 ? `${highPriorityPercentage}% High Priority` : "",
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
                {t(card.titleKey)}
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
                {t(card.subtitleKey)}
              </p>
              
              {/* Show percentage if available */}
              {card.percentage && (
                <p className={`text-xs font-semibold ${card.text} mt-1`}>
                  {card.percentage}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsCards;
