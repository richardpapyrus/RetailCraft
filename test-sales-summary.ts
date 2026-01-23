
const API_URL = 'http://localhost:4000';

const PRODUCT_ID = '023eaa12-423d-4835-9287-24b11f7ccd66'; // The product we used for GRN
const STORE_ID = '1daded16-d190-4bb2-87c0-29f353888995'; // The store used for GRN

async function main() {
    // 1. Login
    console.log("Logging in...");
    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'testadmin@retailcraft.com', password: 'password' })
    });

    if (!loginRes.ok) {
        console.error("Login failed");
        return;
    }

    const loginData: any = await loginRes.json();
    const token = loginData.access_token;
    console.log("Logged in.");

    // 1.5 Restock to ensure success
    console.log("Restocking...");
    await fetch(`${API_URL}/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ productId: PRODUCT_ID, quantity: 50, reason: 'Restock for Test', storeId: STORE_ID })
    });

    // 2. Create a Sales Transaction for today
    console.log("Creating a sale...");
    const salePayload = {
        storeId: STORE_ID,
        paymentMethod: 'CASH',
        items: [
            {
                productId: PRODUCT_ID,
                quantity: 1
            }
        ]
    };

    const saleRes = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(salePayload)
    });

    if (!saleRes.ok) {
        console.error("Sale creation failed", await saleRes.text());
        return;
    }
    console.log("Sale created.");

    // 3. Query Daily Summary (TODAY)
    console.log("Querying product summary for TODAY...");
    const today = new Date().toISOString().slice(0, 10);
    const summaryRes = await fetch(`${API_URL}/sales/daily-summary?storeId=${STORE_ID}&from=${today}&to=${today}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    if (!summaryRes.ok) {
        console.error("Daily Summary (Today) failed", await summaryRes.text());
        return;
    }

    const summary: any[] = await summaryRes.json();
    const productEntry = summary.find(s => s.productId === PRODUCT_ID);

    if (productEntry && productEntry.quantitySold >= 1) {
        console.log(`SUCCESS: Found sale in TODAY summary. Qty: ${productEntry.quantitySold}`);
    } else {
        console.error("FAILED: Did not find sale in TODAY summary.");
    }

    // 4. Query Daily Summary (YESTERDAY)
    console.log("Querying product summary for YESTERDAY (Should be empty)...");
    const yesterday = "2026-01-01"; // Far past
    const oldRes = await fetch(`${API_URL}/sales/daily-summary?storeId=${STORE_ID}&from=${yesterday}&to=${yesterday}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });
    const oldSummary: any[] = await oldRes.json();
    const oldEntry = oldSummary.find(s => s.productId === PRODUCT_ID);
    if (!oldEntry) {
        console.log("SUCCESS: Correctly found NO sales for past date.");
    } else {
        console.error(`FAILED: Found unexpected sales in past date: ${JSON.stringify(oldEntry)}`);
    }
}

main().catch(console.error);
