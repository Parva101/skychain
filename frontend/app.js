"use strict";

const ORIGINAL_TEXT = "SIMULATED FAA FORM 8130-3 | PN-7421 | SN-0001 | Approved for return to service\n";
const TAMPERED_TEXT = "SIMULATED FAA FORM 8130-3 | PN-7421 | SN-0002 | Approved for return to service\n";
const ORIGINAL_HASH = "0x857ec59f36614046f94bc4cf54035871d3780fc38e1afd1e9e62ad2f5d1535c1";
const TAMPERED_HASH = "0x025e7337341b322e03b6a6ca78ce7ed1727da09d21b4918fcfa3358f17e99601";
const PLACEHOLDER_CID = "PLACEHOLDER-CID-PN-7421-SN-0001";

const ACCOUNTS = {
  admin: "Account 1 · 0x5B38…eddC4",
  manufacturer: "Account 2 · 0xAb84…35cb2",
  issuer: "Account 3 · 0x4B20…C02db",
  repair: "Account 4 · 0x7873…cabaB",
};

const GAS = [
  ["grantRole (each of 3)", "Admin", "51,440"],
  ["registerPart", "Manufacturer", "148,738"],
  ["recordCertificate", "Issuer", "79,872"],
  ["initiateTransfer", "Custodian", "53,309"],
  ["acceptTransfer", "Recipient", "33,886"],
  ["updateStatus", "Repair station", "56,028"],
];

const registered = {
  partNumber: "PN-7421",
  serialNumber: "SN-0001",
  status: "0 · Registered",
  manufacturer: ACCOUNTS.manufacturer,
  custodian: ACCOUNTS.manufacturer,
  pending: "None",
  hash: "None recorded",
  cid: "—",
};

const certified = {
  ...registered,
  hash: ORIGINAL_HASH,
  cid: PLACEHOLDER_CID,
};

const pending = {
  ...certified,
  pending: ACCOUNTS.repair,
};

const accepted = {
  ...certified,
  custodian: ACCOUNTS.repair,
  pending: "None",
};

const serviceable = {
  ...accepted,
  status: "1 · Serviceable",
};

const STEPS = [
  {
    label: "Grant roles",
    actor: "Consortium admin",
    who: ACCOUNTS.admin,
    call: "grantRole(MANUFACTURER_ROLE, account2) and the issuer and repair-station roles",
    result: "hasRole returns true for the manufacturer, issuer, and repair station.",
    gas: "51,440 gas for each of the three grants.",
    tone: "ok",
    part: null,
  },
  {
    label: "Register part",
    actor: "Manufacturer",
    who: ACCOUNTS.manufacturer,
    call: 'registerPart("PN-7421", "SN-0001")',
    result: "The part record is created. The manufacturer is the first custodian.",
    gas: "148,738 gas.",
    tone: "ok",
    part: registered,
  },
  {
    label: "Record certificate",
    actor: "Certificate issuer",
    who: ACCOUNTS.issuer,
    call: "recordCertificate(partId, hash, CID)",
    result: "The original file hash and the placeholder CID are stored on the part.",
    gas: "79,872 gas.",
    tone: "ok",
    part: certified,
  },
  {
    label: "Verify original",
    actor: "Anyone",
    who: "Any account",
    call: "verifyCertificate(partId, originalHash)",
    result: "Returns true. The file matches the hash stored on the part.",
    gas: "View call. It was not included in the gas table.",
    tone: "view",
    part: certified,
    check: "original",
  },
  {
    label: "Verify tampered file",
    actor: "Anyone",
    who: "Any account",
    call: "verifyCertificate(partId, tamperedHash)",
    result: "Returns false. Changing SN-0001 to SN-0002 changes the hash.",
    gas: "View call. It was not included in the gas table.",
    tone: "view",
    part: certified,
    check: "tampered",
  },
  {
    label: "Start transfer",
    actor: "Current custodian",
    who: ACCOUNTS.manufacturer,
    call: "initiateTransfer(partId, account4)",
    result: "Account 4 is the pending recipient. Custody stays with Account 2 until acceptance.",
    gas: "53,309 gas.",
    tone: "ok",
    part: pending,
  },
  {
    label: "Accept transfer",
    actor: "Named recipient",
    who: ACCOUNTS.repair,
    call: "acceptTransfer(partId)",
    result: "Account 4 is now the custodian. The manufacturer is still Account 2.",
    gas: "33,886 gas. With initiateTransfer, the handoff is 87,195 gas.",
    tone: "ok",
    part: accepted,
  },
  {
    label: "Update status",
    actor: "Repair station",
    who: ACCOUNTS.repair,
    call: "updateStatus(partId, 1)",
    result: "Status is Serviceable. The repair station can update status because it holds the part.",
    gas: "56,028 gas.",
    tone: "ok",
    part: serviceable,
  },
  {
    label: "Rejected transfer",
    actor: "Manufacturer",
    who: ACCOUNTS.manufacturer,
    call: "initiateTransfer(partId, account3)",
    result: 'Reverted: "Not current custodian". Account 2 no longer holds the part.',
    gas: "The failed call was not included in the gas table.",
    tone: "revert",
    part: serviceable,
  },
  {
    label: "Rejected certificate",
    actor: "Manufacturer",
    who: ACCOUNTS.manufacturer,
    call: 'recordCertificate(partId, hash, "FAKE-CID")',
    result: "Reverted: AccessControlUnauthorizedAccount. The caller does not have the issuer role.",
    gas: "The failed call was not included in the gas table.",
    tone: "revert",
    part: serviceable,
  },
];

