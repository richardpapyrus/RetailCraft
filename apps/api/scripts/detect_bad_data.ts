
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function detectBadData() {
    console.log("--- Detecting Data Anomalies ---");
    const sales = await prisma.sale.findMany({
        include: {
            items: true,
            returns: {
                include: { items: true }
            }
        }
    });

    let anomalies = 0;

    sales.forEach(sale => {
        const saleTotal = Number(sale.total);
        const returnTotal = sale.returns.reduce((sum, r) => sum + Number(r.total), 0);

        // Check 1: Refund > Sale Total
        if (returnTotal > saleTotal + 0.01) { // 0.01 tolerance
            console.log(`[!] Sale ${sale.id.slice(0, 8)} Anomalous Refund!`);
            console.log(`    Total: ${saleTotal.toFixed(2)}`);
            console.log(`    Refunded: ${returnTotal.toFixed(2)} (Diff: ${(saleTotal - returnTotal).toFixed(2)})`);
            console.log(`    Return Count: ${sale.returns.length}`);
            anomalies++;
        }

        // Check 2: Item Quantity Over-return
        const productMap = new Map();
        sale.items.forEach(i => productMap.set(i.productId, i.quantity));

        const returnMap = new Map();
        sale.returns.forEach(r => {
            r.items.forEach(ri => {
                returnMap.set(ri.productId, (returnMap.get(ri.productId) || 0) + ri.quantity);
            });
        });

        for (const [pid, qty] of productMap.entries()) {
            const returned = returnMap.get(pid) || 0;
            if (returned > qty) {
                console.log(`[!] Sale ${sale.id.slice(0, 8)} Item Over-returned! Product ${pid}`);
                console.log(`    Sold: ${qty}, Returned: ${returned}`);
                anomalies++;
            }
        }
    });

    if (anomalies === 0) {
        console.log("✅ No anomalies found. Data looks consistent.");
    } else {
        console.log(`❌ Found ${anomalies} anomalies. This explains the negative revenue.`);
    }

    await prisma.$disconnect();
}

detectBadData();
