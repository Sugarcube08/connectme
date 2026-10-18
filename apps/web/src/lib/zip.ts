/**
 * Zero-dependency PKZIP 2.0 generator for creating client-side ZIP archives.
 * Perfect for bundling already-compressed files (like PNG images) without
 * heavy external libraries.
 */

// Precomputed CRC32 table for fast checksumming
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function calculateCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFileInput {
  name: string;
  data: Uint8Array;
}

/**
 * Creates a standard ZIP Blob (store mode) containing the provided files.
 */
export function createZipBlob(files: ZipFileInput[]): Blob {
  const parts: Uint8Array[] = [];
  const entries: {
    nameBytes: Uint8Array;
    crc: number;
    size: number;
    offset: number;
  }[] = [];

  let currentOffset = 0;
  const now = new Date();
  // DOS date & time format
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((Math.floor(now.getSeconds() / 2) & 0x1f) >>> 0);
  const dosDate =
    (((now.getFullYear() - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  const encoder = new TextEncoder();

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = file.data;
    const crc = calculateCrc32(dataBytes);
    const size = dataBytes.length;

    // 30-byte local file header
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // Local header signature
    view.setUint16(4, 20, true); // Version needed to extract (2.0)
    view.setUint16(6, 0x0800, true); // General purpose flag: UTF-8 filename
    view.setUint16(8, 0, true); // Compression method: 0 (Store)
    view.setUint16(10, dosTime, true);
    view.setUint16(12, dosDate, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true); // Compressed size
    view.setUint32(22, size, true); // Uncompressed size
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true); // Extra field length

    localHeader.set(nameBytes, 30);

    parts.push(localHeader);
    parts.push(dataBytes);

    entries.push({
      nameBytes,
      crc,
      size,
      offset: currentOffset,
    });

    currentOffset += localHeader.length + dataBytes.length;
  }

  const centralDirStart = currentOffset;
  let centralDirSize = 0;

  for (const entry of entries) {
    // 46-byte central directory header
    const cdHeader = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(cdHeader.buffer);

    view.setUint32(0, 0x02014b50, true); // Central directory signature
    view.setUint16(4, 20, true); // Version made by
    view.setUint16(6, 20, true); // Version needed
    view.setUint16(8, 0x0800, true); // General purpose: UTF-8
    view.setUint16(10, 0, true); // Method: Store
    view.setUint16(12, dosTime, true);
    view.setUint16(14, dosDate, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.size, true);
    view.setUint32(24, entry.size, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true); // Extra field len
    view.setUint16(32, 0, true); // File comment len
    view.setUint16(34, 0, true); // Disk number start
    view.setUint16(36, 0, true); // Internal attributes
    view.setUint32(38, 0, true); // External attributes
    view.setUint32(42, entry.offset, true); // Relative offset of local header

    cdHeader.set(entry.nameBytes, 46);

    parts.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  // 22-byte End of Central Directory record
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);

  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true); // Number of this disk
  eocdView.setUint16(6, 0, true); // Disk with central directory
  eocdView.setUint16(8, entries.length, true); // Total entries on this disk
  eocdView.setUint16(10, entries.length, true); // Total entries overall
  eocdView.setUint32(12, centralDirSize, true); // Size of central directory
  eocdView.setUint32(16, centralDirStart, true); // Offset of start of central directory
  eocdView.setUint16(20, 0, true); // Comment length

  parts.push(eocd);

  return new Blob(parts as unknown as BlobPart[], { type: "application/zip" });
}

/**
 * Converts a base64 data URL (e.g. data:image/png;base64,...) to Uint8Array.
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(",");
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Initiates a browser file download from a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