const encoder = new TextEncoder();

function rotr(x, n) {
  return (x >>> n) | (x << (32 - n));
}

function sha256Hex(bytes) {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const bitLen = bytes.length * 8;
  const withOne = bytes.length + 1;
  const padLen = (withOne % 64) <= 56 ? 56 - (withOne % 64) : 56 + 64 - (withOne % 64);
  const buf = new Uint8Array(bytes.length + 1 + padLen + 8);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  const lenPos = buf.length - 8;
  view.setUint32(lenPos, Math.floor(bitLen / 0x100000000));
  view.setUint32(lenPos + 4, bitLen >>> 0);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let i = 0; i < buf.length; i += 64) {
    for (let t = 0; t < 16; t += 1) w[t] = view.getUint32(i + t * 4);
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let t = 0; t < 64; t += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[t] + w[t]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return "0x" + [h0, h1, h2, h3, h4, h5, h6, h7].map((word) => word.toString(16).padStart(8, "0")).join("");
}

function hashText(text) {
  return sha256Hex(encoder.encode(text));
}

const originalBytes = encoder.encode(ORIGINAL_TEXT);
const tamperedBytes = encoder.encode(TAMPERED_TEXT);

let stepIndex = 1;

const tabStatus = document.getElementById("tab-status");
const tabFlow = document.getElementById("tab-flow");
const viewStatus = document.getElementById("view-status");
const viewFlow = document.getElementById("view-flow");
const stepList = document.getElementById("step-list");
const partFields = document.getElementById("part-fields");
const outcome = document.getElementById("outcome");
const verifyResult = document.getElementById("verify-result");

function showView(name) {
  const status = name === "status";
  viewStatus.hidden = !status;
  viewFlow.hidden = status;
  tabStatus.setAttribute("aria-pressed", String(status));
  tabFlow.setAttribute("aria-pressed", String(!status));
}

function field(label, value, extraClass) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  if (extraClass) dd.className = extraClass;
  partFields.append(dt, dd);
}

function renderPart(part) {
  partFields.replaceChildren();
  if (!part) {
    field("Part", "No part registered yet");
    return;
  }
  field("Part number", part.partNumber);
  field("Serial number", part.serialNumber);
  field("Status", part.status);
  field("Manufacturer", part.manufacturer);
  field("Custodian", part.custodian);
  field("Pending transfer", part.pending);
  field("Certificate hash", part.hash, part.hash.startsWith("0x") ? "hash" : "");
  field("Certificate CID", part.cid);
}

function renderOutcome(step) {
  document.getElementById("outcome-who").textContent = step.who + " · " + step.actor;
  document.getElementById("outcome-call").textContent = step.call;
  document.getElementById("outcome-result").textContent = step.result;
  document.getElementById("outcome-gas").textContent = step.gas;
  outcome.classList.remove("ok", "revert", "view");
  outcome.classList.add(step.tone);
}

function renderSteps() {
  stepList.replaceChildren();
  STEPS.forEach((step, index) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "step-btn" + (index === stepIndex ? " current" : "");
    const title = document.createElement("strong");
    title.textContent = (index + 1) + ". " + step.label;
    button.append(title);
    button.addEventListener("click", () => goTo(index));
    li.append(button);
    stepList.append(li);
  });
}

function showVerification(name, bytes) {
  const hex = sha256Hex(bytes);
  const match = hex === ORIGINAL_HASH;
  verifyResult.className = "verify-result " + (match ? "match" : "nomatch");
  verifyResult.replaceChildren();

  const verdict = document.createElement("p");
  verdict.className = "verdict";
  verdict.textContent = match ? "MATCH" : "NO MATCH";

  const file = document.createElement("p");
  file.textContent = name + " · " + bytes.length + " bytes";

  const computed = document.createElement("p");
  computed.className = "mono";
  computed.textContent = "Computed  " + hex;

  const recorded = document.createElement("p");
  recorded.className = "mono";
  recorded.textContent = "Recorded  " + ORIGINAL_HASH;

  const note = document.createElement("p");
  if (match) {
    note.textContent = "verifyCertificate would return true for this hash.";
  } else if (hex === TAMPERED_HASH) {
    note.textContent = "This is the one-byte change, SN-0001 to SN-0002. verifyCertificate would return false.";
  } else {
    note.textContent = "This file is not the recorded certificate. A different line ending also changes the hash.";
  }

  verifyResult.append(verdict, file, computed, recorded, note);
}

