const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

const fnv1a = (data: Uint8Array): string => {
  let hash = 0x811c9dc5;
  for (const byte of data) {
    hash ^= byte;
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

/**
 * Content checksum of a file (SHA-256 over the raw bytes), not a hash of its
 * name or size. Falls back to a byte-level FNV-1a in environments where Web
 * Crypto is unavailable, so the digest is still derived from file content.
 */
export const checksumFile = async (file: File): Promise<string> => {
  const data = await file.arrayBuffer();
  const bytes = new Uint8Array(data);
  try {
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
      return `SHA-256:${bytesToHex(new Uint8Array(digest))}`;
    }
  } catch {
    // fall through to the non-crypto digest below
  }
  return `FNV-1a:${fnv1a(bytes)}`;
};