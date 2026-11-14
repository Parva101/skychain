# SkyChain Interim Demo: Team Brief for Slides

CSE 540, Fall B 2026, Group 16. Prepared Nov 12, 2026.
Repo: https://github.com/Parva101/skychain

This file has everything needed to build the interim demo slides and plan the recording. Items marked **[UPDATE]** are things the team should confirm or fill in.

---

## 1. Assignment requirements (from Canvas)

- **Due:** Sunday, Nov 15, 11:59pm. 15 points.
- **Format:** a 5-minute Zoom recording (ASU Zoom). Acceptable range is **4.5 to 5.5 minutes**.
- **Submit:** one `.txt` file on Canvas containing the **recording link and passcode**. Do not upload the video.
- **Focus on completed work.** Partial or in-progress work is acceptable. Extra elements are allowed if useful.

**What the presentation must cover**

1. Current project status: what is implemented and what is in progress.
2. Contract and stakeholder interactions: a demo of working components or a partial flow; the stakeholder interactions that are implemented; a brief note on interactions still planned.
3. High-level code walkthrough: relevant code from GitHub; key logs or outputs only if something isn't clear from the demo.

**Rubric (3.75 points each)**

| Criterion | "Meets" level |
|---|---|
| Project status explanation | Clearly identifies implemented components, work in progress and remaining milestones, with specific examples |
| Working demonstration | Shows functional components and at least one clear stakeholder or user interaction or workflow |
| Code walkthrough (high level) | References relevant files, functions and smart contract logic, and explains how components interact |
| Clarity, timing, professionalism | Clear, organized presentation within 4.5 to 5.5 minutes |

Lower tiers: a demo that fails on screen or shows no system behavior scores 1.25; a presentation over time, or with audio or video that gets in the way, also scores 1.25.

---

## 2. Project summary (for the opening slide)

**SkyChain: Blockchain-Based Aircraft Parts Provenance System**

- **Problem:** Aircraft parts pass through manufacturers, distributors, airlines and repair stations, and approval is shown by paperwork such as the FAA Form 8130-3 release certificate. Paper and PDF certificates can be altered or copied, and the FAA lists altered paperwork as a sign of suspected unapproved parts.
- **Idea:** record each part's registration, certificate fingerprint (hash), custody transfers and status on a shared ledger every participant can check.
- **Why blockchain:** the chain of custody spans companies and countries with limited mutual trust and no neutral party hosting records. An append-only ledger can't be quietly rewritten, and smart contracts enforce rules such as "only the current holder can transfer a part."
- **Safety note (worth saying aloud):** a recorded status is a participant's claim. It is not proof of FAA approval or physical condition.

**Team and roles (from the team contract)**

| Member | Responsibility |
|---|---|
| Parva Vasudevbhai Sheta | Smart contract development |
| Surya Chaitanya Buse | Role-based access control, Polygon Amoy deployment, IPFS integration |
| Rimpa Nandi | Frontend development |
| Saniya Mujahid Mulla | Testing, documentation, final report and demo |

---

## 3. Architecture (for one slide)

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Web UI, ethers.js, MetaMask | Register parts, transfer custody, verify certificates |
| On-chain | Solidity contract, OpenZeppelin AccessControl | One record per part, role-based permissions |
| Off-chain | IPFS | Stores the release certificate files |
| Network | EVM, Polygon Amoy testnet | Deployment target |

**Verification idea:** the contract stores a SHA-256 hash of the certificate (plus its IPFS CID). Anyone can hash the file again and compare it with the on-chain hash using `verifyCertificate`.

---

## 4. Status: implemented, in progress, remaining

Use this three-part structure in the recording. The rubric rewards it.

### Implemented (tested in Remix)

