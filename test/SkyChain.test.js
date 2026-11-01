import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { network } from "hardhat";

let connection, ethers, admin, manufacturer, issuer, repairStation, recipient, outsider, skychain;
let partId, certificateHash;
const partNumber = "SC-PUMP-100";
const serialNumber = "SN-0001";
// This is a test label, not a live IPFS CID.
const certificateCID = "demo-certificate-cid";
const Registered = 0n, Serviceable = 1n, UnderRepair = 2n, Retired = 3n;

before(async () => {
  connection = await network.create();
  ethers = connection.ethers;
  [admin, manufacturer, issuer, repairStation, recipient, outsider] = await ethers.getSigners();
  certificateHash = ethers.sha256(await readFile(new URL("./fixtures/release-certificate.txt", import.meta.url)));
});

beforeEach(async () => {
  skychain = await ethers.deployContract("SkyChain", [admin.address]);
  await skychain.waitForDeployment();
  await skychain.grantRole(await skychain.MANUFACTURER_ROLE(), manufacturer.address);
  await skychain.grantRole(await skychain.ISSUER_ROLE(), issuer.address);
  await skychain.grantRole(await skychain.REPAIR_STATION_ROLE(), repairStation.address);
  partId = await skychain.getPartId(partNumber, serialNumber);
  await skychain.connect(manufacturer).registerPart(partNumber, serialNumber);
});

after(async () => {
  await connection?.close();
});

test("only the admin manages roles; deployment rejects a zero admin", async () => {
  const role = await skychain.MANUFACTURER_ROLE();
  assert.equal(await skychain.hasRole(await skychain.DEFAULT_ADMIN_ROLE(), admin.address), true);
  assert.equal(await skychain.hasRole(role, admin.address), false);
  await assert.rejects(skychain.connect(outsider).grantRole(role, outsider.address), /AccessControlUnauthorizedAccount/);
  await skychain.revokeRole(role, manufacturer.address);
  await assert.rejects(skychain.connect(manufacturer).registerPart("OTHER", "1"), /AccessControlUnauthorizedAccount/);
  await assert.rejects(ethers.deployContract("SkyChain", [ethers.ZeroAddress]), /Zero admin/);
});

test("registration stores the identifiers, manufacturer, custodian, time, and initial status", async () => {
  const part = await skychain.getPart(partId);
  assert.equal(part.partNumber, partNumber);
  assert.equal(part.serialNumber, serialNumber);
  assert.equal(part.manufacturer, manufacturer.address);
  assert.equal(part.custodian, manufacturer.address);
  assert.equal(part.status, Registered);
  assert.ok(part.registeredAt > 0n);
  assert.equal(part.certificateHash, ethers.ZeroHash);
  assert.equal(await skychain.verifyCertificate(partId, ethers.ZeroHash), false);
  const logs = await skychain.queryFilter(skychain.filters.PartRegistered(partId));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].args.manufacturer, manufacturer.address);
});

test("part keys use ABI encoding and keep identifier boundaries distinct", async () => {
  const expected = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["string", "string"], [partNumber, serialNumber]));
  assert.equal(partId, expected);
  assert.notEqual(await skychain.getPartId("AB", "C"), await skychain.getPartId("A", "BC"));
});

test("registration rejects unauthorized callers, duplicates, and empty identifiers", async () => {
  await assert.rejects(skychain.connect(outsider).registerPart("OTHER", "1"), /AccessControlUnauthorizedAccount/);
  await assert.rejects(skychain.connect(manufacturer).registerPart(partNumber, serialNumber), /Part already registered/);
  await assert.rejects(skychain.connect(manufacturer).registerPart("", "1"), /Empty identifier/);
  await assert.rejects(skychain.connect(manufacturer).registerPart("OTHER", ""), /Empty identifier/);
});

test("certificate verification detects a one-byte change in the file", async () => {
  await skychain.connect(issuer).recordCertificate(partId, certificateHash, certificateCID);
  const bytes = await readFile(new URL("./fixtures/release-certificate.txt", import.meta.url));
  bytes[0] ^= 1;
  assert.equal(await skychain.verifyCertificate(partId, certificateHash), true);
  assert.equal(await skychain.verifyCertificate(partId, ethers.sha256(bytes)), false);
  const part = await skychain.getPart(partId);
  assert.equal(part.certificateHash, certificateHash);
  assert.equal(part.certificateCID, certificateCID);
});

test("certificate writes require an issuer, a nonzero hash, and a CID", async () => {
  await assert.rejects(skychain.connect(manufacturer).recordCertificate(partId, certificateHash, certificateCID), /AccessControlUnauthorizedAccount/);
  await assert.rejects(skychain.connect(issuer).recordCertificate(partId, ethers.ZeroHash, certificateCID), /Empty certificate hash/);
  await assert.rejects(skychain.connect(issuer).recordCertificate(partId, certificateHash, ""), /Empty certificate CID/);
});

test("custody changes only when the named recipient accepts", async () => {
  await skychain.connect(manufacturer).initiateTransfer(partId, recipient.address);
  assert.equal((await skychain.getPart(partId)).custodian, manufacturer.address);
  assert.equal(await skychain.pendingRecipient(partId), recipient.address);
  await assert.rejects(skychain.connect(outsider).acceptTransfer(partId), /Not pending recipient/);
  const receipt = await (await skychain.connect(recipient).acceptTransfer(partId)).wait();
  const event = skychain.interface.parseLog(receipt.logs[0]);
  assert.equal(event.name, "TransferAccepted");
  assert.equal(event.args.from, manufacturer.address);
  assert.equal(event.args.to, recipient.address);
  assert.equal((await skychain.getPart(partId)).custodian, recipient.address);
  assert.equal(await skychain.pendingRecipient(partId), ethers.ZeroAddress);
  await assert.rejects(skychain.connect(recipient).acceptTransfer(partId), /Not pending recipient/);
  await assert.rejects(skychain.connect(manufacturer).initiateTransfer(partId, outsider.address), /Not current custodian/);
  await skychain.connect(recipient).initiateTransfer(partId, outsider.address);
});