function render() {
  const step = STEPS[stepIndex];
  renderSteps();
  renderPart(step.part);
  renderOutcome(step);
  document.getElementById("step-count").textContent = "Step " + (stepIndex + 1) + " of " + STEPS.length;
  document.getElementById("prev").disabled = stepIndex === 0;
  document.getElementById("next").disabled = stepIndex === STEPS.length - 1;
  if (step.check === "original") showVerification("samples/cert-PN-7421-SN-0001.txt", originalBytes);
  else if (step.check === "tampered") showVerification("samples/cert-tampered.txt", tamperedBytes);
  else resetVerify();
}

function resetVerify() {
  verifyResult.className = "verify-result idle";
  verifyResult.replaceChildren();
  const prompt = document.createElement("p");
  prompt.textContent = "Hash either sample, or choose a file, to compare it with the recorded certificate.";
  verifyResult.append(prompt);
}

function goTo(index) {
  stepIndex = index;
  render();
}

function fillStatus() {
  const done = [
    "SkyChain.sol and ISkyChain.sol, compiled with Solidity 0.8.28, optimizer 200, EVM paris.",
    "Full flow across four roles in Remix: register, certificate, transfer, accept, status.",
    "verifyCertificate returned true for the original hash and false after one changed byte.",
    'A transfer by the previous holder reverted with "Not current custodian".',
    "A certificate call without the issuer role reverted with AccessControlUnauthorizedAccount.",
  ];
  const progress = [
    "MetaMask is installed, Polygon Amoy is added, and four role accounts exist.",
    "Deployment is blocked on test POL. Alchemy and Quicknode rejected a new wallet because they require mainnet ETH history.",
  ];
  const remaining = [
    "Deploy the same contract to Amoy and run this flow there.",
    "Replace " + PLACEHOLDER_CID + " with a real IPFS CID.",
    "Build the ethers.js and MetaMask app. This page only replays the Remix results.",
    "Measure gas again on Amoy, then the final report and the December 4 demo.",
  ];
  fillList("done-list", done);
  fillList("progress-list", progress);
  fillList("remaining-list", remaining);

  const tbody = document.querySelector("#gas-table tbody");
  GAS.forEach(([op, caller, gas]) => {
    const row = document.createElement("tr");
    [op, caller, gas].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    tbody.append(row);
  });
  document.getElementById("gas-note").textContent =
    "registerPart is the largest write because it stores the full record for the first time. initiateTransfer plus acceptTransfer is 87,195 gas. Measure these again on Amoy for the final report.";
}

function fillList(id, items) {
  const list = document.getElementById(id);
  items.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    list.append(li);
  });
}

function selfCheck() {
  const empty = sha256Hex(new Uint8Array());
  const abc = hashText("abc");
  const original = hashText(ORIGINAL_TEXT);
  const tampered = hashText(TAMPERED_TEXT);
  const ok = empty === "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    && abc === "0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    && original === ORIGINAL_HASH
    && tampered === TAMPERED_HASH;
  if (!ok) {
    const banner = document.getElementById("banner");
    banner.textContent = "The page’s SHA-256 check failed its self-test. Do not use the certificate buttons in the recording.";
  }
  return ok;
}

tabStatus.addEventListener("click", () => showView("status"));
tabFlow.addEventListener("click", () => showView("flow"));
document.getElementById("prev").addEventListener("click", () => goTo(stepIndex - 1));
document.getElementById("next").addEventListener("click", () => goTo(stepIndex + 1));
document.getElementById("hash-original").addEventListener("click", () => {
  showVerification("samples/cert-PN-7421-SN-0001.txt", originalBytes);
});
document.getElementById("hash-tampered").addEventListener("click", () => {
  showVerification("samples/cert-tampered.txt", tamperedBytes);
});
document.getElementById("hash-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  showVerification(file.name, new Uint8Array(await file.arrayBuffer()));
});

document.addEventListener("keydown", (event) => {
  if (viewFlow.hidden) return;
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === "ArrowRight" && stepIndex < STEPS.length - 1) goTo(stepIndex + 1);
  if (event.key === "ArrowLeft" && stepIndex > 0) goTo(stepIndex - 1);
});

fillStatus();
selfCheck();
render();
