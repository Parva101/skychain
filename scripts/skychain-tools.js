#!/usr/bin/env node
"use strict";

const fs = require("fs");
const crypto = require("crypto");

function sha256Bytes32(buffer) {
  return "0x" + crypto.createHash("sha256").update(buffer).digest("hex");
}

function readFileOrExit(path) {
  try {
    return fs.readFileSync(path);
  } catch (err) {
    console.error(`Cannot read "${path}": ${err.message}`);
    process.exit(2);
  }
}

function diffSummary(a, b) {
  const shared = Math.min(a.length, b.length);
  let firstDiff = -1;
  let differing = 0;
  for (let i = 0; i < shared; i++) {
    if (a[i] !== b[i]) {
      if (firstDiff === -1) firstDiff = i;
      differing++;
    }
  }
  const lengthGap = Math.abs(a.length - b.length);
  if (firstDiff === -1 && lengthGap > 0) firstDiff = shared;
  return { firstDiff, differing: differing + lengthGap };
}

function cmdHash(args) {
  if (args.length !== 1) usage("hash needs exactly one file");
  const data = readFileOrExit(args[0]);
  console.log(sha256Bytes32(data));
}

function cmdCompare(args) {
  if (args.length !== 2) usage("compare needs two files: <original> <candidate>");
  const original = readFileOrExit(args[0]);
  const candidate = readFileOrExit(args[1]);
  const hashA = sha256Bytes32(original);
  const hashB = sha256Bytes32(candidate);
  const match = hashA === hashB;

  console.log(`original  ${hashA}  (${original.length} bytes)  ${args[0]}`);
  console.log(`candidate ${hashB}  (${candidate.length} bytes)  ${args[1]}`);
  console.log("");

  if (match) {
    console.log("MATCH: the files are identical, so verifyCertificate would return true.");
    process.exit(0);
  }

  const { firstDiff, differing } = diffSummary(original, candidate);
  console.log("NO MATCH: verifyCertificate would return false.");
  console.log(`First difference at byte ${firstDiff}; ${differing} byte(s) differ in total.`);
  process.exit(1);
}

function cmdPartId(args) {
  if (args.length !== 2) usage("partid needs two values: <partNumber> <serialNumber>");
  let ethers;
  try {
    ({ ethers } = require("ethers"));
  } catch (err) {
    console.error('The "partid" command needs ethers. Run: npm install ethers');
    process.exit(2);
  }
  const [partNumber, serialNumber] = args;
  const partId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["string", "string"], [partNumber, serialNumber])
  );
  console.log(partId);
}

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    [
      "Usage:",
      "  node scripts/skychain-tools.js hash    <file>",
      "  node scripts/skychain-tools.js compare <original> <candidate>",
      "  node scripts/skychain-tools.js partid  <partNumber> <serialNumber>",
    ].join("\n")
  );
  process.exit(2);
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "hash":
      return cmdHash(args);
    case "compare":
      return cmdCompare(args);
    case "partid":
      return cmdPartId(args);
    default:
      return usage(command ? `unknown command "${command}"` : "no command given");
  }
}

main();