import { StepByStep, Step } from '@/components/StepByStep';

export default function SettingsPage() {
    const steps: Step[] = [
        {
            title: '1. General Configuration',
            content: (
                <div>
                    <p className="mb-2">The <strong>General</strong> tab allows you to configure core store details.</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Store Name:</strong> This appears on receipts and the dashboard.</li>
                        <li><strong>Contact Info:</strong> Phone and email used for customer communications.</li>
                        <li><strong>Currency & Locale:</strong> Set your regional formats.</li>
                    </ul>
                </div>
            ),
            image: '/images/settings-general.png',
            imageAlt: 'General Settings',
        },
        {
            title: '2. Team Management',
            content: (
                <div>
                    <p className="mb-2">Control who has access to your system under the <strong>Team</strong> tab.</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Add User:</strong> Create accounts for new staff members.</li>
                        <li><strong>Roles:</strong> Assign permissions (e.g., Administrator, Manager, Cashier) to restrict access to sensitive features like Refunds or Settings.</li>
                    </ul>
                </div>
            ),
            image: '/images/settings-users.png',
            imageAlt: 'Team Settings',
        },
        {
            title: '3. Taxes & Financials',
            content: (
                <div>
                    <p className="mb-2">Manage your tax compliance in the <strong>Taxes</strong> section.</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Tax Rates:</strong> Define standard VAT/Sales Tax rates (e.g., 20%).</li>
                        <li><strong>Tax Rules:</strong> Apply specific rules to different product categories if needed.</li>
                    </ul>
                </div>
            ),
            image: '/images/settings-taxes.png',
            imageAlt: 'Tax Settings',
        },
    ];

    return (
        <StepByStep
            title="System Settings"
            description="Configure your store details, manage staff permissions, and set up tax rules."
            steps={steps}
        />
    );
}
