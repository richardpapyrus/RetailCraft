import { StepByStep, Step } from '@/components/StepByStep';

export default function DashboardPage() {
    const steps: Step[] = [
        {
            title: 'Dashboard Overview',
            content: (
                <div>
                    <p className="mb-4">
                        The <strong>Dashboard</strong> is your command center. It provides an immediate, real-time snapshot of your business performance.
                        Upon logging in, you are greeted with this view.
                    </p>
                    <ul className="list-disc pl-5 space-y-2 mb-4">
                        <li><strong>Total Revenue:</strong> The total value of sales within the selected period.</li>
                        <li><strong>Total Profit:</strong> Revenue minus the cost of goods sold.</li>
                        <li><strong>Transactions:</strong> The number of individual sales completed.</li>
                    </ul>
                    <p>
                        Use this high-level view to quickly assess daily health before diving into specifics.
                    </p>
                </div>
            ),
            image: '/images/dashboard-overview.png',
            imageAlt: 'Dashboard Overview',
        },
        {
            title: 'Filtering by Date',
            content: (
                <div>
                    <p className="mb-4">
                        To analyze data for a specific period, use the date filters at the top left of the page.
                    </p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Click on the <strong>From</strong> date picker.</li>
                        <li>Select your starting date from the calendar.</li>
                        <li>Click on the <strong>To</strong> date picker.</li>
                        <li>Select your ending date.</li>
                    </ol>
                    <p className="mt-4">
                        All charts and metrics on the page will automatically refresh to reflect transactions within this new range.
                    </p>
                </div>
            ),
            image: '/images/dashboard-filters.png',
            imageAlt: 'Date Filters',
        },
        {
            title: 'Analyzing Sales Trends',
            content: (
                <p>
                    The <strong>Month to Date Trend</strong> chart visualizes your daily sales performance.
                    Hover over any specific day on the line graph to see the exact revenue figure for that day.
                    This helps identify peak trading days and weekly patterns.
                </p>
            ),
            image: '/images/dashboard-sales-chart.png',
            imageAlt: 'Sales Trend Chart',
        },
        {
            title: 'Monitoring Top Products',
            content: (
                <p>
                    The <strong>Best Sellers</strong> widget lists your top-performing products by revenue.
                    Review this list daily to identify which items are driving your growth and ensure they remain in stock.
                    The list updates dynamically based on the date range selected.
                </p>
            ),
            image: '/images/dashboard-top-products.png',
            imageAlt: 'Top Products Widget',
        },
    ];

    return (
        <StepByStep
            title="Using the Dashboard"
            description="A comprehensive guide to monitoring your business metrics, analyzing trends, and using date filters effectively."
            steps={steps}
        />
    );
}
