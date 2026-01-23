import { StepByStep, Step } from '@/components/StepByStep';

export default function ProductsPage() {
    const steps: Step[] = [
        {
            title: '1. Managing the Product List',
            content: (
                <div>
                    <p className="mb-2">The <strong>Products</strong> page is your inventory hub. Here you can:</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Search:</strong> Use the search bar for Name or SKU.</li>
                        <li><strong>Filter:</strong> Filter by Category or Stock Status.</li>
                        <li><strong>Edit:</strong> Click on any row to edit product details.</li>
                        <li><strong>Delete:</strong> Select products using checkboxes to perform bulk deletions.</li>
                    </ul>
                </div>
            ),
            image: '/images/inventory-list.png',
            imageAlt: 'Product List View',
        },
        {
            title: '2. Creating a New Product',
            content: (
                <div>
                    <p className="mb-2">To add a single item manually:</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Click the <strong>Add Product</strong> button in the top right.</li>
                        <li><strong>Basic Info:</strong> Enter Name, SKU (optional, auto-generated if blank), and Barcode.</li>
                        <li><strong>Pricing:</strong> Set the Supply Price (Cost) and Retail Price.</li>
                        <li><strong>Inventory:</strong> Enable "Track Stock" to manage quantity. Enter current stock levels per location.</li>
                        <li><strong>Tax:</strong> Select the applicable tax rate.</li>
                        <li>Click <strong>Save Product</strong>.</li>
                    </ol>
                </div>
            ),
            image: '/images/inventory-create.png',
            imageAlt: 'Create Product Modal',
        },
        {
            title: '3. Managing Categories',
            content: (
                <div>
                    <p className="mb-2">Organize your products for easier POS navigation:</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Click <strong>Manage Categories</strong> on the Products page.</li>
                        <li><strong>Add:</strong> Enter a category name (e.g., "Beverages", "Snacks") and click Add.</li>
                        <li><strong>Edit/Delete:</strong> Use the action buttons next to existing categories.</li>
                        <li><strong>Assign:</strong> When creating/editing a product, select its category from the dropdown.</li>
                    </ol>
                </div>
            ),
            image: '/images/products-categories.png',
            imageAlt: 'Category Management',
        },
        {
            title: '4. Bulk Import Products',
            content: (
                <div>
                    <p className="mb-2">For large inventories, use the CSV import tool:</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Click <strong>Import Products</strong>.</li>
                        <li><strong>Download Template:</strong> Get the CSV sample file to ensure correct formatting.</li>
                        <li><strong>Prepare File:</strong> Fill in your product data. Mandatory fields include Name and Retail Price.</li>
                        <li><strong>Upload:</strong> Drag and drop your CSV file.</li>
                        <li><strong>Map Fields:</strong> Confirm the columns match the system fields.</li>
                        <li><strong>Review & Import:</strong> Check for errors and finalize the import.</li>
                    </ol>
                </div>
            ),
            image: '/images/inventory-import.png',
            imageAlt: 'Import Interface',
        },
    ];

    return (
        <StepByStep
            title="Products & Inventory"
            description="A complete guide to managing your stock, creating products, organizing categories, and performing bulk imports."
            steps={steps}
        />
    );
}
