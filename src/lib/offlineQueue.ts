export interface QueuedMutation {
  id: string;
  createdAt: number;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  body?: any;
  description: string;
}

const QUEUE_KEY = 'bikepark_offline_queue';

export function getOfflineQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedMutation[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event('bikepark_offline_queue_changed'));
  } catch (e) {
    console.error('Erro ao salvar fila offline:', e);
  }
}

export function enqueueOfflineMutation(mutation: Omit<QueuedMutation, 'id' | 'createdAt'>): QueuedMutation {
  const queue = getOfflineQueue();
  const item: QueuedMutation = {
    ...mutation,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  queue.push(item);
  saveOfflineQueue(queue);
  return item;
}

export async function flushOfflineQueue(): Promise<{ synced: number; failed: number; conflicts: string[] }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0, conflicts: [] };

  const remaining: QueuedMutation[] = [];
  const conflicts: string[] = [];
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
      });

      if (res.ok) {
        synced++;
      } else if (res.status === 400 || res.status === 404 || res.status === 409) {
        // Conflito ou registro já finalizado/ocupado por outro aparelho -> não re-tentar indefinidamente
        const errData = await res.json().catch(() => ({}));
        conflicts.push(`${item.description}: ${errData.error || 'Conflito no servidor'}`);
      } else {
        remaining.push(item);
        failed++;
      }
    } catch {
      remaining.push(item);
      failed++;
    }
  }

  saveOfflineQueue(remaining);
  return { synced, failed, conflicts };
}
