'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useTimeFormat } from '@/contexts/TimeFormatContext'
import { Switch } from '@/components/ui/switch'

type DelayUnit = 'MINUTES' | 'HOURS' | 'DAYS'

interface DelayEditDialogProps {
	open: boolean
	initialValue: number
	initialUnit: DelayUnit
	initialScheduledTime: string
	onClose: () => void
	onSave: (value: number, unit: DelayUnit, scheduledTime: string | null) => void
}

export function DelayEditDialog({
	open,
	initialValue,
	initialUnit,
	initialScheduledTime,
	onClose,
	onSave,
}: DelayEditDialogProps) {
	const [value, setValue] = useState<number>(initialValue)
	const [unit, setUnit] = useState<DelayUnit>(initialUnit)
	const [scheduledTime, setScheduledTime] = useState(initialScheduledTime)
	const { timeFormat, formatTime } = useTimeFormat()
	const [sendImmediately, setSendImmediately] = useState(initialValue === 0)

	useEffect(() => {
		if (open) {
			setValue(initialValue)
			setUnit(initialUnit)
			setScheduledTime(initialScheduledTime)
			setSendImmediately(initialValue === 0)
		}
	}, [initialScheduledTime, initialUnit, initialValue, open])

	const handleSave = () => {
		if (!sendImmediately && (Number.isNaN(value) || value < 0)) return
		const effectiveValue = sendImmediately ? 0 : value
		const effectiveUnit = sendImmediately ? 'MINUTES' : unit
		const timeValue =
			!sendImmediately && effectiveUnit === 'DAYS' ? scheduledTime : null
		onSave(effectiveValue, effectiveUnit, timeValue)
		onClose()
	}

	return (
		<Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : null)}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delay Settings</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
						<div>
							<p className="text-sm font-medium">Send immediately (no wait)</p>
							<p className="text-xs text-muted-foreground">
								Trigger the next message as soon as the previous step completes.
							</p>
						</div>
						<Switch
							checked={sendImmediately}
							onCheckedChange={(checked) => {
								setSendImmediately(checked)
								if (checked) {
									setValue(0)
									setUnit('MINUTES')
								}
							}}
						/>
					</div>

					<div className="flex flex-wrap gap-4 items-end">
						<div className="space-y-2">
							<Label>Wait Duration</Label>
							<Input
								type="number"
								min="0"
								value={value}
								disabled={sendImmediately}
								className="w-28"
								onChange={(e) => setValue(Number(e.target.value))}
							/>
						</div>
						<div className="space-y-2">
							<Label>Unit</Label>
							<Select
								value={unit}
								disabled={sendImmediately}
								onValueChange={(val) => {
									setUnit(val as DelayUnit)
									if (val !== 'DAYS') {
										setScheduledTime('09:00')
									}
								}}>
								<SelectTrigger className="w-32">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="MINUTES">Minutes</SelectItem>
									<SelectItem value="HOURS">Hours</SelectItem>
									<SelectItem value="DAYS">Days</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{unit === 'DAYS' && !sendImmediately && (
						<div className="space-y-2">
							<Label>
								Send Time ({timeFormat === '24h' ? '24-hour' : 'AM/PM'} view)
							</Label>
							<Input
								type="time"
								value={scheduledTime}
								disabled={sendImmediately}
								className="w-36"
								onChange={(e) => setScheduledTime(e.target.value)}
							/>
							<p className="text-xs text-muted-foreground">
								Display example: {formatTime(scheduledTime)}
							</p>
						</div>
					)}

					<p className="text-xs text-muted-foreground">
						Set the wait time between this step and the previous one. Use 0 for immediate
						sending.
					</p>
				</div>

				<div className="flex justify-end gap-2">
					<Button variant="outline" type="button" onClick={onClose}>
						Cancel
					</Button>
					<Button type="button" onClick={handleSave}>
						Save
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

