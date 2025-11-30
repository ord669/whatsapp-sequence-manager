import { SequenceWizard } from '@/components/sequences/SequenceWizard'

interface EditSequencePageProps {
	params: { id: string }
}

export default function EditSequencePage({ params }: EditSequencePageProps) {
	return <SequenceWizard initialSequenceId={params.id} />
}
