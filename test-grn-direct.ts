
const API_URL = 'http://localhost:4000';
console.log("Script starting...");

async function main() {
    // 1. Login
    console.log("Logging in...");
    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'testadmin@retailcraft.com', password: 'password' })
    });

    if (!loginRes.ok) {
        console.error("Login failed:", await loginRes.text());
        return;
    }

    const loginData: any = await loginRes.json();
    const token = loginData.access_token;
    const storeId = loginData.user.storeId;
    console.log("Logged in. Token:", token.substring(0, 20) + "...");

    // 2. Find PO
    // Fetch full PO details
    // PO ID from previous attempts: 04a1eaf4-9495-4c30-b810-da1100f775e6
    const poId = '04a1eaf4-9495-4c30-b810-da1100f775e6';

    // 3. Receive Goods
    const payload = {
        poId: poId,
        storeId: storeId,
        items: [
            {
                productId: "023eaa12-423d-4835-9287-24b11f7ccd66",
                quantityReceived: 1,
                costPrice: 55,
                sellingPrice: 120,
                batchNumber: 'DIRECT-TEST-001',
                expiryDate: new Date().toISOString()
            }
        ]
    };

    console.log("Sending Payload:", JSON.stringify(payload, null, 2));

    const recRes = await fetch(`${API_URL}/grn`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    console.log("Response Status:", recRes.status);
    const text = await recRes.text();
    console.log("Response Body:", text);
}

main().catch(console.error);
