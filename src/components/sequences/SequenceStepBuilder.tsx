'use client'

import { useState } from 'react'
import {
	DragDropContext,
	Droppable,
	Draggable,
	type DropResult,
} from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Plus,
	Trash2,
	Edit,
	Clock,
	GripVertical,
} from 'lucide-react'
import { AddStepDialog } from './AddStepDialog'
import { DelayEditDialog } from './DelayEditDialog'
import { useTimeFormat } from '@/contexts/TimeFormatContext'
import { cn } from '@/lib/utils'

export interface BurstTemplateConfig {
	templateId: string
	templateName?: string
	variableValues?: Record<string, string>
}

export interface SequenceStep {
	id: string
	type: 'MESSAGE' | 'DELAY'
	templateId?: string
	templateName?: string
	label: string
	delayValue: number
	delayUnit: 'MINUTES' | 'HOURS' | 'DAYS'
	scheduledTime?: string | null
	burstTemplates?: BurstTemplateConfig[]
}

interface SequenceStepBuilderProps {
	metaAccountId: string
	steps: SequenceStep[]
	onChange: (steps: SequenceStep[]) => void
	className?: string
}

// History state for undo/redo
export function SequenceStepBuilder({
	metaAccountId,
	steps,
	onChange,
	className,
}: SequenceStepBuilderProps) {
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
	const [editingStep, setEditingStep] = useState<SequenceStep | null>(null)
	const [editingIndex, setEditingIndex] = useState<number | null>(null)
	const [delayEditingIndex, setDelayEditingIndex] = useState<number | null>(null)
	const { formatTime } = useTimeFormat()

	const handleAddStep = (stepData: any) => {
		const newStep: SequenceStep = {
			id: `step-${Date.now()}`,
			type: stepData.nodeType || 'MESSAGE',
			templateId: stepData.templateId,
			templateName: stepData.templateName,
			label: stepData.label || `Step ${steps.length + 1}`,
			delayValue: stepData.delayValue || 0,
			delayUnit: stepData.delayUnit || 'MINUTES',
			scheduledTime: stepData.scheduledTime || null,
			burstTemplates: stepData.burstTemplates,
		}

		if (editingIndex !== null) {
			const newSteps = [...steps]
			newSteps[editingIndex] = { ...newStep, id: steps[editingIndex].id }
			onChange(newSteps)
		} else {
			const newSteps = [...steps, newStep]
			onChange(newSteps)
		}

		setEditingStep(null)
		setEditingIndex(null)
		setIsAddDialogOpen(false)
	}

	const handleDeleteStep = (index: number) => {
		const newSteps = steps.filter((_, i) => i !== index)
		onChange(newSteps)
	}

	const handleEditStep = (index: number) => {
		setEditingStep(steps[index])
		setEditingIndex(index)
		setIsAddDialogOpen(true)
	}

	const handleDragEnd = (result: DropResult) => {
		const { destination, source } = result
		if (!destination || destination.index === source.index) return
		const reordered = [...steps]
		const [moved] = reordered.splice(source.index, 1)
		reordered.splice(destination.index, 0, moved)
		onChange(reordered)
	}

	const formatDelay = (value: number, unit: string) => {
		if (value === 0) return '0 minutes'
		const unitLabel =
			value === 1 ? unit.toLowerCase().slice(0, -1) : unit.toLowerCase()
		return `${value} ${unitLabel}`
	}

	const formatDelayLabel = (step: SequenceStep) => {
		const base =
			step.delayValue > 0
				? `Wait ${formatDelay(step.delayValue, step.delayUnit)}`
				: 'Wait 0 minutes'
		const timeLabel =
			step.delayUnit === 'DAYS'
				? formatTime(step.scheduledTime || '09:00')
				: null
		if (timeLabel) {
			return `${base} @ ${timeLabel}`
		}
		return base
	}

	const handleDelaySave = (
		value: number,
		unit: 'MINUTES' | 'HOURS' | 'DAYS',
		scheduledTime: string | null
	) => {
		if (delayEditingIndex === null) return
		const updated = [...steps]
		updated[delayEditingIndex] = {
			...updated[delayEditingIndex],
			delayValue: value,
			delayUnit: unit,
			scheduledTime: unit === 'DAYS' ? scheduledTime : null,
		}
		onChange(updated)
		setDelayEditingIndex(null)
	}

	return (
		<div className={cn('space-y-6', className)}>
			<Card>
				<CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<CardTitle className="text-lg">Sequence Flow</CardTitle>
						<p className="text-sm text-muted-foreground">
							Drag steps to reorder them in the journey.
						</p>
					</div>
					<Button
						onClick={() => {
							setEditingStep(null)
							setEditingIndex(null)
							setIsAddDialogOpen(true)
						}}
						type="button"
						variant="outline"
						className="md:w-auto">
						<Plus className="mr-2 h-4 w-4" />
						Add Step
					</Button>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col items-center overflow-y-auto max-h-[calc(100vh-280px)] pr-2">
						<div className="px-6 py-2 bg-green-100 text-green-700 rounded-full font-medium border-2 border-green-300">
							Start
						</div>

						<DragDropContext onDragEnd={handleDragEnd}>
							<Droppable droppableId="steps">
								{(provided) => (
									<div
										ref={provided.innerRef}
										{...provided.droppableProps}
										className="w-full flex flex-col items-center">
										{steps.length === 0 ? (
											<div className="my-8 text-center text-muted-foreground">
												<p>No steps yet.</p>
												<p className="text-sm">Click "Add Step" to get started.</p>
											</div>
										) : (
											steps.map((step, index) => (
												<Draggable key={step.id} draggableId={step.id} index={index}>
													{(dragProvided, snapshot) => (
														<div
															ref={dragProvided.innerRef}
															{...dragProvided.draggableProps}
															className={cn(
																'w-full flex flex-col items-center',
																snapshot.isDragging && 'opacity-80'
															)}>
															<div className="flex flex-col items-center my-2">
																<div className="w-px h-4 bg-gray-300" />
																{(step.delayValue > 0 || index > 0) && (
																	<button
																		type="button"
																		onClick={() => setDelayEditingIndex(index)}
																		className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600 border hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
																		title="Edit delay">
																		<Clock className="h-3 w-3" />
																		{formatDelayLabel(step)}
																	</button>
																)}
																<div className="w-px h-4 bg-gray-300" />
																<div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-gray-300" />
															</div>

															<div className="w-full max-w-md border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
																<div className="flex items-center p-4 gap-3">
																	<div
																		className="p-1 rounded hover:bg-gray-100 cursor-grab active:cursor-grabbing"
																		{...dragProvided.dragHandleProps}>
																		<GripVertical className="h-4 w-4 text-gray-400" />
																	</div>

																	<div className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-lg font-bold text-sm">
																		{index + 1}
																	</div>

																	<div className="flex-1 min-w-0">
																		<div className="font-medium truncate">
																			{step.templateName || 'No template selected'}
																		</div>
																		<div
																			className={cn(
																				'text-sm truncate',
																				step.templateId ? 'text-gray-500' : 'text-orange-500'
																			)}>
																			{step.templateId ? 'MESSAGE' : 'No template selected'}
																		</div>
																		{step.burstTemplates && step.burstTemplates.length > 1 && (
																			<div className="mt-2 flex flex-wrap gap-2">
																				{step.burstTemplates.map((msg, msgIndex) => (
																					<div
																						key={`${step.id}-burst-${msgIndex}`}
																						className="rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
																						<span className="font-semibold mr-1">
																							{msgIndex + 1}
																						</span>
																						{msg.templateName || 'Message'}
																					</div>
																				))}
																			</div>
																		)}
																	</div>

																	<button
																		onClick={() => handleEditStep(index)}
																		className="p-2 rounded hover:bg-gray-100"
																		type="button"
																		title="Edit step">
																		<Edit className="h-4 w-4 text-gray-500" />
																	</button>
																	<button
																		onClick={() => handleDeleteStep(index)}
																		className="p-2 rounded hover:bg-red-50"
																		type="button"
																		title="Delete step">
																		<Trash2 className="h-4 w-4 text-red-500" />
																	</button>
																</div>
															</div>
														</div>
													)}
												</Draggable>
											))
										)}
										{provided.placeholder}
									</div>
								)}
							</Droppable>
						</DragDropContext>

						{steps.length > 0 && (
							<div className="flex flex-col items-center my-2">
								<div className="w-px h-6 bg-gray-300" />
							</div>
						)}

						<div className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full font-medium border-2 border-gray-300 mt-2">
							End
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Add/Edit Step Dialog */}
			<AddStepDialog
				open={isAddDialogOpen}
				onOpenChange={(open) => {
					setIsAddDialogOpen(open)
					if (!open) {
						setEditingStep(null)
						setEditingIndex(null)
					}
				}}
				onAddStep={handleAddStep}
				metaAccountId={metaAccountId}
				editingStep={editingStep}
			/>
			{delayEditingIndex !== null && steps[delayEditingIndex] && (
				<DelayEditDialog
					open={delayEditingIndex !== null}
					initialValue={steps[delayEditingIndex].delayValue}
					initialUnit={steps[delayEditingIndex].delayUnit}
					initialScheduledTime={steps[delayEditingIndex].scheduledTime || '09:00'}
					onClose={() => setDelayEditingIndex(null)}
					onSave={handleDelaySave}
				/>
			)}
		</div>
	)
}
