import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { crc32 } from "node:zlib";
import { finished } from "node:stream/promises";

const LOCAL_HEADER_SIG = 0x04034b50;
const CENTRAL_HEADER_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const ZIP_VERSION = 20;

function u16(value) {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
}

/**
 * Write a ZIP archive using the STORE method (no compression).
 * @param {string} zipPath
 * @param {{ name: string, data: Buffer }[]} entries
 */
export async function writeZipStore(zipPath, entries) {
  if (entries.length === 0) {
    throw new Error("writeZipStore requires at least one entry.");
  }

  await mkdir(path.dirname(zipPath), { recursive: true });
  const output = createWriteStream(zipPath);

  /** @type {{ name: Buffer, crc: number, size: number, offset: number }[]} */
  const catalog = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replaceAll("\\", "/"), "utf8");
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;

    const localHeader = Buffer.concat([
      u32(LOCAL_HEADER_SIG),
      u16(ZIP_VERSION),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(size),
      u32(size),
      u16(name.length),
      u16(0),
      name,
    ]);

    output.write(localHeader);
    output.write(data);

    catalog.push({ name, crc, size, offset });
    offset += localHeader.length + size;
  }

  const centralStart = offset;
  for (const item of catalog) {
    const centralHeader = Buffer.concat([
      u32(CENTRAL_HEADER_SIG),
      u16(ZIP_VERSION),
      u16(ZIP_VERSION),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(item.crc),
      u32(item.size),
      u32(item.size),
      u16(item.name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(item.offset),
      item.name,
    ]);
    output.write(centralHeader);
    offset += centralHeader.length;
  }

  const centralSize = offset - centralStart;
  const eocd = Buffer.concat([
    u32(EOCD_SIG),
    u16(0),
    u16(0),
    u16(catalog.length),
    u16(catalog.length),
    u32(centralSize),
    u32(centralStart),
    u16(0),
  ]);
  output.write(eocd);
  output.end();
  await finished(output);
}
