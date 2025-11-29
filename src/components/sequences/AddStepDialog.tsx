'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useTimeFormat } from '@/contexts/TimeFormatContext'

interface BurstTemplateConfig {
	templateId: string
	templateName?: string
	templatePreview?: string
	variableValues?: Record<string, string>
}

interface EditingStep {
	id: string
	type: 'MESSAGE' | 'DELAY'
	templateId?: string
	templateName?: string
	templatePreview?: string
	variableValues?: Record<string, string>
	label: string
	delayValue: number
	delayUnit: 'MINUTES' | 'HOURS' | 'DAYS'
	scheduledTime?: string | null
	burstTemplates?: BurstTemplateConfig[]
}

interface AddStepDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	metaAccountId: string
	onAdd?: (stepData: any) => void
	onAddStep?: (stepData: any) => void
	editingStep?: EditingStep | null
}

export function AddStepDialog({
	open,
	onOpenChange,
	metaAccountId,
	onAdd,
	onAddStep,
	editingStep,
}: AddStepDialogProps) {
	const [formData, setFormData] = useState({
		templateId: '',
		delayValue: 1,
		delayUnit: 'DAYS',
		scheduledTime: '09:00',
		variableValues: {} as Record<string, string>,
		sendImmediately: false,
	})
	const [isBurstEnabled, setIsBurstEnabled] = useState(false)
	const [burstCount, setBurstCount] = useState(2)
	const [burstMessages, setBurstMessages] = useState<
		Array<{
			templateId: string
			templateName?: string
			variableValues: Record<string, string>
		}>
	>([
		{ templateId: '', templateName: '', variableValues: {} },
		{ templateId: '', templateName: '', variableValues: {} },
	])
	const { timeFormat, formatTime } = useTimeFormat()

	useEffect(() => {
		setBurstMessages((prev) => {
			const next = [...prev]
			while (next.length < burstCount) {
				next.push({ templateId: '', templateName: '', variableValues: {} })
			}
			return next.slice(0, burstCount)
		})
	}, [burstCount])

	// Pre-populate form when editing
	useEffect(() => {
		if (editingStep && open) {
			setFormData({
				templateId: editingStep.templateId || '',
				delayValue:
					typeof editingStep.delayValue === 'number'
						? editingStep.delayValue
						: 1,
				delayUnit: editingStep.delayUnit || 'DAYS',
				scheduledTime: editingStep.scheduledTime || '09:00',
				variableValues: editingStep.variableValues || {},
				sendImmediately: editingStep.delayValue === 0,
			})
			if (editingStep.burstTemplates && editingStep.burstTemplates.length > 1) {
				setIsBurstEnabled(true)
				setBurstCount(editingStep.burstTemplates.length)
				setBurstMessages(
					editingStep.burstTemplates.map((entry) => ({
						templateId: entry.templateId,
						templateName: entry.templateName,
						variableValues: entry.variableValues || {},
					}))
				)
			} else {
				setIsBurstEnabled(false)
				setBurstCount(2)
				setBurstMessages([
					{ templateId: '', templateName: '', variableValues: {} },
					{ templateId: '', templateName: '', variableValues: {} },
				])
			}
		} else if (!open) {
			resetForm()
		}
	}, [editingStep, open])

	const { data: templates } = useQuery({
		queryKey: ['templates', metaAccountId],
		queryFn: async () => {
			const res = await fetch(`/api/templates?status=APPROVED`)
			if (!res.ok) throw new Error('Failed to fetch templates')
			const allTemplates = await res.json()
			return allTemplates.filter((t: any) => t.metaAccountId === metaAccountId)
		},
	})

	const findTemplateById = (id: string) =>
		templates?.find((t: any) => t.id === id)

	const selectedTemplate = findTemplateById(formData.templateId)

	const getTemplateVariables = (templateId: string) => {
		const template = findTemplateById(templateId)
		if (!template) return []
		return (template.bodyText.match(/\{\{\d+\}\}/g) || []).map((v: string) =>
			v.replace(/\{|\}/g, '')
		)
	}

	const isVariableValueFilled = (value?: string) =>
		typeof value === 'string' && value.trim().length > 0

	const hasAllTemplateVariablesFilled = (
		templateId: string,
		variableValues: Record<string, string> = {}
	) => {
		if (!templateId) return false
		const variables = getTemplateVariables(templateId)
		if (variables.length === 0) return true
		return variables.every((token) => isVariableValueFilled(variableValues[token]))
	}

	const VARIABLE_OPTIONS = [
		{ value: '{firstName}', label: 'Contact First Name' },
		{ value: '{lastName}', label: 'Contact Last Name' },
		{ value: '{phoneNumber}', label: 'Contact Phone' },
		{ value: '{offer}', label: 'Offer they see' },
	] as const

	const renderVariableInputs = (
		templateId: string,
		variableValues: Record<string, string>,
		onChange: (token: string, value: string) => void
	) => {
		const variables = getTemplateVariables(templateId)
		if (variables.length === 0) return null

		return (
			<div className="space-y-3">
				<Label>Map Variables</Label>
				{variables.map((varNum: string) => {
					const currentValue = variableValues[varNum] || ''
					const isBuiltIn = VARIABLE_OPTIONS.some((option) => option.value === currentValue)
					const selectValue = currentValue
						? isBuiltIn
							? currentValue
							: 'Custom'
						: ''

					return (
						<div key={varNum} className="grid grid-cols-3 gap-2 items-center">
							<Label className="text-xs">{`{{${varNum}}}`}</Label>
							<div className="col-span-2 space-y-2">
								<Select
									value={selectValue}
									onValueChange={(value) => {
										if (value === 'Custom') {
											if (!currentValue || isBuiltIn) {
												onChange(varNum, '')
											}
										} else {
											onChange(varNum, value)
										}
									}}>
									<SelectTrigger>
										<SelectValue placeholder="Select value" />
									</SelectTrigger>
									<SelectContent>
										{VARIABLE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
										<SelectItem value="Custom">Custom Value...</SelectItem>
									</SelectContent>
								</Select>
								{selectValue === 'Custom' && (
									<Input
										placeholder="Enter custom value"
										value={currentValue}
										onChange={(e) => onChange(varNum, e.target.value)}
									/>
								)}
							</div>
						</div>
					)
				})}
			</div>
		)
	}

	const burstMessagesToRender = burstMessages.slice(0, burstCount)

	const handleBurstTemplateChange = (index: number, templateId: string) => {
		const template = findTemplateById(templateId)
		setBurstMessages((prev) => {
			const next = [...prev]
			next[index] = {
				...next[index],
				templateId,
				templateName: template?.name,
				variableValues: next[index]?.variableValues || {},
			}
			return next
		})
	}

	const handleBurstVariableChange = (
		index: number,
		token: string,
		value: string
	) => {
		setBurstMessages((prev) => {
			const next = [...prev]
			next[index] = {
				...next[index],
				variableValues: {
					...next[index].variableValues,
					[token]: value,
				},
			}
			return next
		})
	}

	const handleSubmit = () => {
		let burstPayload: BurstTemplateConfig[] | undefined

		if (isBurstEnabled) {
			const activeBurst = burstMessagesToRender
			if (activeBurst.some((msg) => !msg.templateId)) {
				alert('Please select a template for every burst message')
				return
			}
			if (
				activeBurst.some(
					(msg) => !hasAllTemplateVariablesFilled(msg.templateId, msg.variableValues)
				)
			) {
				alert('Please fill all required variables for each burst message')
				return
			}
			burstPayload = activeBurst.map((msg) => {
				const template = findTemplateById(msg.templateId)
				return {
					templateId: msg.templateId,
					templateName: template?.name,
					variableValues: msg.variableValues,
				}
			})
		} else if (!formData.templateId) {
			alert('Please select a template')
			return
		} else if (
			!hasAllTemplateVariablesFilled(formData.templateId, formData.variableValues)
		) {
			alert('Please fill all required variables')
			return
		}

		const isImmediate = formData.sendImmediately || formData.delayValue === 0
		const delayValue = isImmediate ? 0 : formData.delayValue
		const delayUnit = isImmediate ? 'MINUTES' : formData.delayUnit
		const scheduledTime =
			!isImmediate && formData.delayUnit === 'DAYS'
				? formData.scheduledTime
				: null

		const stepData: any = {
			nodeType: 'MESSAGE',
			delayValue,
			delayUnit,
			scheduledTime,
		}

		let previewText = ''

		if (burstPayload) {
			stepData.burstTemplates = burstPayload
			stepData.templateId = burstPayload[0]?.templateId
			stepData.templateName = burstPayload[0]?.templateName
			stepData.variableValues = burstPayload[0]?.variableValues || {}
			stepData.label = `📧 ${burstPayload[0]?.templateName || 'Burst Step'}`
			previewText = burstPayload
				.map((msg, idx) => {
					const template = findTemplateById(msg.templateId)
					return template?.bodyText
						? `Message ${idx + 1}:\n${template.bodyText}`
						: msg.templateName || `Message ${idx + 1}`
				})
				.filter(Boolean)
				.join('\n\n')
		} else {
		stepData.templateId = formData.templateId
		stepData.templateName = selectedTemplate?.name
		stepData.variableValues = formData.variableValues
		stepData.label = `📧 ${selectedTemplate?.name}`
			previewText = selectedTemplate?.bodyText || ''
		}

		if (previewText) {
			stepData.templatePreview = previewText
		}

		// Support both callback names
		if (onAddStep) {
			onAddStep(stepData)
		} else if (onAdd) {
			onAdd(stepData)
		}
		resetForm()
	}

	const resetForm = () => {
		setFormData({
			templateId: '',
			delayValue: 1,
			delayUnit: 'DAYS',
			scheduledTime: '09:00',
			variableValues: {},
			sendImmediately: false,
		})
		setIsBurstEnabled(false)
		setBurstCount(2)
		setBurstMessages([
			{ templateId: '', templateName: '', variableValues: {} },
			{ templateId: '', templateName: '', variableValues: {} },
		])
	}

	// Extract variables from template
	const templateVariables = selectedTemplate
		? (selectedTemplate.bodyText.match(/\{\{\d+\}\}/g) || []).map((v: string) =>
				v.replace(/\{|\}/g, '')
		  )
		: []

	const renderTemplatePreview = (template: any) => (
		<div className="rounded-md bg-muted p-3 min-h-[60px]">
			{template ? (
				<>
					<p className="text-sm font-medium mb-1">Preview:</p>
					<p className="text-sm whitespace-pre-line">{template.bodyText}</p>
				</>
			) : (
				<p className="text-sm text-muted-foreground italic">
					Template preview will appear here
				</p>
			)}
		</div>
	)

	const singleTemplateReady =
		!!formData.templateId &&
		hasAllTemplateVariablesFilled(formData.templateId, formData.variableValues)

	const burstTemplatesReady = burstMessagesToRender.every(
		(msg) =>
			!!msg.templateId &&
			hasAllTemplateVariablesFilled(msg.templateId, msg.variableValues)
	)

	const canSubmit = isBurstEnabled ? burstTemplatesReady : singleTemplateReady

	const renderSingleMessageConfigurator = () => (
				<div className="space-y-4">
							<div className="space-y-2">
								<Label>Select Template *</Label>
								<Select
									value={formData.templateId}
									onValueChange={(value) =>
										setFormData({ ...formData, templateId: value })
									}>
									<SelectTrigger>
										<SelectValue placeholder="Choose a template" />
									</SelectTrigger>
									<SelectContent>
										{templates?.map((template: any) => (
											<SelectItem key={template.id} value={template.id}>
												{template.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

			{renderTemplatePreview(selectedTemplate)}

			{renderVariableInputs(formData.templateId, formData.variableValues, (token, value) =>
													setFormData({
														...formData,
														variableValues: {
															...formData.variableValues,
						[token]: value,
														},
													})
			)}
		</div>
	)

	const renderBurstConfigurator = () => (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label>Messages in burst</Label>
				<Select
					value={String(burstCount)}
					onValueChange={(value) => setBurstCount(parseInt(value))}>
					<SelectTrigger className="w-32">
						<SelectValue />
												</SelectTrigger>
												<SelectContent>
						<SelectItem value="2">2 messages</SelectItem>
						<SelectItem value="3">3 messages</SelectItem>
						<SelectItem value="4">4 messages</SelectItem>
												</SelectContent>
											</Select>
										</div>

			{burstMessagesToRender.map((message, index) => {
				const template = findTemplateById(message.templateId)
				return (
					<div key={`burst-${index}`} className="rounded-lg border p-4 space-y-4">
						<div className="flex items-center justify-between">
							<p className="text-sm font-medium">Message {index + 1}</p>
						</div>
						<div className="space-y-2">
							<Label>Select Template *</Label>
							<Select
								value={message.templateId}
								onValueChange={(value) => handleBurstTemplateChange(index, value)}>
								<SelectTrigger>
									<SelectValue placeholder="Choose a template" />
								</SelectTrigger>
								<SelectContent>
									{templates?.map((templateOption: any) => (
										<SelectItem key={templateOption.id} value={templateOption.id}>
											{templateOption.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
								</div>
						{renderTemplatePreview(template)}
						{message.templateId &&
							renderVariableInputs(message.templateId, message.variableValues, (token, value) =>
								handleBurstVariableChange(index, token, value)
							)}
					</div>
				)
			})}
		</div>
	)

	const isEditing = !!editingStep

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? 'Edit Step' : 'Add Step to Sequence'}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-4 rounded-lg border p-4">
						<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div>
								<p className="text-sm font-medium">Multi-message burst</p>
								<p className="text-xs text-muted-foreground">
									Send 2–4 templates instantly within this step.
								</p>
							</div>
							<Switch
								checked={isBurstEnabled}
								onCheckedChange={(checked) => setIsBurstEnabled(checked)}
							/>
						</div>

						{isBurstEnabled ? renderBurstConfigurator() : renderSingleMessageConfigurator()}
					</div>

								<div className="border-t pt-4 space-y-4">
									<h3 className="text-sm font-medium">Delay Configuration</h3>

									<div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
										<div>
											<p className="text-sm font-medium">Send immediately (no wait)</p>
											<p className="text-xs text-muted-foreground">
									Trigger this step as soon as the previous one finishes.
											</p>
										</div>
										<Switch
											checked={formData.sendImmediately}
											onCheckedChange={(checked) =>
												setFormData((prev) => ({
													...prev,
													sendImmediately: checked,
													delayValue: checked ? 0 : prev.delayValue || 1,
													delayUnit: checked ? 'MINUTES' : prev.delayUnit,
												}))
											}
										/>
									</div>

									<div className="flex flex-wrap gap-4 items-end">
										<div className="space-y-2">
											<Label>Wait Duration *</Label>
											<Input
												type="number"
												min="0"
												value={formData.delayValue}
												disabled={formData.sendImmediately}
												className="w-28"
												onChange={(e) =>
													setFormData({ ...formData, delayValue: parseInt(e.target.value) })
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Unit *</Label>
											<Select
												value={formData.delayUnit}
												disabled={formData.sendImmediately}
												onValueChange={(value) =>
													setFormData({ ...formData, delayUnit: value as any })
												}>
												<SelectTrigger className="w-28">
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

									{formData.delayUnit === 'DAYS' && !formData.sendImmediately && (
										<div className="space-y-2">
											<Label>
												Send Time ({timeFormat === '24h' ? '24-hour' : 'AM/PM'} view) *
											</Label>
											<Input
												type="time"
												value={formData.scheduledTime}
												disabled={formData.sendImmediately}
												className="w-36"
												onChange={(e) =>
													setFormData({ ...formData, scheduledTime: e.target.value })
												}
											/>
											<p className="text-xs text-muted-foreground">
												Display example: {formatTime(formData.scheduledTime)}
											</p>
											<p className="text-xs text-muted-foreground">
												Messages will be sent during business hours
											</p>
										</div>
									)}
								</div>
				</div>

				<div className="flex justify-end gap-2 mt-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							onOpenChange(false)
							resetForm()
						}}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={!canSubmit}
						className={!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}>
						{isEditing ? 'Update Step' : 'Add Step'}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
