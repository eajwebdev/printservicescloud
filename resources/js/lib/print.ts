/**
 * Print a receipt without leaving the page: load the thermal-width receipt into a hidden
 * frame and let it call print(). With Chrome launched using --kiosk-printing it goes
 * straight to the default printer; otherwise the normal print dialog appears once.
 */
export function printReceipt(orderId: number): Promise<void> {
    return new Promise((resolve) => {
        document.getElementById('pr-print-frame')?.remove();
        const frame = document.createElement('iframe');
        frame.id = 'pr-print-frame';
        frame.title = 'Receipt printer';
        frame.setAttribute('aria-hidden', 'true');
        Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
        frame.src = route('orders.print', orderId);
        frame.onload = () => {
            // The receipt page prints itself on load; drop the frame once the dialog is done.
            window.setTimeout(() => {
                resolve();
                window.setTimeout(() => frame.remove(), 60000);
            }, 400);
        };
        document.body.appendChild(frame);
    });
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
