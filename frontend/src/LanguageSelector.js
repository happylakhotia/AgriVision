import React from "react";
import i18n from "i18next";
import { useTranslation } from "react-i18next";

function LanguageSelector() {
  const { t } = useTranslation();

  const changeLanguage = (e) => {
    i18n.changeLanguage(e.target.value);
  };

  return React.createElement(
    "div",
    { style: { marginBottom: "20px" } },
    React.createElement(
      "label",
      null,
      t("select_language") + ": "
    ),
    React.createElement(
      "select",
      { onChange: changeLanguage, defaultValue: i18n.language },
      React.createElement("option", { value: "en" }, "English"),
      React.createElement("option", { value: "hi" }, "Hindi"),
      React.createElement("option", { value: "bn" }, "Bangla")
    )
  );
}

export default LanguageSelector;
