#!/usr/bin/env node

"use strict";

const fs = require("fs");
const crypto = require("crypto");

let ethers;
try {
  ({ ethers } = require("ethers"));
} catch (err) {
  console.error("This script needs ethers. Run: npm install ethers");
  process.exit(2);
}

const ABI = [
  "function getPartId(string partNumber, string serialNumber) pure returns (bytes32)",
  "function getPart(bytes32 partId) view returns (tuple(string partNumber, string serialNumber, address manufacturer, address custodian, bytes32 certificateHash, string certificateCID, uint8 status, uint256 registeredAt))",
  "function pendingRecipient(bytes32 partId) view returns (address)",
  "function verifyCertificate(bytes32 partId, bytes32 candidateHash) view returns (bool)",
];

const STATUS = ["Registered", "Serviceable", "UnderRepair", "Retired"];
const ZERO_ADDRESS = ethers.ZeroAddress;
const ZERO_HASH = ethers.ZeroHash;

function fail(message, code = 2) {
  console.error(`Error: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) fail(`unexpected argument "${arg}"`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail(`--${key} needs a value`);
    out[key] = value;
    i++;
  }
  return out;
}

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/read-part.js --address <contract> --rpc <rpcUrl> \\",
      "       --part <partNumber> --serial <serialNumber> [--cert <file>]",
      "",
      "  --address and --rpc can also come from SKYCHAIN_ADDRESS and SKYCHAIN_RPC.",
    ].join("\n")
  );
  process.exit(2);
}

function sha256Bytes32(buffer) {
  return "0x" + crypto.createHash("sha256").update(buffer).digest("hex");
}

function describeRole(address, part) {
  const roles = [];
  if (address === part.manufacturer) roles.push("manufacturer");
  if (address === part.custodian) roles.push("current custodian");
  return roles.length ? `  (${roles.join(", ")})` : "";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const address = args.address || process.env.SKYCHAIN_ADDRESS;
  const rpc = args.rpc || process.env.SKYCHAIN_RPC;
  const partNumber = args.part;
  const serialNumber = args.serial;

  if (!address || !rpc || !partNumber || !serialNumber) usage();
  if (!ethers.isAddress(address)) fail(`"${address}" is not a valid contract address`);

  const provider = new ethers.JsonRpcProvider(rpc);

  let code;
  try {
    code = await provider.getCode(address);
  } catch (err) {
    fail(`could not reach the RPC endpoint (${rpc}). Is the URL right, or is it busy? ${err.shortMessage || err.message}`);
  }
  if (code === "0x") fail(`no contract found at ${address} on this network. Check the address and the RPC network.`);

  const contract = new ethers.Contract(address, ABI, provider);

  const partId = await contract.getPartId(partNumber, serialNumber);

  let part;
  try {
    part = await contract.getPart(partId);
  } catch (err) {
    if (err.reason === "Unknown part") {
      fail(`no part is registered with part number "${partNumber}" and serial number "${serialNumber}".`);
    }
    throw err;
  }

  const pending = await contract.pendingRecipient(partId);
  const hasCertificate = part.certificateHash !== ZERO_HASH;

  console.log(`Part ID        ${partId}`);
  console.log(`Part number    ${part.partNumber}`);
  console.log(`Serial number  ${part.serialNumber}`);
  console.log(`Status         ${STATUS[Number(part.status)] ?? `unknown (${part.status})`}`);
  console.log(`Manufacturer   ${part.manufacturer}`);
  console.log(`Custodian      ${part.custodian}${describeRole(part.custodian, part)}`);
  console.log(`Pending xfer   ${pending === ZERO_ADDRESS ? "none" : `to ${pending}`}`);
  console.log(`Registered     ${new Date(Number(part.registeredAt) * 1000).toISOString()}`);
  console.log(`Cert hash      ${hasCertificate ? part.certificateHash : "none recorded"}`);
  console.log(`Cert CID       ${hasCertificate ? part.certificateCID : "-"}`);

  if (args.cert) {
    let file;
    try {
      file = fs.readFileSync(args.cert);
    } catch (err) {
      fail(`cannot read "${args.cert}": ${err.message}`);
    }
    const fileHash = sha256Bytes32(file);
    const ok = await contract.verifyCertificate(partId, fileHash);

    console.log("");
    console.log(`File           ${args.cert}  (${file.length} bytes)`);
    console.log(`File hash      ${fileHash}`);
    console.log(`On-chain hash  ${hasCertificate ? part.certificateHash : "none recorded"}`);
    console.log(ok ? "Result         MATCH: the file matches the certificate recorded on-chain."
                   : "Result         NO MATCH: the file differs from the recorded certificate (or none is recorded).");
    process.exit(ok ? 0 : 1);
  }
}

main().catch((err) => fail(err.shortMessage || err.message));