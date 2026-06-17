const KEEP_UPPER = new Set([
  "INC", "CORP", "LLC", "LP", "LTD", "PLC", "ETF", "AG", "SA", "NV", "BV",
  "USA", "US", "UK", "II", "III", "IV", "AI", "IT", "S&P",
]);

export function toTitleCase(str: string | null | undefined): string {
  if (!str) return str ?? "";
  return str
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const upper = word.replace(/[^A-Za-z]/g, "").toUpperCase();
      if (KEEP_UPPER.has(upper)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
