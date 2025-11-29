'use client'

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react'

export type TimeFormatPreference = '24h' | '12h'

interface TimeFormatContextValue {
	timeFormat: TimeFormatPreference
	setTimeFormat: (format: TimeFormatPreference) => void
	formatTime: (value: string | null | undefined) => string
}

const TimeFormatContext = createContext<TimeFormatContextValue | undefined>(
	undefined
)

const STORAGE_KEY = 'wsm-time-format'
const DEFAULT_TIME_24H = '09:00'

export function TimeFormatProvider({ children }: { children: React.ReactNode }) {
	const [timeFormat, setTimeFormat] = useState<TimeFormatPreference>('24h')

	// Hydrate from localStorage on mount
	useEffect(() => {
		if (typeof window === 'undefined') return
		try {
			const stored = window.localStorage.getItem(STORAGE_KEY) as
				| TimeFormatPreference
				| null
			if (stored === '24h' || stored === '12h') {
				setTimeFormat(stored)
			}
		} catch {
			// Ignore storage errors (private mode, etc.)
		}
	}, [])

	// Persist whenever preference changes
	useEffect(() => {
		if (typeof window === 'undefined') return
		try {
			window.localStorage.setItem(STORAGE_KEY, timeFormat)
		} catch {
			// Ignore storage errors
		}
	}, [timeFormat])

	const formatTime = useCallback(
		(value: string | null | undefined) => {
			if (!value) {
				return timeFormat === '24h' ? DEFAULT_TIME_24H : '9:00 AM'
			}

			const [rawHours, rawMinutes = '00'] = value.split(':')
			const hours = Number(rawHours)
			if (Number.isNaN(hours)) {
				return value
			}
			const minutes = rawMinutes.padStart(2, '0')

			if (timeFormat === '24h') {
				return `${hours.toString().padStart(2, '0')}:${minutes}`
			}

			const period = hours >= 12 ? 'PM' : 'AM'
			const normalizedHours = hours % 12 || 12
			return `${normalizedHours}:${minutes} ${period}`
		},
		[timeFormat]
	)

	const value = useMemo(
		() => ({
			timeFormat,
			setTimeFormat,
			formatTime,
		}),
		[formatTime, timeFormat]
	)

	return (
		<TimeFormatContext.Provider value={value}>
			{children}
		</TimeFormatContext.Provider>
	)
}

export function useTimeFormat() {
	const context = useContext(TimeFormatContext)
	if (!context) {
		throw new Error('useTimeFormat must be used inside a TimeFormatProvider')
	}
	return context
}

