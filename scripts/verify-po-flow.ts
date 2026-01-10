
import axios from 'axios';

const API_URL = 'http://localhost:4000';
const ADMIN_EMAIL = 'admin@pos.local';
const ADMIN_PASSWORD = 'password';

async function run() {
    console.log('🚀 Starting PO Workflow Verification...');

    try {
        // 1. Login
        console.log('1️⃣  Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        const token = loginRes.data.access_token;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Logged in.');

        // 2. Get Store
        console.log('2️⃣  Fetching Stores...');
        const storesRes = await axios.get(`${API_URL}/stores`, { headers });
        const store = storesRes.data[0];
        if (!store) throw new Error('No stores found');
        console.log(`✅ Selected Store: ${store.name} (${store.id})`);

        // 3. Create Supplier
        console.log('3️⃣  Creating Supplier...');
        const supplierRes = await axios.post(`${API_URL}/suppliers`, {
            name: `Acme Inc ${Date.now()}`, // Unique name
            currency: 'USD',
            termDays: 30
        }, { headers });
        const supplier = supplierRes.data;
        console.log(`✅ Created Supplier: ${supplier.name} (${supplier.id})`);

        // 4. Create Product
        console.log('4️⃣  Creating Product...');
        const productRes = await axios.post(`${API_URL}/products`, {
            name: 'Widget Auto',
            sku: `WIDGET-${Date.now()}`, // Unique SKU
            price: 100,
            costPrice: 50,
            minStockLevel: 10,
            supplierId: supplier.id,
            storeId: store.id
        }, { headers });
        const product = productRes.data;
        console.log(`✅ Created Product: ${product.name} (${product.id})`);

        // 4b. Verify current stock is 0
        const stock0 = product.inventory?.find((i: any) => i.storeId === store.id)?.quantity || 0;
        console.log(`ℹ️ Current Stock: ${stock0}`);

        // 5. Get Reorder Suggestions (Optional Check)
        console.log('5️⃣  Checking Reorder Suggestions...');
        const suggestionsRes = await axios.get(`${API_URL}/suppliers/${supplier.id}/reorder-items?storeId=${store.id}`, { headers });
        const suggestion = suggestionsRes.data.find((s: any) => s.productId === product.id);
        if (suggestion) {
            console.log(`✅ Suggestion Found: Order ${suggestion.suggestedQty} units`);
        } else {
            console.warn('⚠️ No suggestion found?');
        }

        // 6. Create PO
        console.log('6️⃣  Creating Purchase Order...');
        const poPayload = {
            supplierId: supplier.id,
            storeId: store.id,
            items: [
                {
                    productId: product.id,
                    quantity: 10,
                    unitCost: 50
                }
            ],
            status: 'SENT'
        };
        const poRes = await axios.post(`${API_URL}/purchase-orders`, poPayload, { headers });
        const po = poRes.data;
        console.log(`✅ Created PO: ${po.poNumber} (${po.id})`);

        // 6b. Update Status to SENT
        console.log('6b. Updating PO Status to SENT...');
        await axios.patch(`${API_URL}/purchase-orders/${po.id}/status`, { status: 'SENT' }, { headers });
        console.log(`✅ PO Status Updated`);

        // 7. Receive Stock (GRN)
        console.log('7️⃣  Receiving Stock (GRN)...');
        const grnPayload = {
            poId: po.id,
            items: [
                {
                    productId: product.id,
                    quantityReceived: 5,
                    batchNumber: 'BATCH-001',
                    expiryDate: new Date().toISOString()
                }
            ],
            storeId: store.id
        };
        const grnRes = await axios.post(`${API_URL}/grn`, grnPayload, { headers });
        const grn = grnRes.data;
        console.log(`✅ Created GRN: ${grn.grnNumber}`);

        // 8. Verify Inventory
        console.log('8️⃣  Verifying Inventory Update...');
        const productCheck = await axios.get(`${API_URL}/products/${product.id}`, { headers });
        const stockFinal = productCheck.data.inventory?.find((i: any) => i.storeId === store.id)?.quantity || 0;

        if (stockFinal === 5) {
            console.log(`✅ SUCCESS! Stock updated to ${stockFinal}.`);
        } else {
            console.error(`❌ FAILURE! Expected 5, got ${stockFinal}`);
            process.exit(1);
        }

    } catch (error: any) {
        console.error('❌ Error executing workflow:', error.response?.data || error.message);
        process.exit(1);
    }
}

run();
