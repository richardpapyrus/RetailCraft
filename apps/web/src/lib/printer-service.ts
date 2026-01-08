export class PrinterService {
    private device: any | null = null;
    private interfaceNumber = 0;
    private endpointOut = 0;

    async connect() {
        if (!(navigator as any).usb) {
            throw new Error('WebUSB not supported in this browser');
        }

        try {
            // Request device - Filter for Printer Class (7), Epson (0x04b8), Star Micronics (0x0519)
            this.device = await (navigator as any).usb.requestDevice({
                filters: [
                    { vendorId: 0x04b8 }, // Epson
                    { vendorId: 0x0519 }  // Star Micronics
                ]
            });
            await this.device.open();
            await this.device.selectConfiguration(1);

            // claim interface (usually 0)
            const iface = this.device.configuration?.interfaces[0];
            if (!iface) throw new Error('No interface found');

            this.interfaceNumber = iface.interfaceNumber;
            await this.device.claimInterface(this.interfaceNumber);

            // Find OUT endpoint
            const endpoint = iface.alternate.endpoints.find((e: any) => e.direction === 'out');
            if (!endpoint) throw new Error('No OUT endpoint found');
            this.endpointOut = endpoint.endpointNumber;

        } catch (error) {
            console.error('Printer connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.device) {
            await this.device.close();
            this.device = null;
        }
    }

    isConnected() {
        return !!this.device && !!this.device.opened;
    }

    async print(data: Uint8Array) {
        if (!this.device || !this.isConnected()) {
            throw new Error('Printer not connected');
        }
        await this.device.transferOut(this.endpointOut, data);
    }

    // --- ESC/POS ENCODER HELPERS ---

    // Simple text encoder
    encode(text: string): Uint8Array {
        return new TextEncoder().encode(text);
    }

    // Commands
    static ESC = 0x1B;
    static GS = 0x1D;

    // Initialization
    get init() { return new Uint8Array([0x1B, 0x40]); }

    // Cut Paper
    get cut() { return new Uint8Array([0x1D, 0x56, 0x41, 0x00]); }

    // Text Formatting
    get center() { return new Uint8Array([0x1B, 0x61, 0x01]); }
    get left() { return new Uint8Array([0x1B, 0x61, 0x00]); }
    get right() { return new Uint8Array([0x1B, 0x61, 0x02]); }

    get boldOn() { return new Uint8Array([0x1B, 0x45, 0x01]); }
    get boldOff() { return new Uint8Array([0x1B, 0x45, 0x00]); }

    get sizeNormal() { return new Uint8Array([0x1D, 0x21, 0x00]); }
    get sizeDouble() { return new Uint8Array([0x1D, 0x21, 0x11]); } // Double Width + Height

    // Builder logic to combine commands
    static createReceipt(storeName: string, items: any[], total: string) {
        const encoder = new TextEncoder();
        const commands: number[] = [];

        const add = (cmd: Uint8Array) => commands.push(...Array.from(cmd));
        const addText = (text: string) => commands.push(...Array.from(encoder.encode(text)));
        const addLine = (text: string) => addText(text + '\n');

        // Init
        add(new Uint8Array([0x1B, 0x40]));

        // Header
        add(new Uint8Array([0x1B, 0x61, 0x01])); // Center
        add(new Uint8Array([0x1D, 0x21, 0x11])); // Double Size
        addLine(storeName);
        add(new Uint8Array([0x1D, 0x21, 0x00])); // Normal Size
        addLine('--------------------------------');

        // Items
        add(new Uint8Array([0x1B, 0x61, 0x00])); // Left
        items.forEach(item => {
            addLine(`${item.name} x${item.quantity}`);
            // Right align price? (Simple implementation: just Format: "Name $Price")
            // A more complex implementation would calculate spaces.
        });

        addLine('--------------------------------');

        // Total
        add(new Uint8Array([0x1B, 0x61, 0x02])); // Right
        add(new Uint8Array([0x1B, 0x45, 0x01])); // Bold
        addLine(`TOTAL: ${total}`);
        add(new Uint8Array([0x1B, 0x45, 0x00])); // Bold Off

        // Footer
        add(new Uint8Array([0x1B, 0x61, 0x01])); // Center
        addLine('\nThank you for shopping!\n\n\n');

        // Cut
        add(new Uint8Array([0x1D, 0x56, 0x41, 0x00]));

        return new Uint8Array(commands);
    }
}

export const printerService = new PrinterService();
