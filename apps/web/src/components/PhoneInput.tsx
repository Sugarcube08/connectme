"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, Phone } from "lucide-react";
import {
  COUNTRIES,
  Country,
  DEFAULT_COUNTRY,
  detectCountryFromInput,
  normalizePhoneNumber,
} from "@/lib/countries";

interface PhoneInputProps {
  value: string; // The normalized phone number or current raw value
  onChange: (normalizedValue: string, isValid: boolean) => void;
  onBlur?: () => void;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  required = true,
  disabled = false,
  error,
  placeholder,
  className = "",
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [localNumber, setLocalNumber] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize or synchronize from incoming value
  useEffect(() => {
    if (!value) return;

    // Detect if value contains a country code
    const detected = detectCountryFromInput(value);
    if (detected) {
      setSelectedCountry(detected.country);
      setLocalNumber(detected.localNumber);
    } else {
      // Just local digits or custom
      const cleanDigits = value.replace(selectedCountry.dialCode, "").trim();
      setLocalNumber(cleanDigits);
    }
  }, []); // Run on mount only to preserve user typing experience

  // Filter countries by name, code, or dial code
  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return COUNTRIES;

    return COUNTRIES.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const codeMatch = c.code.toLowerCase().includes(q);
      const dialMatch = c.dialCode.replace(/\D/g, "").includes(q);
      return nameMatch || codeMatch || dialMatch;
    });
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Auto-focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery("");

    // Re-normalize with the new country dial code
    const { normalized, isValid } = normalizePhoneNumber(localNumber, country.dialCode);
    onChange(normalized, isValid);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // If user pasted a full number with a + or different country code
    if (raw.trim().startsWith("+")) {
      const detected = detectCountryFromInput(raw);
      if (detected) {
        setSelectedCountry(detected.country);
        setLocalNumber(detected.localNumber);
        const { normalized, isValid } = normalizePhoneNumber(detected.localNumber, detected.country.dialCode);
        onChange(normalized, isValid);
        return;
      }
    }

    setLocalNumber(raw);
    const { normalized, isValid } = normalizePhoneNumber(raw, selectedCountry.dialCode);
    onChange(normalized, isValid);
  };

  const { normalized, formattedDisplay, isValid } = normalizePhoneNumber(
    localNumber,
    selectedCountry.dialCode
  );

  return (
    <div className={`relative ${className}`}>
      <div className="flex rounded-xl border border-obsidian-border bg-obsidian-elevated transition focus-within:border-royalViolet focus-within:ring-1 focus-within:ring-royalViolet">
        {/* Country Picker Trigger */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="flex h-full items-center gap-2 border-r border-obsidian-border bg-obsidian-surface/60 px-3.5 py-3 text-sm text-warmIvory hover:bg-obsidian-border/50 focus:outline-none transition rounded-l-xl disabled:opacity-50"
            title={`${selectedCountry.name} (${selectedCountry.dialCode})`}
          >
            <span className="text-lg leading-none" role="img" aria-label={selectedCountry.name}>
              {selectedCountry.flag}
            </span>
            <span className="font-semibold text-warmIvory/90 text-xs sm:text-sm">
              {selectedCountry.dialCode}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-light transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Searchable Country Dropdown Popover */}
          {isOpen && (
            <div className="absolute left-0 top-full z-50 mt-2 w-72 sm:w-80 rounded-2xl border border-obsidian-border bg-obsidian-surface p-2 shadow-2xl backdrop-blur-2xl">
              {/* Search Field */}
              <div className="relative mb-2 px-1">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-light" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search country or dial code..."
                  className="w-full rounded-xl border border-obsidian-border/80 bg-obsidian-elevated/90 py-2 pl-9 pr-3 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
                />
              </div>

              {/* Country List */}
              <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-obsidian-border scrollbar-track-transparent">
                {filteredCountries.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-light">
                    No matching countries found
                  </div>
                ) : (
                  filteredCountries.map((c) => {
                    const isSelected = c.code === selectedCountry.code;
                    return (
                      <button
                        key={`${c.code}-${c.dialCode}`}
                        type="button"
                        onClick={() => handleCountrySelect(c)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${isSelected
                          ? "bg-royalViolet/20 text-warmIvory font-medium"
                          : "text-warmIvory/80 hover:bg-obsidian-elevated hover:text-warmIvory"
                          }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="text-base leading-none">{c.flag}</span>
                          <span className="truncate">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2 pl-2 shrink-0">
                          <span className="font-mono text-slate-light">{c.dialCode}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-royalViolet" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Local Number Input Field */}
        <div className="relative flex-1">
          <input
            type="tel"
            required={required}
            disabled={disabled}
            value={localNumber}
            onChange={handleInputChange}
            onBlur={onBlur}
            placeholder={placeholder || (selectedCountry.code === "IN" ? "99999 99999" : "555-0199")}
            className="w-full rounded-r-xl bg-transparent px-4 py-3 text-sm text-warmIvory placeholder-slate focus:outline-none disabled:opacity-50"
          />
        </div>
      </div>

      {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
