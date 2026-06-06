/**
 * Formats a number in Indian number system (en-IN locale)
 * Examples: 1,00,000 | 10,000 | 1,000 | 100
 */
export function formatINR(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  if (isNaN(num)) return '0'
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

/**
 * Formats with ₹ prefix using Indian number system
 * Example: ₹1,00,000
 */
export function formatINRWithSymbol(value: number | string | null | undefined): string {
  return `₹${formatINR(value)}`
}