test("transfer requests reject a non-custodian, zero address, self, and a second request", async () => {
  await assert.rejects(skychain.connect(outsider).initiateTransfer(partId, recipient.address), /Not current custodian/);
  await assert.rejects(skychain.connect(manufacturer).initiateTransfer(partId, ethers.ZeroAddress), /Invalid recipient/);
  await assert.rejects(skychain.connect(manufacturer).initiateTransfer(partId, manufacturer.address), /Invalid recipient/);
  await assert.rejects(skychain.connect(recipient).acceptTransfer(partId), /Not pending recipient/);
  await skychain.connect(manufacturer).initiateTransfer(partId, recipient.address);
  await assert.rejects(skychain.connect(manufacturer).initiateTransfer(partId, outsider.address), /Transfer already pending/);
});

test("only the custodian cancels; a cancelled request cannot be accepted", async () => {
  await assert.rejects(skychain.connect(manufacturer).cancelTransfer(partId), /No pending transfer/);
  await skychain.connect(manufacturer).initiateTransfer(partId, recipient.address);
  await assert.rejects(skychain.connect(outsider).cancelTransfer(partId), /Not current custodian/);
  await skychain.connect(manufacturer).cancelTransfer(partId);
  assert.equal(await skychain.pendingRecipient(partId), ethers.ZeroAddress);
  await assert.rejects(skychain.connect(recipient).acceptTransfer(partId), /Not pending recipient/);
  await skychain.connect(manufacturer).initiateTransfer(partId, outsider.address);
});

test("a certificate change cancels pending consent and preserves both certificate events", async () => {
  await skychain.connect(issuer).recordCertificate(partId, certificateHash, certificateCID);
  await skychain.connect(manufacturer).initiateTransfer(partId, recipient.address);
  const newHash = ethers.sha256(ethers.toUtf8Bytes("Replacement demo certificate"));
  await skychain.connect(issuer).recordCertificate(partId, newHash, "replacement-demo-cid");
  assert.equal(await skychain.pendingRecipient(partId), ethers.ZeroAddress);
  assert.equal(await skychain.verifyCertificate(partId, certificateHash), false);
  assert.equal(await skychain.verifyCertificate(partId, newHash), true);
  await assert.rejects(skychain.connect(recipient).acceptTransfer(partId), /Not pending recipient/);
  const history = await skychain.queryFilter(skychain.filters.CertificateRecorded(partId));
  assert.equal(history.length, 2);
  assert.equal(history[0].args.certificateHash, certificateHash);
  assert.equal(history[1].args.certificateHash, newHash);
});

test("status writes require both the repair role and custody", async () => {
  await assert.rejects(skychain.connect(manufacturer).updateStatus(partId, Serviceable), /AccessControlUnauthorizedAccount/);
  await assert.rejects(skychain.connect(repairStation).updateStatus(partId, Serviceable), /Not current custodian/);
  await skychain.connect(manufacturer).initiateTransfer(partId, repairStation.address);
  await skychain.connect(repairStation).acceptTransfer(partId);
  await skychain.connect(repairStation).updateStatus(partId, UnderRepair);
  await skychain.connect(repairStation).updateStatus(partId, Serviceable);
  assert.equal((await skychain.getPart(partId)).status, Serviceable);
  await assert.rejects(skychain.connect(repairStation).updateStatus(partId, Registered), /Invalid status change/);
  await assert.rejects(skychain.connect(repairStation).updateStatus(partId, Serviceable), /Invalid status change/);
  await assert.rejects(skychain.connect(repairStation).updateStatus(partId, 4));
});

test("retirement cancels pending custody and blocks later changes", async () => {
  await skychain.connect(manufacturer).initiateTransfer(partId, repairStation.address);
  await skychain.connect(repairStation).acceptTransfer(partId);
  await skychain.connect(repairStation).initiateTransfer(partId, recipient.address);
  await skychain.connect(repairStation).updateStatus(partId, Retired);
  assert.equal((await skychain.getPart(partId)).status, Retired);
  assert.equal(await skychain.pendingRecipient(partId), ethers.ZeroAddress);
  await assert.rejects(skychain.connect(recipient).acceptTransfer(partId), /Not pending recipient/);
  await assert.rejects(skychain.connect(repairStation).initiateTransfer(partId, recipient.address), /Part retired/);
  await assert.rejects(skychain.connect(repairStation).updateStatus(partId, Serviceable), /Part retired/);
  await assert.rejects(skychain.connect(issuer).recordCertificate(partId, certificateHash, certificateCID), /Part retired/);
});

test("all record operations reject an unknown part", async () => {
  const missing = ethers.ZeroHash;
  for (const call of [
    () => skychain.getPart(missing),
    () => skychain.verifyCertificate(missing, certificateHash),
    () => skychain.connect(issuer).recordCertificate(missing, certificateHash, certificateCID),
    () => skychain.connect(repairStation).updateStatus(missing, Serviceable),
    () => skychain.connect(manufacturer).initiateTransfer(missing, recipient.address),
    () => skychain.connect(recipient).acceptTransfer(missing),
    () => skychain.connect(manufacturer).cancelTransfer(missing),
  ]) {
    await assert.rejects(call, /Unknown part/);
  }
});
