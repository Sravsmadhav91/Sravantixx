import { z } from "zod";

/**
 * Number inputs give us strings. These helpers validate the string and expose a
 * parsed number to the submit handler, which keeps the field types simple.
 */
export function numericString(message: string) {
  return z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
      message,
    });
}

export function optionalIntegerString(message: string) {
  return z
    .string()
    .trim()
    .refine(
      (value) => value === "" || Number.isInteger(Number(value)),
      { message },
    );
}

export function integerString(message: string) {
  return z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => Number.isInteger(Number(value)), { message });
}
