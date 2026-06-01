"use client";

import React from "react";

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function AmountInput({
  value,
  onChange,
  decimals = 7,
  disabled = false,
  placeholder = "0.00",
  className = "",
}: AmountInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    // Strip non-numeric characters except decimal point
    // This prevents scientific notation (e, +, -) and multiple decimals
    newValue = newValue.replace(/[^0-9.]/g, "");

    // Split by decimal point to ensure only one decimal point
    // "1.2.3" becomes "1.23" (joining all parts after the first)
    const parts = newValue.split(".");
    if (parts.length > 2) {
      newValue = parts[0] + "." + parts.slice(1).join("");
    }

    // Cap decimal places based on the decimals prop
    if (parts.length >= 2 && parts[1]) {
      const integerPart = parts[0];
      const decimalPart = parts[1].slice(0, decimals);
      if (decimalPart) {
        newValue = integerPart + "." + decimalPart;
      } else {
        newValue = integerPart;
      }
    }

    onChange(newValue);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      className={className}
    />
  );
}