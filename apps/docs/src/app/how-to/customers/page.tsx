import { StepByStep, Step } from '@/components/StepByStep';

export default function CustomersPage() {
    const steps: Step[] = [
        {
            title: '1. Managing Your Customer Base',
            content: (
                <div>
                    <p className="mb-2">The <strong>Customers</strong> module helps you build relationships and track loyalty.</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Search:</strong> Quickly find customers by Name, Email, or Phone Number.</li>
                        <li><strong>View History:</strong> Click on any customer row to see their past purchases and total spend.</li>
                        <li><strong>Export:</strong> Use the export tools to download customer data for email marketing.</li>
                    </ul>
                </div>
            ),
            image: '/images/customers-list.png',
            imageAlt: 'Customer List View',
        },
        {
            title: '2. Adding a New Customer',
            content: (
                <div>
                    <p className="mb-2">To register a new client profile:</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Click the <strong>Add Customer</strong> button.</li>
                        <li><strong>Personal Details:</strong> Enter First Name, Last Name, and Email (required for receipts).</li>
                        <li><strong>Contact:</strong> Add a Phone Number for SMS notifications (if enabled).</li>
                        <li><strong>Notes:</strong> Add any internal notes about preferences or VIP status.</li>
                        <li>Click <strong>Save</strong> to create the profile.</li>
                    </ol>
                </div>
            ),
            image: '/images/customers-create.png',
            imageAlt: 'Create Customer Form',
        },
        {
            title: '3. Customer Loyalty (POS)',
            content: (
                <div>
                    <p className="mb-2">
                        Don&apos;t forget to assign customers to sales at the POS!
                        This ensures their purchase history is accurate and allows them to accrue loyalty points (if configured).
                    </p>
                    <p>
                        Refer to the <a href="/how-to/pos" className="text-blue-600 hover:underline">Point of Sale guide</a> for details on attaching customers to active transactions.
                    </p>
                </div>
            ),
            image: '/images/pos-customer.png',
            imageAlt: 'Assigning Customer at POS',
        },
    ];

    return (
        <StepByStep
            title="Customer Management"
            description="Learn how to build your customer database, track purchase history, and manage client details."
            steps={steps}
        />
    );
}
