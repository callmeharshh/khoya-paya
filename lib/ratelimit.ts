// Lightweight anti-spam. Tracks report velocity per device and per phone in a
// rolling window. Sensible thresholds (NOT "1 per number" — a father may report
// his mother AND his son): flag suspicious volume, hard-block egregious spam.

interface RateState {
  byDevice: Map<string, number[]>;
  byPhone: Map<string, number[]>;
}

const g = globalThis as unknown as { __khoyaRate?: RateState };
const state: RateState =
  g.__khoyaRate ?? (g.__khoyaRate = { byDevice: new Map(), byPhone: new Map() });

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const DEVICE_FLAG = 8; // > this many in window → flag for review
const DEVICE_BLOCK = 20; // > this many → block as spam
const PHONE_FLAG = 5; // > this many from one phone → flag

export interface RateResult {
  allowed: boolean;
  flags: string[];
}

function record(map: Map<string, number[]>, key: string): number {
  const now = Date.now();
  const arr = (map.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  map.set(key, arr);
  return arr.length;
}

export function checkRate(
  deviceId?: string | null,
  phone?: string | null
): RateResult {
  const flags: string[] = [];

  if (deviceId) {
    const n = record(state.byDevice, deviceId);
    if (n > DEVICE_BLOCK) {
      return {
        allowed: false,
        flags: [`Blocked: ${n} reports from this device in 5 min — likely spam.`],
      };
    }
    if (n > DEVICE_FLAG) {
      flags.push(`High report volume from this device (${n} in 5 min).`);
    }
  }

  if (phone) {
    const n = record(state.byPhone, phone);
    if (n > PHONE_FLAG) {
      flags.push(`Multiple reports from phone ${phone} (${n} in 5 min).`);
    }
  }

  return { allowed: true, flags };
}
