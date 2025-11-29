'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CustomTabsContextType {
	activeTab: string
	setActiveTab: (tab: string) => void
}

const CustomTabsContext = createContext<CustomTabsContextType | undefined>(undefined)

function useCustomTabs() {
	const context = useContext(CustomTabsContext)
	if (!context) {
		throw new Error('Tab components must be used within CustomTabs')
	}
	return context
}

interface CustomTabsProps {
	value: string
	onValueChange: (value: string) => void
	children: ReactNode
	className?: string
}

export function CustomTabs({ value, onValueChange, children, className }: CustomTabsProps) {
	return (
		<CustomTabsContext.Provider value={{ activeTab: value, setActiveTab: onValueChange }}>
			<div className={cn('flex flex-col', className)}>{children}</div>
		</CustomTabsContext.Provider>
	)
}

interface CustomTabsListProps {
	children: ReactNode
	className?: string
}

export function CustomTabsList({ children, className }: CustomTabsListProps) {
	return (
		<div
			className={cn(
				'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
				className
			)}>
			{children}
		</div>
	)
}

interface CustomTabsTriggerProps {
	value: string
	children: ReactNode
	className?: string
	disabled?: boolean
}

export function CustomTabsTrigger({
	value,
	children,
	className,
	disabled = false,
}: CustomTabsTriggerProps) {
	const { activeTab, setActiveTab } = useCustomTabs()
	const isActive = activeTab === value

	return (
		<button
			type="button"
			onClick={() => !disabled && setActiveTab(value)}
			disabled={disabled}
			className={cn(
				'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
				isActive ? 'bg-background text-foreground shadow-sm' : 'hover:bg-background/50',
				className
			)}>
			{children}
		</button>
	)
}

interface CustomTabsContentProps {
	value: string
	children: ReactNode
	className?: string
}

export function CustomTabsContent({ value, children, className }: CustomTabsContentProps) {
	const { activeTab } = useCustomTabs()
	const isActive = activeTab === value

	// Keep all tabs mounted with full dimensions but hide inactive ones
	// This ensures React Flow can calculate dimensions properly
	if (!isActive) {
		return (
			<div
				className={cn(
					'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
					className
				)}
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: '100%',
					height: '100%',
					visibility: 'hidden',
					pointerEvents: 'none',
					zIndex: -1,
				}}>
				{children}
			</div>
		)
	}

	return (
		<div
			className={cn(
				'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				className
			)}>
			{children}
		</div>
	)
}

