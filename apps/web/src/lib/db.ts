import Dexie, { Table } from 'dexie';
import { Product } from './api';

export interface SyncRequest {
    id?: number;
    url: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body: any;
    createdAt: number;
    retryCount: number;
}

export interface Customer {
    id: string;
    code?: string;
    name: string;
    email?: string;
    phone?: string;
    loyaltyPoints: number;
    tenantId: string;
}

export class RetailDB extends Dexie {
    products!: Table<Product, string>;
    customers!: Table<Customer, string>;
    syncQueue!: Table<SyncRequest, number>;

    constructor() {
        super('RetailPOS_DB');
        this.version(40).stores({ // Bumped to 40 to fix VersionError (existed: 30)
            products: 'id, sku, name, barcode',
            customers: 'id, name, phone, email',
            syncQueue: '++id, createdAt'
        });
    }
}

export const db = new RetailDB();
