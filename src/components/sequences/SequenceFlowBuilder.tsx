'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import ReactFlow, {
	Node,
	Edge,
	Controls,
	Background,
	useNodesState,
	useEdgesState,
	addEdge,
	Connection,
	MiniMap,
	ReactFlowProvider,
	useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Button } from '@/components/ui/button'
import { Plus, Undo2, Redo2 } from 'lucide-react'
import { AddStepDialog } from './AddStepDialog'

// History state type for undo/redo
interface HistoryState {
	nodes: Node[]
	edges: Edge[]
}

// Maximum history entries to keep
const MAX_HISTORY = 50

interface SequenceFlowBuilderProps {
	metaAccountId: string
	onChange: (data: any) => void
	initialNodes?: Node[]
	initialEdges?: Edge[]
	isVisible?: boolean
}

function SequenceFlowBuilderInner({
	metaAccountId,
	onChange,
	initialNodes,
	initialEdges,
	isVisible = true,
}: SequenceFlowBuilderProps) {
	const { fitView } = useReactFlow()
	
	// Initialize with proper default nodes
	const defaultNodes: Node[] = [
		{
			id: 'start-node',
			type: 'input',
			data: { label: '🟢 START' },
			position: { x: 250, y: 0 },
			style: {
				background: '#22c55e',
				color: 'white',
				border: '2px solid #16a34a',
				borderRadius: '8px',
				padding: '10px',
				fontWeight: 'bold',
			},
		},
		{
			id: 'end-node',
			type: 'output',
			data: { label: '🔴 END' },
			position: { x: 250, y: 600 },
			style: {
				background: '#ef4444',
				color: 'white',
				border: '2px solid #dc2626',
				borderRadius: '8px',
				padding: '10px',
				fontWeight: 'bold',
			},
		},
	]
	
	// Use initialNodes if provided and has real content, otherwise use defaults
	const startingNodes = (initialNodes && initialNodes.length > 2) ? initialNodes : defaultNodes
	
	const [nodes, setNodes, onNodesChange] = useNodesState(startingNodes)
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || [])
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
	const [selectedPosition, setSelectedPosition] = useState({ x: 250, y: 150 })

	// Undo/Redo history management
	const historyRef = useRef<HistoryState[]>([])
	const historyIndexRef = useRef(-1)
	const isUndoRedoRef = useRef(false)
	const [canUndo, setCanUndo] = useState(false)
	const [canRedo, setCanRedo] = useState(false)

	// Save current state to history
	const saveToHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
		if (isUndoRedoRef.current) {
			isUndoRedoRef.current = false
			return
		}

		const newState: HistoryState = {
			nodes: JSON.parse(JSON.stringify(newNodes)),
			edges: JSON.parse(JSON.stringify(newEdges)),
		}

		// Remove any future states if we're not at the end
		if (historyIndexRef.current < historyRef.current.length - 1) {
			historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
		}

		// Add new state
		historyRef.current.push(newState)
		historyIndexRef.current = historyRef.current.length - 1

		// Limit history size
		if (historyRef.current.length > MAX_HISTORY) {
			historyRef.current.shift()
			historyIndexRef.current--
		}

		setCanUndo(historyIndexRef.current > 0)
		setCanRedo(false)
	}, [])

	// Undo function
	const undo = useCallback(() => {
		if (historyIndexRef.current <= 0) return

		isUndoRedoRef.current = true
		historyIndexRef.current--
		const prevState = historyRef.current[historyIndexRef.current]

		setNodes(JSON.parse(JSON.stringify(prevState.nodes)))
		setEdges(JSON.parse(JSON.stringify(prevState.edges)))

		setCanUndo(historyIndexRef.current > 0)
		setCanRedo(true)
	}, [setNodes, setEdges])

	// Redo function
	const redo = useCallback(() => {
		if (historyIndexRef.current >= historyRef.current.length - 1) return

		isUndoRedoRef.current = true
		historyIndexRef.current++
		const nextState = historyRef.current[historyIndexRef.current]

		setNodes(JSON.parse(JSON.stringify(nextState.nodes)))
		setEdges(JSON.parse(JSON.stringify(nextState.edges)))

		setCanUndo(true)
		setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
	}, [setNodes, setEdges])

	// Initialize history with starting state
	useEffect(() => {
		if (historyRef.current.length === 0) {
			historyRef.current.push({
				nodes: JSON.parse(JSON.stringify(nodes)),
				edges: JSON.parse(JSON.stringify(edges)),
			})
			historyIndexRef.current = 0
		}
	}, []) // Only run once on mount

	// Keyboard shortcuts for undo/redo
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
			const isMod = e.ctrlKey || e.metaKey

			if (isMod && e.key === 'z') {
				e.preventDefault()
				if (e.shiftKey) {
					// Ctrl+Shift+Z = Redo
					redo()
				} else {
					// Ctrl+Z = Undo
					undo()
				}
			}

			// Also support Ctrl+Y for redo (Windows convention)
			if (isMod && e.key === 'y') {
				e.preventDefault()
				redo()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [undo, redo])

	const onConnect = useCallback(
		(params: Connection) => setEdges((eds) => addEdge(params, eds)),
		[setEdges]
	)

	// Update parent component whenever flow changes and save to history
	useEffect(() => {
		const steps = nodes
			.filter((node) => node.type !== 'input' && node.type !== 'output')
			.map((node, index) => ({
				nodeId: node.id,
				nodeType: node.data.nodeType || 'MESSAGE',
				stepOrder: index,
				subOrder: 0,
				templateId: node.data.templateId,
				delayValue: node.data.delayValue || 0,
				delayUnit: node.data.delayUnit || 'DAYS',
				scheduledTime: node.data.scheduledTime || null,
				variableValues: node.data.variableValues || {},
				positionX: node.position.x,
				positionY: node.position.y,
			}))

		onChange({
			nodes,
			edges,
		})

		// Save to history (debounced to avoid saving during rapid changes)
		saveToHistory(nodes, edges)
	}, [nodes, edges, onChange, saveToHistory])

	// Update nodes when initialNodes changes (e.g., when loading from database)
	// This is CRITICAL for loading existing sequences
	useEffect(() => {
		if (initialNodes && initialNodes.length > 2) {
			// Only update if we have more than just START and END nodes
			setNodes(initialNodes)
		}
	}, [initialNodes, setNodes])

	// Update edges when initialEdges changes
	useEffect(() => {
		if (initialEdges && initialEdges.length > 0) {
			setEdges(initialEdges)
		}
	}, [initialEdges, setEdges])

	// Call fitView when the component becomes visible
	useEffect(() => {
		if (isVisible) {
			// Small delay to ensure DOM is ready
			const timer = setTimeout(() => {
				fitView({ padding: 0.2, duration: 200 })
			}, 50)
			return () => clearTimeout(timer)
		}
	}, [isVisible, fitView])

	const handleAddStep = (stepData: any) => {
		const newNode: Node = {
			id: `step-${Date.now()}`,
			type: 'default',
			data: {
				label: stepData.label,
				...stepData,
			},
			position: selectedPosition,
			style: {
				background: stepData.nodeType === 'MESSAGE' ? '#3b82f6' : '#eab308',
				color: 'white',
				border: '2px solid #1d4ed8',
				borderRadius: '8px',
				padding: '10px',
				minWidth: '200px',
			},
		}

		setNodes((nds) => [...nds, newNode])
		setIsAddDialogOpen(false)
	}

	const handleDeleteNode = (nodeId: string) => {
		if (nodeId === 'start-node' || nodeId === 'end-node') return
		setNodes((nds) => nds.filter((node) => node.id !== nodeId))
		setEdges((eds) =>
			eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
		)
	}

	return (
		<div className="h-full w-full flex flex-col">
			<div className="p-4 bg-muted/50 border-b">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<p className="text-sm text-muted-foreground">
							Click <strong>Add Step</strong> to add messages or delays. Connect nodes
							by dragging from one to another.
						</p>
						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">⌘Z</kbd>
							<span>Undo</span>
							<span className="mx-1">•</span>
							<kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">⌘⇧Z</kbd>
							<span>Redo</span>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button
							onClick={undo}
							size="sm"
							variant="outline"
							disabled={!canUndo}
							title="Undo (Ctrl+Z)"
						>
							<Undo2 className="h-4 w-4" />
						</Button>
						<Button
							onClick={redo}
							size="sm"
							variant="outline"
							disabled={!canRedo}
							title="Redo (Ctrl+Shift+Z)"
						>
							<Redo2 className="h-4 w-4" />
						</Button>
						<Button onClick={() => setIsAddDialogOpen(true)} size="sm">
							<Plus className="mr-2 h-4 w-4" />
							Add Step
						</Button>
					</div>
				</div>
			</div>

			<div className="flex-1 relative">
				<div className="absolute inset-0">
					<ReactFlow
						nodes={nodes}
						edges={edges}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						onConnect={onConnect}
						onNodeDoubleClick={(_, node) => {
							if (node.id !== 'start-node' && node.id !== 'end-node') {
								if (confirm('Delete this node?')) {
									handleDeleteNode(node.id)
								}
							}
						}}
						style={{ width: '100%', height: '100%' }}
						fitView>
						<Controls />
						<MiniMap />
						<Background gap={12} size={1} />
					</ReactFlow>
				</div>
			</div>

			<AddStepDialog
				open={isAddDialogOpen}
				onOpenChange={setIsAddDialogOpen}
				metaAccountId={metaAccountId}
				onAdd={handleAddStep}
			/>
		</div>
	)
}

export function SequenceFlowBuilder(props: SequenceFlowBuilderProps) {
	return (
		<ReactFlowProvider>
			<SequenceFlowBuilderInner {...props} />
		</ReactFlowProvider>
	)
}
