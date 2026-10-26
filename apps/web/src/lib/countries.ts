export interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { name: "India", code: "IN", dialCode: "+91", flag: "🇮🇳" },
  { name: "United States", code: "US", dialCode: "+1", flag: "🇺🇸" },
  { name: "United Kingdom", code: "GB", dialCode: "+44", flag: "🇬🇧" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971", flag: "🇦🇪" },
  { name: "Canada", code: "CA", dialCode: "+1", flag: "🇨🇦" },
  { name: "Australia", code: "AU", dialCode: "+61", flag: "🇦🇺" },
  { name: "Germany", code: "DE", dialCode: "+49", flag: "🇩🇪" },
  { name: "France", code: "FR", dialCode: "+33", flag: "🇫🇷" },
  { name: "Singapore", code: "SG", dialCode: "+65", flag: "🇸🇬" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966", flag: "🇸🇦" },
  { name: "Qatar", code: "QA", dialCode: "+974", flag: "🇶🇦" },
  { name: "Kuwait", code: "KW", dialCode: "+965", flag: "🇰🇼" },
  { name: "Oman", code: "OM", dialCode: "+968", flag: "🇴🇲" },
  { name: "Bahrain", code: "BH", dialCode: "+973", flag: "🇧🇭" },
  { name: "Japan", code: "JP", dialCode: "+81", flag: "🇯🇵" },
  { name: "South Korea", code: "KR", dialCode: "+82", flag: "🇰🇷" },
  { name: "China", code: "CN", dialCode: "+86", flag: "🇨🇳" },
  { name: "Hong Kong", code: "HK", dialCode: "+852", flag: "🇭🇰" },
  { name: "Taiwan", code: "TW", dialCode: "+886", flag: "🇹🇼" },
  { name: "Malaysia", code: "MY", dialCode: "+60", flag: "🇲🇾" },
  { name: "Indonesia", code: "ID", dialCode: "+62", flag: "🇮🇩" },
  { name: "Philippines", code: "PH", dialCode: "+63", flag: "🇵🇭" },
  { name: "Thailand", code: "TH", dialCode: "+66", flag: "🇹🇭" },
  { name: "Vietnam", code: "VN", dialCode: "+84", flag: "🇻🇳" },
  { name: "New Zealand", code: "NZ", dialCode: "+64", flag: "🇳🇿" },
  { name: "South Africa", code: "ZA", dialCode: "+27", flag: "🇿🇦" },
  { name: "Nigeria", code: "NG", dialCode: "+234", flag: "🇳🇬" },
  { name: "Kenya", code: "KE", dialCode: "+254", flag: "🇰🇪" },
  { name: "Ghana", code: "GH", dialCode: "+233", flag: "🇬🇭" },
  { name: "Egypt", code: "EG", dialCode: "+20", flag: "🇪🇬" },
  { name: "Brazil", code: "BR", dialCode: "+55", flag: "🇧🇷" },
  { name: "Mexico", code: "MX", dialCode: "+52", flag: "🇲🇽" },
  { name: "Argentina", code: "AR", dialCode: "+54", flag: "🇦🇷" },
  { name: "Colombia", code: "CO", dialCode: "+57", flag: "🇨🇴" },
  { name: "Chile", code: "CL", dialCode: "+56", flag: "🇨🇱" },
  { name: "Spain", code: "ES", dialCode: "+34", flag: "🇪🇸" },
  { name: "Italy", code: "IT", dialCode: "+39", flag: "🇮🇹" },
  { name: "Netherlands", code: "NL", dialCode: "+31", flag: "🇳🇱" },
  { name: "Switzerland", code: "CH", dialCode: "+41", flag: "🇨🇭" },
  { name: "Sweden", code: "SE", dialCode: "+46", flag: "🇸🇪" },
  { name: "Norway", code: "NO", dialCode: "+47", flag: "🇳🇴" },
  { name: "Denmark", code: "DK", dialCode: "+45", flag: "🇩🇰" },
  { name: "Finland", code: "FI", dialCode: "+358", flag: "🇫🇮" },
  { name: "Ireland", code: "IE", dialCode: "+353", flag: "🇮🇪" },
  { name: "Poland", code: "PL", dialCode: "+48", flag: "🇵🇱" },
  { name: "Austria", code: "AT", dialCode: "+43", flag: "🇦🇹" },
  { name: "Belgium", code: "BE", dialCode: "+32", flag: "🇧🇪" },
  { name: "Portugal", code: "PT", dialCode: "+351", flag: "🇵🇹" },
  { name: "Greece", code: "GR", dialCode: "+30", flag: "🇬🇷" },
  { name: "Czech Republic", code: "CZ", dialCode: "+420", flag: "🇨🇿" },
  { name: "Hungary", code: "HU", dialCode: "+36", flag: "🇭🇺" },
  { name: "Romania", code: "RO", dialCode: "+40", flag: "🇷🇴" },
  { name: "Turkey", code: "TR", dialCode: "+90", flag: "🇹🇷" },
  { name: "Israel", code: "IL", dialCode: "+972", flag: "🇮🇱" },
  { name: "Pakistan", code: "PK", dialCode: "+92", flag: "🇵🇰" },
  { name: "Bangladesh", code: "BD", dialCode: "+880", flag: "🇧🇩" },
  { name: "Sri Lanka", code: "LK", dialCode: "+94", flag: "🇱🇰" },
  { name: "Nepal", code: "NP", dialCode: "+977", flag: "🇳🇵" },
  { name: "Russia", code: "RU", dialCode: "+7", flag: "🇷🇺" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // India (+91)

/**
 * Finds a country from the list matching a dialed prefix in the raw input.
 */
export function detectCountryFromInput(rawInput: string): { country: Country; localNumber: string } | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Sorted by dialCode length descending so +971 is matched before +97 etc.
  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

  for (const c of sorted) {
    if (trimmed.startsWith(c.dialCode)) {
      const rest = trimmed.slice(c.dialCode.length).trim();
      return { country: c, localNumber: rest };
    }
  }

  // Also check without the '+' if string starts with dial digits e.g. 919999999999
  const digitsOnly = trimmed.replace(/\D/g, "");
  for (const c of sorted) {
    const codeDigits = c.dialCode.replace(/\D/g, "");
    if (digitsOnly.startsWith(codeDigits) && digitsOnly.length > codeDigits.length + 5) {
      const restDigits = digitsOnly.slice(codeDigits.length);
      return { country: c, localNumber: restDigits };
    }
  }

  return null;
}

/**
 * Normalizes any phone number into strict E.164 (+<country_code><subscriber_number>).
 */
export function normalizePhoneNumber(
  localInput: string,
  dialCode: string = "+91"
): {
  normalized: string;
  formattedDisplay: string;
  isValid: boolean;
} {
  const trimmed = localInput.trim();
  if (!trimmed) {
    return { normalized: "", formattedDisplay: "", isValid: false };
  }

  // 1. If user entered full international number starting with '+'
  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) {
      return {
        normalized: `+${digits}`,
        formattedDisplay: `+${digits}`,
        isValid: true,
      };
    }
    return {
      normalized: `+${digits}`,
      formattedDisplay: trimmed,
      isValid: digits.length >= 7,
    };
  }

  // 2. Strip non-digits
  let digits = trimmed.replace(/\D/g, "");

  // 3. Strip leading trunk '0' if present (e.g. 09999999999 -> 9999999999)
  const cleanDialCodeDigits = dialCode.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }

  // 4. If digits already start with the selected dial code digits (e.g. user entered 919999999999 with +91 selected)
  if (digits.startsWith(cleanDialCodeDigits) && digits.length > cleanDialCodeDigits.length + 5) {
    digits = digits.slice(cleanDialCodeDigits.length);
  }

  const normalized = `${dialCode}${digits}`;
  const isValid = digits.length >= 6 && digits.length <= 14;

  // Format nicely for display (groups of 5 or 3/3/4)
  let formattedDisplay = "";
  if (digits.length === 10) {
    formattedDisplay = `${dialCode} ${digits.slice(0, 5)} ${digits.slice(5)}`;
  } else if (digits.length > 5) {
    formattedDisplay = `${dialCode} ${digits.slice(0, 4)} ${digits.slice(4)}`;
  } else {
    formattedDisplay = `${dialCode} ${digits}`;
  }

  return {
    normalized,
    formattedDisplay,
    isValid,
  };
}
