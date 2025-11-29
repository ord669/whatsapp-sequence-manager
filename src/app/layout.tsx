import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: 'WhatsApp Sequence Manager',
	description: 'Manage WhatsApp marketing sequences with ease',
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="en">
			<body
				className={cn(
					'min-h-screen bg-background text-foreground antialiased',
					inter.className
				)}>
				<Providers>
					<div className="flex min-h-screen flex-col">{children}</div>
				</Providers>
			</body>
		</html>
	)
}
