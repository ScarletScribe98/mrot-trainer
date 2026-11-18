const MAX_VARIANT = 9999;

export function isVariant(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_VARIANT;
}

export function parseVariant(value: string | null | undefined): number | undefined {
  const number = Number(value);
  return isVariant(number) && String(number) === value ? number : undefined;
}

export function randomVariant(previous?: number): number {
  const sample = new Uint16Array(1);
  const limit = 65536 - 65536 % MAX_VARIANT;
  while (true) {
    crypto.getRandomValues(sample);
    const variant = sample[0] % MAX_VARIANT + 1;
    if (sample[0] < limit && variant !== previous) return variant;
  }
}

function seed(number: number, level: number): number {
  const value = Math.imul(number * 4 + level - 2, 0x9e3779b1);
  return (value ^ (value >>> 16)) >>> 0;
}

export function variantSeeds(variant: number) {
  return { map: seed(variant, 2), workers: seed(variant, 3), audit: seed(variant, 4), final: seed(variant, 5) };
}
