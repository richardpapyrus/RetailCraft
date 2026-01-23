import { StepByStep, Step } from '@/components/StepByStep';

export default function SuppliersPage() {
    const steps: Step[] = [
        {
            title: '1. Managing Supplier Relationships',
            content: (
                <div>
                    <p className="mb-2">The <strong>Suppliers</strong> module acts as a directory for all your product sources.</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Centralized Database:</strong> Keep all supplier contact info in one place.</li>
                        <li><strong>Search:</strong> Easily find suppliers to update their details or initiate orders.</li>
                        <li><strong>Edit/Delete:</strong> Maintain an up-to-date list by removing inactive suppliers.</li>
                    </ul>
                </div>
            ),
            image: '/images/suppliers-list.png',
            imageAlt: 'Suppliers List View',
        },
        {
            title: '2. Adding a New Supplier',
            content: (
                <div>
                    <p className="mb-2">To onboard a new vendor:</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Click <strong>Add Supplier</strong> in the top right.</li>
                        <li><strong>Supplier Name:</strong> Enter the official business name.</li>
                        <li><strong>Contact Person:</strong> (Optional) Name of your representative.</li>
                        <li><strong>Contact Details:</strong> Phone, Email, and Address for purchase orders.</li>
                        <li>Click <strong>Save</strong> to add them to the system.</li>
                    </ol>
                </div>
            ),
            image: '/images/suppliers-create.png',
            imageAlt: 'Create Supplier Form',
        },
        {
            title: '3. Linking to Products',
            content: (
                <div>
                    <p className="mb-2">
                        Once created, you can associate suppliers with specific products during the product creation or editing process.
                        This helps in generating accurate restock reports and purchase orders.
                    </p>
                </div>
            ),
            image: '/images/inventory-create.png',
            imageAlt: 'Product Supplier Link',
        },
    ];

    return (
        <StepByStep
            title="Supplier Management"
            description="Manage your vendor database, contact details, and product sourcing connections."
            steps={steps}
        />
    );
}
