const HOUR = 3_600_000;
interface Window {
  end: number;
  total: number;
  clients: Record<string, number>;
}
type Storage = Pick<DurableObjectStorage, 'transaction'>;

export async function reportLimit(storage: Storage, key: string, now = Date.now()) {
  return storage.transaction(async (tx) => {
    let window = await tx.get<Window>('window');
    if (!window || window.end <= now) {
      await tx.delete('window');
      window = { end: (Math.floor(now / HOUR) + 1) * HOUR, total: 0, clients: {} };
    }
    await tx.setAlarm(window.end);
    if (window.total >= 100 || (window.clients[key] || 0) >= 10) return false;
    window.total++;
    window.clients[key] = (window.clients[key] || 0) + 1;
    await tx.put('window', window);
    return true;
  });
}

export async function expireReports(storage: Storage, now = Date.now()) {
  await storage.transaction(async (tx) => {
    const window = await tx.get<Window>('window');
    if (window && window.end <= now) await tx.delete('window');
    else if (window) await tx.setAlarm(window.end);
  });
}
