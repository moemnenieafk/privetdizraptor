import sharp from 'sharp';

const HASH_W = 9;
const HASH_H = 8;

/**
 * dHash 64 бита, hex 16 символов.
 * Устойчив к смене яркости и лёгкому ресайзу — это ровно то, что отличает
 * игровой скриншот от эталонной иконки tarkov.dev.
 */
export async function dhash(input: Buffer): Promise<string> {
  const { data } = await sharp(input)
    .greyscale()
    .normalise()
    .resize(HASH_W, HASH_H, { fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = 0n;
  for (let y = 0; y < HASH_H; y += 1) {
    for (let x = 0; x < HASH_W - 1; x += 1) {
      const left = data[y * HASH_W + x];
      const right = data[y * HASH_W + x + 1];
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

export function hamming(a: string, b: string): number {
  let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (diff > 0n) {
    diff &= diff - 1n;
    count += 1;
  }
  return count;
}
