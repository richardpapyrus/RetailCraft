import { StepByStep, Step } from '@/components/StepByStep';

export default function InstallationPage() {
    const steps: Step[] = [
        {
            title: 'System Requirements',
            content: (
                <ul>
                    <li>Operating System: Windows 10/11, macOS 12+, or iPadOS 15+</li>
                    <li>RAM: Minimum 4GB (8GB recommended)</li>
                    <li>Internet: Stable broadband connection recommended</li>
                </ul>
            ),
            alert: {
                type: 'info',
                message: 'Chrome or Edge browsers offer the best printing support for thermal receipts.',
            }
        },
        {
            title: 'Log in to your Account',
            content: (
                <p>
                    Navigate to <code>app.retailcraft.com</code> and enter your credentials.
                    If this is your first time, check your email for the invitation link sent by your administrator.
                </p>
            ),
            image: '/images/login.png',
            imageAlt: 'Login Screen',
        },
    ];

    return (
        <StepByStep
            title="Installation & Setup"
            description="Get up and running with RetailCraft in minutes. No complex software to install."
            steps={steps}
        />
    );
}
