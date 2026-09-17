/** Indian PAN format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F). */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function isValidPan(pan: string): boolean {
  return PAN_REGEX.test(pan.trim().toUpperCase());
}
