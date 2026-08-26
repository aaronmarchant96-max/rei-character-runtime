import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_FORM_ID = 0x00000800;

function subrecord(type, data) {
  const header = Buffer.alloc(6);
  header.write(type, 0, 4, "ascii");
  header.writeUInt16LE(data.length, 4);
  return Buffer.concat([header, data]);
}

function record(type, formId, payload) {
  const header = Buffer.alloc(20);
  header.write(type, 0, 4, "ascii");
  header.writeUInt32LE(payload.length, 4);
  header.writeUInt32LE(0, 8);
  header.writeUInt32LE(formId, 12);
  header.writeUInt32LE(0, 16);
  return Buffer.concat([header, payload]);
}

function cString(value) {
  return Buffer.from(`${value}\0`, "ascii");
}

export function createEchoForgePlugin() {
  const headerData = Buffer.alloc(12);
  headerData.writeFloatLE(1, 0);
  headerData.writeUInt32LE(1, 4);
  headerData.writeUInt32LE(PACKAGE_FORM_ID + 1, 8);
  const tes4 = record("TES4", 0, Buffer.concat([
    subrecord("HEDR", headerData),
    subrecord("CNAM", cString("REI AI")),
    subrecord("SNAM", cString("EchoForge bounded NPC action package.")),
    subrecord("MAST", cString("Oblivion.esm")),
    subrecord("DATA", Buffer.alloc(8))
  ]));

  const packageData = Buffer.alloc(8);
  packageData.writeUInt32LE(0, 0);
  packageData.writeUInt8(0, 4); // Find package; target is replaced before use.
  const locationData = Buffer.alloc(12);
  locationData.writeUInt8(2, 0); // Current location.
  const scheduleData = Buffer.from([0xFF, 0xFF, 0x00, 0xFF, 0, 0, 0, 0]);
  const targetData = Buffer.alloc(12);
  targetData.writeUInt8(0, 0); // Reference target.
  targetData.writeUInt32LE(0x00000014, 4); // Safe placeholder: PlayerREF.
  targetData.writeUInt32LE(1, 8);
  const packageRecord = record("PACK", PACKAGE_FORM_ID, Buffer.concat([
    subrecord("EDID", cString("EchoForgePickupTravel")),
    subrecord("PKDT", packageData),
    subrecord("PLDT", locationData),
    subrecord("PSDT", scheduleData),
    subrecord("PTDT", targetData)
  ]));
  const groupHeader = Buffer.alloc(20);
  groupHeader.write("GRUP", 0, 4, "ascii");
  groupHeader.writeUInt32LE(groupHeader.length + packageRecord.length, 4);
  groupHeader.write("PACK", 8, 4, "ascii");
  groupHeader.writeUInt32LE(0, 12);
  groupHeader.writeUInt32LE(0, 16);
  return Buffer.concat([tes4, groupHeader, packageRecord]);
}

async function main() {
  const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
  const outputPath = resolve(outputArgument?.slice("--output=".length)
    ?? ".local/oblivion/EchoForge.esp");
  const plugin = createEchoForgePlugin();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, plugin);
  process.stdout.write(`${outputPath} ${plugin.length} bytes\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
