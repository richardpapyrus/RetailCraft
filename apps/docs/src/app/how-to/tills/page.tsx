import { StepByStep, Step } from '@/components/StepByStep';

export default function TillsPage() {
    const steps: Step[] = [
        {
            title: '1. Till Management',
            content: (
                <div>
                    <p className="mb-2"><strong>Tills</strong> represent the physical register sessions.</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Active Status:</strong> See which tills are currently open and who opened them.</li>
                        <li><strong>Closing a Till:</strong> End of day procedures involve counting cash and reconciling the expected amount vs. actual.</li>
                        <li><strong>Discrepancies:</strong> The system automatically highlights any variance in cash totals.</li>
                    </ul>
                </div>
            ),
            image: '/images/tills-list.png',
            imageAlt: 'Till Management List',
        },
        {
            title: '2. Opening a New Session',
            content: (
                <div>
                    <p className="mb-2">
                        Before making sales, a till must be opened. You will be prompted to enter a <strong>Float Amount</strong> (starting cash).
                        This ensures accurate cash tracking throughout the shift.
                    </p>
                </div>
            ),
        },
    ];

    return (
        <StepByStep
            title="Till Management"
            description="Control your cash drawers, manage daily sessions, and produce end-of-day reports."
            steps={steps}
        />
    );
}
