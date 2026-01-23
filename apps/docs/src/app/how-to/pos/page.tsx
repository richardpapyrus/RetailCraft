import { StepByStep, Step } from '@/components/StepByStep';

export default function PosPage() {
    const steps: Step[] = [
        {
            title: '1. Accessing the POS',
            content: (
                <div>
                    <p className="mb-2">To start selling, you must first enter the POS module:</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Click on <strong>Point of Sale (POS)</strong> in the designated sidebar menu.</li>
                        <li>Select your <strong>Location</strong> if prompted (e.g., Main Store).</li>
                    </ol>
                    <p className="mt-2">The main grid will load, displaying your product catalog.</p>
                </div>
            ),
            image: '/images/pos-main.png',
            imageAlt: 'POS Main Interface',
        },
        {
            title: '2. Adding Items to Cart',
            content: (
                <div>
                    <p className="mb-2">There are three ways to add items to the current sale:</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Tap to Add:</strong> Simply click on any product card in the grid.</li>
                        <li><strong>Search:</strong> Use the search bar at the top to find items by name or SKU.</li>
                        <li><strong>Scan:</strong> Use a connected barcode scanner to scan items directly.</li>
                    </ul>
                    <p className="mt-2">
                        To adjust quantities, tap the item in the cart list on the right. You can increment, decrement, or remove lines entirely.
                    </p>
                </div>
            ),
            image: '/images/pos-cart.png',
            imageAlt: 'Adding items to cart',
        },
        {
            title: '3. Assigning a Customer',
            content: (
                <div>
                    <p className="mb-2">Assigning a customer allows you to track purchase history and loyalty points.</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Click on the <strong>Customers</strong> tab/icon in the POS header.</li>
                        <li>Search for an existing customer by name or phone number.</li>
                        <li>Click <strong>Select</strong> or <strong>Add to Sale</strong> next to their name.</li>
                        <li>If they are new, click <strong>Create Customer</strong> to add them instantly.</li>
                    </ol>
                </div>
            ),
            image: '/images/pos-customer.png',
            imageAlt: 'Customer Selection Screen',
        },
        {
            title: '4. Applying Discounts',
            content: (
                <div>
                    <p className="mb-2">You can apply discounts to the entire cart or specific items.</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Locate the <strong>Discount</strong> section in the cart summary.</li>
                        <li>Click the <strong>Add/Edit</strong> button.</li>
                        <li>Select a preset discount (e.g., "10% Off") or enter a manual amount.</li>
                        <li>Click <strong>Apply</strong> to update the total.</li>
                    </ol>
                </div>
            ),
            image: '/images/pos-discount.png',
            imageAlt: 'Discount Modal',
        },
        {
            title: '5. Processing Payment',
            content: (
                <div>
                    <p className="mb-2">When the customer is ready to pay:</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Click the large <strong>Pay</strong> button at the bottom of the cart.</li>
                        <li>Select the <strong>Payment Method</strong> (Cash, Card, etc.).</li>
                        <li>Enter the <strong>Tendered Amount</strong> (if Cash).</li>
                        <li>The system will calculate any change due.</li>
                        <li>Click <strong>Confirm Payment</strong> to finalize.</li>
                    </ol>
                </div>
            ),
            image: '/images/pos-payment.png',
            imageAlt: 'Payment Screen',
        },
        {
            title: '6. Receipt & Completion',
            content: (
                <div>
                    <p className="mb-2">After successful payment:</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>A success screen will appear.</li>
                        <li>You can choose to <strong>Print Receipt</strong> or <strong>Email Receipt</strong>.</li>
                        <li>Click <strong>New Sale</strong> to clear the cart and start the next transaction.</li>
                    </ul>
                </div>
            ),
            image: '/images/pos-receipt.png',
            imageAlt: 'Order Receipt',
        },
    ];

    return (
        <StepByStep
            title="Point of Sale (POS) Guide"
            description="The complete instruction manual for using the POS interface to process sales, manage customers, and handle payments."
            steps={steps}
        />
    );
}
