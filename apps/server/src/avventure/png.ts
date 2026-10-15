import { open } from 'node:fs/promises';

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Dimensioni di un PNG lette dall'intestazione; `null` se il file non è un PNG. */
export async function dimensioniPng(
  file: string,
): Promise<{ larghezza: number; altezza: number } | null> {
  const handle = await open(file, 'r');
  try {
    const testa = Buffer.alloc(24);
    const { bytesRead } = await handle.read(testa, 0, 24, 0);
    if (bytesRead < 24 || !testa.subarray(0, 8).equals(FIRMA_PNG)) return null;
    if (testa.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { larghezza: testa.readUInt32BE(16), altezza: testa.readUInt32BE(20) };
  } finally {
    await handle.close();
  }
}
