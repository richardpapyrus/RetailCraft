import { StepByStep, Step } from '@/components/StepByStep';

export default function NavigationPage() {
    const steps: Step[] = [
        {
            title: 'Global Sidebar',
            content: (
                <p>
                    The <strong>Sidebar</strong> is your main navigation hub. It remains visible on the left side of the screen
                    and provides quick access to all major modules of RetailCraft, including Dashboard, POS, Products, Customers, and Settings.
                    You can collapse it for more screen space on smaller devices.
                </p>
            ),
            image: '/images/nav-sidebar.png',
            imageAlt: 'Global Sidebar Navigation',
        },
        {
            title: 'Header & Search',
            content: (
                <p>
                    The <strong>Header</strong> contains the global search bar, which allows you to quickly find products, customers, or orders.
                    On the right, you'll find your user profile menu and notifications.
                </p>
            ),
            image: '/images/nav-header.png',
            imageAlt: 'Header and Search Bar',
        },
        {
            title: 'Point of Sale (POS)',
            content: (
                <p>
                    The <strong>POS</strong> module is where sales happen.
                    To access it, you must first select a <strong>Location</strong> (e.g., Headquarters).
                    From here, you can add items to the cart, manage customers, and process payments.
                </p>
            ),
            image: '/images/nav-pos.png',
            imageAlt: 'Point of Sale Interface',
        },
        {
            title: 'Inventory & Products',
            content: (
                <p>
                    Manage your catalog in the <strong>Products</strong> section.
                    Here you can view stock levels, add new items, update prices, and organize products into categories.
                </p>
            ),
            image: '/images/nav-inventory.png',
            imageAlt: 'Product Inventory List',
        },
        {
            title: 'Customer Directory',
            content: (
                <p>
                    The <strong>Customers</strong> section maintains your client database.
                    You can view purchase history, manage loyalty points, and update contact information for your shoppers.
                </p>
            ),
            image: '/images/nav-customers.png',
            imageAlt: 'Customer Directory',
        },
        {
            title: 'Orders & Sales History',
            content: (
                <p>
                    View all past transactions in the <strong>Sales History</strong> (often labeled as Orders).
                    You can filter by date, status, or search for specific receipt numbers to process returns or reprints.
                </p>
            ),
            image: '/images/nav-orders.png',
            imageAlt: 'Sales History and Orders',
        },
    ];

    return (
        <StepByStep
            title=" navigating RetailCraft"
            description="Familiarize yourself with the main interface elements and modules of the RetailCraft application."
            steps={steps}
        />
    );
}
