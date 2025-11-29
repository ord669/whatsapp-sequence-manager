'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
	LayoutDashboard,
	Users,
	FileText,
	GitBranch,
	Settings,
	Phone,
	ChevronLeft,
	ChevronRight,
} from 'lucide-react'

const navigation = [
	{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
	{ name: 'Meta Accounts', href: '/dashboard/meta-accounts', icon: Phone },
	{ name: 'Contacts', href: '/dashboard/contacts', icon: Users },
	{ name: 'Templates', href: '/dashboard/templates', icon: FileText },
	{ name: 'Sequences', href: '/dashboard/sequences', icon: GitBranch },
	{ name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar() {
	const pathname = usePathname()
	const [isCollapsed, setIsCollapsed] = useState(false)

	return (
		<div
			className={cn(
				'flex h-screen flex-col overflow-hidden border-r border-gray-200 bg-white shadow-xl transition-all duration-300',
				isCollapsed ? 'w-20' : 'w-64'
			)}>
			<div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
				<span className="text-xl font-semibold text-slate-900">
					{isCollapsed ? 'WA' : 'WhatsApp Manager'}
				</span>
				<button
					type="button"
					onClick={() => setIsCollapsed((prev) => !prev)}
					className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
					aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					aria-pressed={isCollapsed}>
					{isCollapsed ? (
						<ChevronRight className="h-5 w-5" />
					) : (
						<ChevronLeft className="h-5 w-5" />
					)}
				</button>
			</div>
			<nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
				{navigation.map((item) => {
					// For dashboard, use exact match. For others, check if path starts with the href
					const isActive =
						item.href === '/dashboard'
							? pathname === '/dashboard'
							: pathname.startsWith(item.href)

					return (
						<Link
							key={item.name}
							href={item.href}
							title={isCollapsed ? item.name : undefined}
							className={cn(
								'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
								isCollapsed ? 'justify-center' : '',
								isActive
									? 'bg-slate-900 text-white shadow-sm'
									: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
							)}>
							<item.icon
								className={cn(
									'h-5 w-5 flex-shrink-0',
									!isCollapsed && 'mr-3',
									isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'
								)}
							/>
							{!isCollapsed && <span>{item.name}</span>}
						</Link>
					)
				})}
			</nav>
		</div>
	)
}
