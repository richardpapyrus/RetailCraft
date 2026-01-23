import { StepByStep, Step } from '@/components/StepByStep';

export default function BusinessSetupPage() {
    const steps: Step[] = [
        {
            title: 'Initial Login',
            content: (
                <p>
                    Access your RetailCraft instance at <code>http://localhost:3000</code>.
                    Use the demo credentials provided to you. For the local demo environment,
                    the username is <strong>admin.pos.local</strong> and the password is <strong>password</strong>.
                </p>
            ),
            image: '/images/login.png',
            imageAlt: 'Login Screen',
        },
        {
            title: 'Dashboard Overview',
            content: (
                <p>
                    Once logged in, you will be greeted by the main Dashboard.
                    This provides a snapshot of your business performance.
                    To start the setup, we will navigate to the <strong>Settings</strong> menu.
                </p>
            ),
            image: '/images/dashboard.png',
            imageAlt: 'Dashboard Overview',
        },
        {
            title: 'Business Profile Settings',
            content: (
                <p>
                    Navigate to <strong>Settings</strong> &gt; <strong>General</strong>.
                    Here you should double-check your Business Name and Store details.
                    These details will appear on your customer receipts.
                </p>
            ),
            image: '/images/settings-general.png',
            imageAlt: 'General Settings',
            alert: {
                type: 'info',
                message: 'Ensure your address is correct as it is required for tax compliance in some jurisdictions.',
            }
        },
        {
            title: 'Tax Configuration',
            content: (
                <p>
                    Go to the <strong>Taxes & Discounts</strong> tab (or <strong>Taxes</strong> section).
                    Set up your local sales tax rate here. This will be automatically applied to applicable products during checkout.
                </p>
            ),
            image: '/images/settings-taxes.png',
            imageAlt: 'Tax Configuration',
            alert: {
                type: 'warning',
                message: 'Changes to tax rates apply immediately to new orders.',
            }
        },
        {
            title: 'Terminal Management',
            content: (
                <p>
                    Finally, ensure your registers are set up correctly under <strong>Tills</strong> or <strong>Terminals</strong>.
                    Each physical register needs its own entry here to track cash drawers separately.
                </p>
            ),
            image: '/images/settings-terminals.png',
            imageAlt: 'Terminal Settings',
        },
    ];

    return (
        <StepByStep
            title="Setting Up Your Business"
            description="A complete guide to configuring your RetailCraft business profile, taxes, and terminals for the first time."
            steps={steps}
        />
    );
}
