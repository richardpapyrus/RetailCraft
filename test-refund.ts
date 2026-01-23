
const API_URL = 'http://localhost:4000';

const PRODUCT_ID = '023eaa12-423d-4835-9287-24b11f7ccd66';
const STORE_ID = '1daded16-d190-4bb2-87c0-29f353888995';

async function main() {
    console.log("Logging in...");
    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'testadmin@retailcraft.com', password: 'password' })
    });
    if (!loginRes.ok) throw new Error("Login failed");
    const loginData: any = await loginRes.json();
    const token = loginData.access_token;
    const userId = loginData.user.id;
    console.log(`Logged in as User ${userId}`);

    // 1. Open Till Session
    console.log("Checking for active session...");
    const activeSessionRes = await fetch(`${API_URL}/tills/session/active?storeId=${STORE_ID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (activeSessionRes.ok) {
        const text = await activeSessionRes.text();
        if (text) {
            const session = JSON.parse(text);
            if (session && session.id) {
                console.log(`Found active session ${session.id}, closing it first.`);
                await fetch(`${API_URL}/tills/session/${session.id}/close`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ closingCash: 0 })
                });
            }
        }
    }

    // Get a Till ID
    const tillsRes = await fetch(`${API_URL}/tills?storeId=${STORE_ID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const tills: any[] = await tillsRes.json();
    if (!tills.length) throw new Error("No tills found");
    const tillId = tills[0].id;

    console.log(`Opening new session for Till ${tillId}...`);
    const openRes = await fetch(`${API_URL}/tills/session/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tillId, openingFloat: 100 })
    });
    if (!openRes.ok) {
        // If open failed, maybe race condition, try active again
        console.warn("Open failed, checking active again...");
        const retryActive = await fetch(`${API_URL}/tills/session/active?storeId=${STORE_ID}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const activeText = await retryActive.text();
        if (!activeText) throw new Error("Could not open session and none active");
        const session = JSON.parse(activeText);
        return runTest(session.id, token);
    }
    const session = await openRes.json();
    await runTest(session.id, token);
}

async function runTest(sessionId: string, token: string) {
    console.log(`Session Active: ${sessionId}. Opening Float: $100`);

    // 1.5 Restock
    await fetch(`${API_URL}/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ productId: PRODUCT_ID, quantity: 50, reason: 'Restock', storeId: STORE_ID })
    });

    // 2. Make Cash Sale
    console.log("Processing Cash Sale (Qty: 1)...");
    const saleRes = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            storeId: STORE_ID,
            items: [{ productId: PRODUCT_ID, quantity: 1 }],
            paymentMethod: 'CASH',
            payments: [{ method: 'CASH', amount: 120 }]
        })
    });

    if (!saleRes.ok) throw new Error(`Sale failed: ${await saleRes.text()}`);
    const sale = await saleRes.json();
    console.log(`Sale Created: ${sale.id}. Total: ${sale.total}`);

    // 3. Process Return
    console.log("Processing Return...");
    const returnRes = await fetch(`${API_URL}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            saleId: sale.id,
            items: [{ productId: PRODUCT_ID, quantity: 1, restock: true }]
        })
    });
    if (!returnRes.ok) throw new Error(`Return failed: ${await returnRes.text()}`);
    console.log("Return Processed.");

    // 4. Verify Till Report
    console.log("Verifying Till Report...");
    const reportRes = await fetch(`${API_URL}/tills/session/${sessionId}/report`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const report: any = await reportRes.json();

    console.log("Till Report Summary:", JSON.stringify(report.summary, null, 2));

    const expectedCash = Number(report.summary.expectedCash || report.summary.closingBalance);
    // Float (100) + Sale (120) - Refund (120) = 100
    // Wait, sale total might be 120. Refund is 120.

    console.log(`Expected Cash: ${expectedCash}`);

    // We expect 100 (Start) + 120 (Sale) - 120 (Refund) = 100.
    const hasSales = report.summary.totalSalesValue > 0;
    const hasCashOut = report.summary.cashOut > 0;

    if (!hasSales) console.error("FAILURE: No sales recorded in session.");
    if (!hasCashOut) console.error("FAILURE: No refund/cash-out recorded in session.");

    if (Math.abs(expectedCash - 100) < 0.01 && hasSales && hasCashOut) {
        console.log(`SUCCESS: Expected Cash is correct ($${expectedCash}). Sales verified ($${report.summary.totalSalesValue}). Refund verified ($${report.summary.cashOut}).`);
    } else {
        console.error(`FAILURE: Expected Cash: ${expectedCash}. Sales: ${report.summary.totalSalesValue}. CashOut: ${report.summary.cashOut}`);
    }
}

main().catch(console.error);
