
const API_URL = 'http://localhost:4000';

async function main() {
    console.log("Logging in...");
    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@pos.local', password: 'password' })
    });
    if (!loginRes.ok) throw new Error("Login failed");
    const loginData: any = await loginRes.json();
    const token = loginData.access_token;
    console.log(`Logged in.`);

    // 1. Create Product
    const rand = Math.floor(Math.random() * 10000);
    const productRes = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            name: `Archive Test Product ${rand}`,
            sku: `ARCH-${rand}`,
            price: 100,
            tenantId: loginData.user.tenantId,
            storeId: loginData.user.storeId
        })
    });
    if (!productRes.ok) throw new Error(`Create failed: ${await productRes.text()}`);
    const product = await productRes.json();
    console.log(`Product Created: ${product.id}`);

    // 2. Verify Visible
    const list1 = await fetch(`${API_URL}/products?search=${product.sku}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data1: any = await list1.json();
    if (!data1.data.find((p: any) => p.id === product.id)) throw new Error("Product not found in list");
    console.log("Product is visible.");

    // 3. Archive
    console.log("Archiving product...");
    const archiveRes = await fetch(`${API_URL}/products/${product.id}/archive`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!archiveRes.ok) throw new Error(`Archive failed: ${await archiveRes.text()}`);

    // 4. Verify Hidden (Default)
    const list2 = await fetch(`${API_URL}/products?search=${product.sku}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data2: any = await list2.json();
    if (data2.data.find((p: any) => p.id === product.id)) throw new Error("Product still visible in default list!");
    console.log("Product hidden from default list.");

    // 5. Verify Visible with Filter
    const list3 = await fetch(`${API_URL}/products?search=${product.sku}&includeArchived=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data3: any = await list3.json();
    if (!data3.data.find((p: any) => p.id === product.id)) throw new Error("Product not found with includeArchived=true");
    console.log("Product visible with includeArchived=true.");

    // 6. Unarchive
    console.log("Unarchiving product...");
    const unarchiveRes = await fetch(`${API_URL}/products/${product.id}/unarchive`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!unarchiveRes.ok) throw new Error(`Unarchive failed`);

    // 7. Verify Visible Again
    const list4 = await fetch(`${API_URL}/products?search=${product.sku}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data4: any = await list4.json();
    if (!data4.data.find((p: any) => p.id === product.id)) throw new Error("Product not visible after unarchive");
    console.log("Product visible again. Success!");
}

main().catch(console.error);
