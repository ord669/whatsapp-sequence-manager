import { BusinessHours } from '@prisma/client'
import { addDays, addHours, addMinutes, format, parse, isAfter, isBefore, getDay } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export interface BusinessHoursConfig {
  timezone: string
  mondayStart?: string | null
  mondayEnd?: string | null
  tuesdayStart?: string | null
  tuesdayEnd?: string | null
  wednesdayStart?: string | null
  wednesdayEnd?: string | null
  thursdayStart?: string | null
  thursdayEnd?: string | null
  fridayStart?: string | null
  fridayEnd?: string | null
  saturdayStart?: string | null
  saturdayEnd?: string | null
  sundayStart?: string | null
  sundayEnd?: string | null
}

export function getNextBusinessTime(
  targetDate: Date,
  businessHours: BusinessHoursConfig
): Date {
  const timezone = businessHours.timezone
  let currentDate = toZonedTime(targetDate, timezone)
  
  // Try up to 14 days to find next business time
  for (let i = 0; i < 14; i++) {
    const dayOfWeek = getDay(currentDate) // 0 = Sunday, 1 = Monday, etc.
    const dayHours = getDayHours(dayOfWeek, businessHours)
    
    if (!dayHours) {
      // Day is closed, move to next day at midnight
      currentDate = addDays(currentDate, 1)
      currentDate = parse('00:00', 'HH:mm', currentDate)
      continue
    }
    
    const { start, end } = dayHours
    const startTime = parse(start, 'HH:mm', currentDate)
    const endTime = parse(end, 'HH:mm', currentDate)
    
    if (isBefore(currentDate, startTime)) {
      // Before business hours, return opening time
      return fromZonedTime(startTime, timezone)
    } else if (isAfter(currentDate, endTime)) {
      // After business hours, move to next day
      currentDate = addDays(currentDate, 1)
      currentDate = parse('00:00', 'HH:mm', currentDate)
      continue
    } else {
      // Within business hours
      return fromZonedTime(currentDate, timezone)
    }
  }
  
  // Fallback: return original date if no business hours found
  return targetDate
}

function getDayHours(
  dayOfWeek: number,
  businessHours: BusinessHoursConfig
): { start: string; end: string } | null {
  switch (dayOfWeek) {
    case 0: // Sunday
      if (businessHours.sundayStart && businessHours.sundayEnd) {
        return { start: businessHours.sundayStart, end: businessHours.sundayEnd }
      }
      return null
    case 1: // Monday
      if (businessHours.mondayStart && businessHours.mondayEnd) {
        return { start: businessHours.mondayStart, end: businessHours.mondayEnd }
      }
      return null
    case 2: // Tuesday
      if (businessHours.tuesdayStart && businessHours.tuesdayEnd) {
        return { start: businessHours.tuesdayStart, end: businessHours.tuesdayEnd }
      }
      return null
    case 3: // Wednesday
      if (businessHours.wednesdayStart && businessHours.wednesdayEnd) {
        return { start: businessHours.wednesdayStart, end: businessHours.wednesdayEnd }
      }
      return null
    case 4: // Thursday
      if (businessHours.thursdayStart && businessHours.thursdayEnd) {
        return { start: businessHours.thursdayStart, end: businessHours.thursdayEnd }
      }
      return null
    case 5: // Friday
      if (businessHours.fridayStart && businessHours.fridayEnd) {
        return { start: businessHours.fridayStart, end: businessHours.fridayEnd }
      }
      return null
    case 6: // Saturday
      if (businessHours.saturdayStart && businessHours.saturdayEnd) {
        return { start: businessHours.saturdayStart, end: businessHours.saturdayEnd }
      }
      return null
    default:
      return null
  }
}

export function calculateNextScheduledTime(
  lastMessageTime: Date,
  delayValue: number,
  delayUnit: 'MINUTES' | 'HOURS' | 'DAYS',
  scheduledTime: string | null,
  businessHours: BusinessHoursConfig
): Date {
  let nextTime: Date
  
  if (delayUnit === 'MINUTES') {
    // Add minutes, check business hours
    nextTime = addMinutes(lastMessageTime, delayValue)
    return getNextBusinessTime(nextTime, businessHours)
  } else if (delayUnit === 'HOURS') {
    // Add hours, check business hours
    nextTime = addHours(lastMessageTime, delayValue)
    return getNextBusinessTime(nextTime, businessHours)
  } else {
    // DAYS - must have scheduled time
    if (!scheduledTime) {
      throw new Error('scheduledTime is required for DAYS delay unit')
    }
    
    // Add days
    nextTime = addDays(lastMessageTime, delayValue)
    
    // Set to scheduled time
    const timezone = businessHours.timezone
    const zonedDate = toZonedTime(nextTime, timezone)
    const scheduledDateTime = parse(scheduledTime, 'HH:mm', zonedDate)
    
    // Convert back to UTC and check business hours
    const utcScheduledTime = fromZonedTime(scheduledDateTime, timezone)
    return getNextBusinessTime(utcScheduledTime, businessHours)
  }
}

