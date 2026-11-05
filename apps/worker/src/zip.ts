export interface ZipFileEntry {
  name: string;
  data: Uint8Array;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.byteLength; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds a standard PKZIP (`STORE` method 0) archive from already-compressed PNG slices.
 */
export function buildZipArchive(entries: readonly ZipFileEntry[]): Uint8Array {
  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const safeName = entry.name.replace(/^\/+/, "").replace(/\\/g, "/");
    const nameBuf = Buffer.from(safeName, "utf-8");
    const dataBuf = Buffer.from(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);
    const checksum = crc32(entry.data);
    const size = dataBuf.byteLength;

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30 + nameBuf.byteLength);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4); // Version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(0, 8); // Compression: STORE (0)
    localHeader.writeUInt16LE(0, 10); // Mod time
    localHeader.writeUInt16LE(0, 12); // Mod date
    localHeader.writeUInt32LE(checksum, 14); // CRC-32
    localHeader.writeUInt32LE(size, 18); // Compressed size
    localHeader.writeUInt32LE(size, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.byteLength, 26); // Filename length
    localHeader.writeUInt16LE(0, 28); // Extra length
    nameBuf.copy(localHeader, 30);

    localRecords.push(localHeader, dataBuf);

    // Central directory header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46 + nameBuf.byteLength);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Signature
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 flag
    centralHeader.writeUInt16LE(0, 10); // Compression: STORE (0)
    centralHeader.writeUInt16LE(0, 12); // Mod time
    centralHeader.writeUInt16LE(0, 14); // Mod date
    centralHeader.writeUInt32LE(checksum, 16); // CRC-32
    centralHeader.writeUInt32LE(size, 20); // Compressed size
    centralHeader.writeUInt32LE(size, 24); // Uncompressed size
    centralHeader.writeUInt16LE(nameBuf.byteLength, 28); // Filename length
    centralHeader.writeUInt16LE(0, 30); // Extra length
    centralHeader.writeUInt16LE(0, 32); // Comment length
    centralHeader.writeUInt16LE(0, 34); // Disk start
    centralHeader.writeUInt16LE(0, 36); // Internal attrs
    centralHeader.writeUInt32LE(0, 38); // External attrs
    centralHeader.writeUInt32LE(localOffset, 42); // Offset of local header
    nameBuf.copy(centralHeader, 46);

    centralRecords.push(centralHeader);
    localOffset += localHeader.byteLength + size;
  }

  const centralSize = centralRecords.reduce((acc, b) => acc + b.byteLength, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // Disk number
  eocd.writeUInt16LE(0, 6); // Central dir start disk
  eocd.writeUInt16LE(entries.length, 8); // Entries on disk
  eocd.writeUInt16LE(entries.length, 10); // Total entries
  eocd.writeUInt32LE(centralSize, 12); // Size of central dir
  eocd.writeUInt32LE(localOffset, 16); // Offset of central dir
  eocd.writeUInt16LE(0, 20); // Comment length

  const combined = Buffer.concat([...localRecords, ...centralRecords, eocd]);
  return new Uint8Array(combined.buffer, combined.byteOffset, combined.byteLength);
}

export function listZipEntryNames(zipBytes: Uint8Array): string[] {
  const buf = Buffer.from(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  if (buf.byteLength < 22) {
    throw new Error("Invalid ZIP archive: too short.");
  }

  // Locate EOCD at end of buffer
  const eocdOffset = buf.byteLength - 22;
  if (buf.readUInt32LE(eocdOffset) !== 0x06054b50) {
    throw new Error("Invalid ZIP archive: missing EOCD signature.");
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  let cursor = buf.readUInt32LE(eocdOffset + 16);
  const names: string[] = [];

  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Invalid ZIP central directory entry.");
    }
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const name = buf.subarray(cursor + 46, cursor + 46 + nameLen).toString("utf-8");
    names.push(name);
    cursor += 46 + nameLen + extraLen + commentLen;
  }

  return names;
}

