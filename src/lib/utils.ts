import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(phone: string): string {
  // Format phone number for display
  if (phone.startsWith('+1') && phone.length === 12) {
    return `+1 ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`
  }
  return phone
}

export function parsePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  return phone.replace(/[^\d+]/g, '')
}