- Smart contract `SkyChain.sol` plus interface `ISkyChain.sol` in the GitHub repo (design milestone Nov 1).
- Compiled with Solidity 0.8.28, optimizer 200 runs, EVM `paris`, OpenZeppelin Contracts 5.4.0.
- Role-based access control: admin, manufacturer, certificate issuer, repair station.
- Part lifecycle: register, record certificate, start / accept / cancel transfer, update status, verify certificate.
- Full end-to-end flow run across four roles on Remix's built-in test network.
- Certificate tamper test: one changed character produces a different hash and verification returns false.
- Negative tests: a non-custodian transfer and a wrong-role call are both rejected.
- Gas cost per operation measured (Remix VM). The gas table, tamper hashes, and negative-test results are in the README. The two certificate files are in `samples/`.

### In progress

- **Polygon Amoy deployment.** MetaMask is installed, the Amoy network is added, and four accounts (admin, manufacturer, issuer, repair station) are created. The blocker is test POL: the Alchemy and Quicknode faucets both rejected a new wallet because they require real ETH on Ethereum mainnet. **[UPDATE: result of trying the Polygon faucet linked in the course Project Resources slides, https://faucet.polygon.technology/, or a teammate sending POL.]**

### Remaining

- Deploy to Amoy and re-run the flow there.
- Real IPFS upload (the demo currently uses a placeholder CID).
- Web frontend with ethers.js and MetaMask. A demo viewer of the Remix results is in `frontend/` (no wallet and no transactions). Use it as an extra screen; keep Remix as the live contract demo.
- Re-measure gas on Amoy; final report and final demo.
- Milestones listed in the proposal: Nov 15 (this interim demo) and Dec 4 (final).

---

## 5. The contract in brief (for the code walkthrough)

File: `contracts/SkyChain.sol` (implements `contracts/ISkyChain.sol`). Roles come from OpenZeppelin `AccessControl`.

**Roles**

| Role | What it can do |
|---|---|
| Consortium admin | Grants and revokes the roles below |
| Manufacturer | Registers a part and becomes its first custodian |
| Certificate issuer | Records or replaces a part's certificate hash and CID |
| Repair station | Updates status of a part it currently holds |
| Current custodian | Starts or cancels a transfer (no special role needed) |
| Named recipient | Accepts a pending transfer |
| Anyone | Reads a part and verifies a certificate |

**Part record:** part number, serial number, manufacturer, custodian, certificate hash, certificate CID, status, registered-at timestamp. The key is `keccak256(abi.encode(partNumber, serialNumber))`.

**Status values:** 0 Registered, 1 Serviceable, 2 UnderRepair, 3 Retired (final).

**Functions to point at, and what each one shows**

| Function | Caller | What it demonstrates |
|---|---|---|
| `registerPart` | Manufacturer | Creates the record; rejects duplicates |
| `recordCertificate` | Issuer | Stores hash and CID; cancels a pending transfer |
| `verifyCertificate` | Anyone | Compares a candidate hash with the on-chain hash |
| `initiateTransfer` | Current custodian | Names a recipient; only one pending transfer per part |
| `acceptTransfer` | Named recipient | Custody changes only now, when the recipient agrees |
| `updateStatus` | Repair station that is the custodian | Status change; Retired is final; cancels a pending transfer |
| `cancelTransfer` | Current custodian | Withdraws a pending transfer |
| `getPart`, `getPartId`, `pendingRecipient` | Anyone | Read functions |

**Design points worth one sentence each**

- Two-step transfer: the sender starts it and the recipient must accept.
- Recording a new certificate or changing status cancels any pending transfer, so the recipient agrees to the final record.
- The status is a claim by the repair station, not proof of FAA approval.

---

## 6. Demo flow (what to show on screen)

Environment: **Remix IDE, Remix VM** (built-in test network). Use the four default test accounts.

Optional extra screen: `frontend/index.html`. From the repo root, run `python -m http.server 8080` and open `http://localhost:8080/frontend/`. The Tested flow tab replays the calls below and hashes the two certificate files in the browser. It does not send a transaction. Show it for the status summary or the tamper check, and keep the Remix calls as the live demo.

| Account | Address (start) | Role in demo |
|---|---|---|
| Account 1 | `0x5B38...eddC4` | Admin (passed to the constructor) |
| Account 2 | `0xAb84...35cb2` | Manufacturer |
| Account 3 | `0x4B20...C02db` | Certificate issuer |
| Account 4 | `0x7873...cabaB` | Repair station and transfer recipient |

**Test data**

- Part number `"PN-7421"`, serial number `"SN-0001"`
- Certificate file: `samples/cert-PN-7421-SN-0001.txt` (one line, ends with a line feed)
- Original SHA-256: `0x857ec59f36614046f94bc4cf54035871d3780fc38e1afd1e9e62ad2f5d1535c1`
- Tampered file: `samples/cert-tampered.txt` (`SN-0001` changed to `SN-0002`, one byte)
- Tampered SHA-256: `0x025e7337341b322e03b6a6ca78ce7ed1727da09d21b4918fcfa3358f17e99601`
- Placeholder CID: `"PLACEHOLDER-CID-PN-7421-SN-0001"`

Use the files in `samples/` as they are. Recreating them in an editor can change the line ending and the hash. To recompute:

```bash
node scripts/skychain-tools.js hash samples/cert-PN-7421-SN-0001.txt
node scripts/skychain-tools.js compare samples/cert-PN-7421-SN-0001.txt samples/cert-tampered.txt
```

**Step-by-step script**

1. **Deploy** `SkyChain` with Account 1's address as the `admin` constructor argument.
2. **Grant roles** (as Account 1) with `grantRole(roleHash, address)`: get each hash by clicking Call on `MANUFACTURER_ROLE`, `ISSUER_ROLE` and `REPAIR_STATION_ROLE`; grant to Accounts 2, 3 and 4. Confirm with `hasRole` (returns true).
3. **Register** (as Account 2): `registerPart("PN-7421", "SN-0001")`.
4. **Get the part ID:** `getPartId("PN-7421", "SN-0001")`, then `getPart(partId)`. Shows Account 2 as manufacturer and custodian, status 0, all-zero certificate hash.
5. **Record certificate** (as Account 3): `recordCertificate(partId, 0x857e...35c1, "PLACEHOLDER-CID-PN-7421-SN-0001")`. `getPart` now shows the hash and CID.
6. **Verify, good file:** `verifyCertificate(partId, 0x857e...35c1)` returns **true**.
7. **Verify, tampered file:** paste `0x025e7337341b322e03b6a6ca78ce7ed1727da09d21b4918fcfa3358f17e99601`; returns **false**.
8. **Start transfer** (as Account 2): `initiateTransfer(partId, <Account 4 address>)`. `pendingRecipient(partId)` returns Account 4.
9. **Accept transfer** (as Account 4): `acceptTransfer(partId)`. `getPart` now shows Account 4 as custodian; manufacturer is still Account 2.
10. **Update status** (as Account 4): `updateStatus(partId, 1)`. `getPart` shows status 1 (Serviceable).
11. **Rejection 1, non-owner transfer** (as Account 2): `initiateTransfer(partId, <Account 3 address>)` reverts with **"Not current custodian"**.
12. **Rejection 2, wrong role** (as Account 2): `recordCertificate(partId, 0x857e...35c1, "FAKE-CID")` reverts with **`AccessControlUnauthorizedAccount`**.

Things to remember: the status argument is a number (0 to 3); strings need quotation marks; every `bytes32` needs `0x` plus 64 hex characters; the account must be switched in the Account dropdown before each step.

**Suggestion: keep the recording tight.** Steps 3 to 12 are the core. Steps 1 and 2 can be done before recording, or shown quickly.

---

## 7. Test evidence collected so far

**Gas per operation (Remix VM)**

| Operation | Caller | Gas used |
|---|---|---|
| `grantRole` (each of 3) | Admin | 51,440 |
| `registerPart` | Manufacturer | 148,738 |
| `recordCertificate` | Issuer | 79,872 |
| `initiateTransfer` | Custodian | 53,309 |
| `acceptTransfer` | Recipient | 33,886 |
| `updateStatus` | Repair station | 56,028 |

Observations: `registerPart` costs the most because it writes the full record to storage for the first time; `recordCertificate` costs about half as much (a hash and a string); the custody handoff (`initiateTransfer` plus `acceptTransfer`) is cheap at roughly 87,000 gas. These are Remix VM figures and should be re-measured on Amoy for the final report.

**Tamper test:** the original certificate verifies as true; a copy with one character changed (`SN-0001` to `SN-0002`) hashes to a completely different value and verifies as false.

**Negative tests (all rejected as expected)**

| Attempt | Result |
|---|---|
| Admin (Account 1) registers a part without the manufacturer role | `AccessControlUnauthorizedAccount`, needed role is Manufacturer |
| Manufacturer (Account 2) transfers a part it no longer holds | Reverted: "Not current custodian" |
| Manufacturer (Account 2) records a certificate without the issuer role | `AccessControlUnauthorizedAccount`, needed role is Issuer |

**Screenshots to capture for the slides:** successful `registerPart`; `getPart` output at several points; `verifyCertificate` true and false; the two rejected calls with their error messages; the gas table.

---

## 8. Suggested slide outline and 5-minute timing

This is a suggestion, not a requirement.

| Time | Slide or segment | Content |
|---|---|---|
| 0:00 to 0:45 | Status | Problem in one sentence; architecture; **implemented / in progress / remaining** with one example each |
| 0:45 to 3:15 | Live demo | Steps 3 to 12 above, narrating who the actor is and what the contract is enforcing |
| 3:15 to 4:30 | Code walkthrough | Open GitHub; `SkyChain.sol`: `registerPart`, `initiateTransfer` / `acceptTransfer`, `verifyCertificate`, and the AccessControl role checks; tie each to what was just shown |
| 4:30 to 5:00 | Remaining work | Amoy deployment, IPFS, frontend, Dec 4 final; interactions still planned |

**Possible split among four people:** status, demo, code walkthrough, wrap-up. Alternatively one person narrates and the rest prepare slides.

**Recording tips from the assignment:** use a stable platform, keep background noise down, and review the recording (audio and visuals) before submitting.

---

## 9. Risks and how to avoid them

- **Remix test network resets on a page refresh.** The deployed contract and all roles are lost. Do the deployment, setup and recording in one sitting, and don't refresh the tab. If it resets, redeploy and redo steps 1 to 5.
- **Running the same part twice.** After step 9 the custodian is Account 4, so steps 8 to 10 won't work again on the same part. Register a new serial number (for example `"SN-0003"`) to repeat the flow.
- **A live failure during the recording** is penalized in the rubric. Rehearse the full flow before recording.
- **Timing.** Over 5.5 minutes drops the clarity score. Rehearse with a timer.
- **Don't edit `SkyChain.sol` before the demo.** The code shown on GitHub should match what was tested. If anyone changes it, re-test first.
- **Keep wallet secrets private.** Never share a MetaMask recovery phrase or private key, in chat or anywhere else.
- **Honest limitations to mention if asked:** the CID is a placeholder (no IPFS upload yet); gas was measured on the Remix VM, not Amoy; tests were run by hand in Remix, not with an automated test suite.

---

## 10. Open items for the team

1. **Amoy deployment:** can anyone claim test POL (course faucet, or a wallet with mainnet ETH history) and send some to the demo accounts?
2. **Who records the Zoom demo**, and does one person present or do we split by role?
3. **Internal deadline** before Sunday so the team can review the recording. **[UPDATE: Saturday evening?]**
4. **Repo:** the README now has the gas table, the tamper hashes, and the negative-test results, and `samples/` has both certificate files. Still open: whether to commit and push that update before the demo.
5. **Slides:** who builds them, and which sections (status, demo, code, remaining) go to whom.
