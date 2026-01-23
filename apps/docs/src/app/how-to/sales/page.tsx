import { StepByStep, Step } from '@/components/StepByStep';

export default function SalesHistoryPage() {
    const steps: Step[] = [
        {
            title: '1. Reviewing Sales Data',
            content: (
                <div>
                    <p className="mb-2">The <strong>Sales History</strong> provides a comprehensive log of all transactions.</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Filter:</strong> Sort by date range, till, or specific sales staff.</li>
                        <li><strong>Search:</strong> Find specific receipts by ID or customer name.</li>
                        <li><strong>Status:</strong> Quickly see if orders are Complete, Refunded, or Voided.</li>
                    </ul>
                </div>
            ),
            image: '/images/sales-list.png',
            imageAlt: 'Sales History List',
        },
        {
            title: '2. Transaction Details & Refunds',
            content: (
                <div>
                    <p className="mb-2">Click on any sale row to view the full receipt details.</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Items Sold:</strong> View the exact products and variants in the basket.</li>
                        <li><strong>Payment Method:</strong> See how the customer paid (Cash, Card, etc.).</li>
                        <li><strong>Refunds:</strong> Use the <strong>Refund</strong> button to reverse items or the entire transaction.</li>
                        <li><strong>Reprint:</strong> Print a duplicate receipt if needed.</li>
                    </ul>
                </div>
            ),
            // No image for details yet as system is empty
        },
    ];

    return (
        <StepByStep
            title="Sales History & Refunds"
            description="Track your daily timeline, review past transactions, and process refunds."
            steps={steps}
        />
    );
}
