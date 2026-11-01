# SkyChain

**Blockchain-Based Aircraft Parts Provenance System**

CSE 540, Fall B 2026 - Group 16

SkyChain records the history of aircraft parts as they move between companies. Each record includes the part number, serial number, manufacturer, current custodian, certificate hash, and status. A sender starts a custody transfer. The recipient must accept it before custody changes.

This repository contains the **Smart Contract Design assignment draft**. The Solidity contracts compile and run in local tests. The web app, live IPFS uploads, and Polygon Amoy deployment are future project work. A recorded status is a participant's claim; it is not proof of FAA approval or physical condition.

## Team

| Member | Main responsibility in the proposal |
| --- | --- |
| Parva Vasudevbhai Sheta | Smart contract development |
| Surya Chaitanya Buse | Blockchain integration, roles, deployment, and IPFS |
| Rimpa Nandi | Web interface |
| Saniya Mujahid Mulla | Testing and documentation |

## Repository structure

```text
contracts/
  ISkyChain.sol                  Public data types, events, and function signatures
  SkyChain.sol                   Contract draft with access checks and comments
test/
  SkyChain.test.js               Local contract tests
  fixtures/release-certificate.txt   Simulated certificate; no real aviation data
hardhat.config.js                Compiler and local test settings
package.json                    Dependencies and commands
package-lock.json               Exact dependency versions
submission.txt                  Public repository link for the assignment
```

## System design

1. **Web interface (planned):** ethers.js and MetaMask let each participant use its own wallet.
2. **Contract (this draft):** Solidity stores part records and enforces roles with OpenZeppelin `AccessControl`. Transaction events preserve the history of registration, certificates, status changes, and custody transfers.
3. **File storage (planned):** certificates live on IPFS. The contract stores the CID and SHA-256 digest of the raw file bytes. A client downloads a file, computes its SHA-256 digest, and compares it with the recorded digest.

The part key is `keccak256(abi.encode(partNumber, serialNumber))`. Both strings are case-sensitive. The contract keeps their exact bytes; clients must use the same spelling and spacing when they look up a part. The record's `custodian` is the current holder, not proof of legal ownership. Events provide history; `getPart` returns the latest state.

## Roles and draft rules

| Actor | Allowed actions |
| --- | --- |
| Consortium admin | Grant and revoke roles with inherited `grantRole` and `revokeRole` |
| Manufacturer | Register a unique part and become its first custodian |
| Certificate issuer | Add or replace the certificate hash and CID for a part that is not retired |
| Repair station | Change status only while it is the current custodian |
| Current custodian | Start or cancel a transfer |
| Named recipient | Accept a pending transfer |
| Any reader | Read a part, inspect events, or compare a certificate hash |

The constructor takes one nonzero admin address. The admin does not receive the other roles by default. Each role is independent. Issuers are trusted across the consortium; they do not need custody to record a certificate. Custodians and recipients do not need a role merely to hold or transfer a part.

The proposal does not define a full status policy. This draft uses these values:

| Value | Status | Draft meaning |
| --- | --- | --- |
| `0` | `Registered` | Initial record; no condition claim |
| `1` | `Serviceable` | Reported ready for use by the repair station |
| `2` | `UnderRepair` | Reported in repair |
| `3` | `Retired` | Final state; no later status change, certificate change, or custody transfer |

A repair station that holds a part can select any different status except `Registered`. Retirement is final. Transfer of a part in `Registered` or `UnderRepair` state is allowed; a transfer does not approve it for use. Certificate recording and status are separate claims. A status change does not require a certificate in this draft.

Only one transfer can be pending. Zero-address and self-transfers are rejected. A certificate or status change cancels any pending transfer so the recipient must give fresh consent to the changed record. The current custodian can also cancel a transfer. The former custodian loses transfer rights after acceptance. There is no record deletion or admin custody override.

Customs is named in the problem statement, but its actors and actions are not defined. Customs rules are deferred until the team defines them. These status and permission choices are draft decisions for team review.

## Contract interface

The complete signatures, record fields, and events are in [`contracts/ISkyChain.sol`](contracts/ISkyChain.sol). Major functions have Solidity documentation comments.

| Function | Purpose |
| --- | --- |
| `getPartId(string partNumber, string serialNumber)` | Compute the unique part key |
| `registerPart(string partNumber, string serialNumber)` | Register a part; return its key |
| `recordCertificate(bytes32 partId, bytes32 certificateHash, string certificateCID)` | Record a file digest and IPFS CID |
| `updateStatus(bytes32 partId, PartStatus newStatus)` | Update the held part's status |
| `initiateTransfer(bytes32 partId, address recipient)` | Start a custody transfer |
| `acceptTransfer(bytes32 partId)` | Accept custody as the named recipient |
| `cancelTransfer(bytes32 partId)` | Cancel the current transfer |
| `getPart(bytes32 partId)` | Read the latest record |
| `pendingRecipient(bytes32 partId)` | Read the recipient; zero address means no pending transfer |
| `verifyCertificate(bytes32 partId, bytes32 candidateHash)` | Compare a digest with the latest recorded certificate |

Events: `PartRegistered`, `CertificateRecorded`, `StatusUpdated`, `TransferStarted`, `TransferAccepted`, and `TransferCancelled`. OpenZeppelin also emits role-management events. Clients can filter these events by `partId` to build a history.

## Dependencies and local setup

Use **Node.js 24 LTS**, npm, and Git. The contract uses OpenZeppelin Contracts **5.4.0**. Local checks use Hardhat **3.21.2**, its ethers plugin **4.2.2**, ethers.js **6.17.0**, and Node's built-in test runner. The compiler is Solidity **0.8.28**, with optimizer enabled at 200 runs and EVM target `paris`.

```sh
git clone https://github.com/Parva101/skychain.git
cd skychain
npm ci
npm test
```

To compile only:

```sh
npm run compile
```

The first compile needs internet access to download the Solidity compiler. Tests deploy to a temporary local blockchain. They need no wallet, private key, test tokens, or live RPC service.

Tests cover role grants and revocation, registration, duplicate and invalid inputs, certificate changes, a one-byte file tamper, transfer consent, cancellation, status permissions, final retirement, and unknown records. The fixture uses simulated data and a dummy CID label; it is not a live IPFS file.

**Known tooling issue:** `npm audit` reports four high-severity entries caused by Hardhat's Zod 3 dependency. The [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) concerns memory use when validating large, untrusted collections. Its patched version is Zod 4.6.6; this Hardhat release requires Zod 3. Do not force an incompatible major-version override. Keep this tooling for trusted local project inputs and check for an upstream fix before exposing a development service. `npm audit --omit=dev` reports no production dependency findings for this draft. Zod is not part of the deployed Solidity code.

## Use and deploy with Remix

1. Open [Remix](https://remix.ethereum.org/). Create a workspace and upload the `contracts` folder, keeping both Solidity files together.
2. In the Remix copy of `SkyChain.sol`, pin the dependency by changing the OpenZeppelin import to:

   ```solidity
   import {AccessControl} from "@openzeppelin/contracts@5.4.0/access/AccessControl.sol";
   ```

   Remix can resolve a versioned npm import directly. The repository uses the normal npm path with the same version pinned in `package-lock.json`.
3. In **Solidity Compiler**, select **0.8.28**, enable optimization with **200** runs, and set the EVM version to **paris**. Compile `SkyChain.sol`.
4. In **Deploy & Run Transactions**, first use a **Remix VM** environment. Select `SkyChain`, enter the consortium admin wallet address as the constructor argument, and deploy.
5. With the admin account selected, read `MANUFACTURER_ROLE`, `ISSUER_ROLE`, and `REPAIR_STATION_ROLE`. Use `grantRole(role, account)` to assign each role to a test account.
6. As the manufacturer, call `registerPart("SC-PUMP-100", "SN-0001")`. Call `getPartId` with those same strings and save the returned `bytes32` key.
7. As the issuer, call `recordCertificate` with that key, the raw file's SHA-256 digest as `0x` plus 64 hexadecimal characters, and the CID from an IPFS upload. The `ipfs://` prefix is not needed in the stored CID.
8. As the custodian, call `initiateTransfer(partId, recipientAddress)`. Switch to the recipient account and call `acceptTransfer(partId)`. Use `getPart` to check custody.
9. To update status, transfer custody to an account with `REPAIR_STATION_ROLE`, then call `updateStatus(partId, statusValue)` from that account.

To compute a certificate digest in PowerShell:

```powershell
$digest = (Get-FileHash -Algorithm SHA256 -LiteralPath 'certificate.pdf').Hash.ToLowerInvariant()
"0x$digest"
```

Hash the exact file bytes. Do not hash a filename, CID, or decoded text. `verifyCertificate` compares digests; it does not download or hash a file for you. A matching digest proves a match with the recorded bytes, not the truth of the certificate.

For a later **Polygon Amoy** deployment, add Amoy to MetaMask, obtain test POL, select Remix's browser wallet provider, and repeat deployment with the chosen admin address. Check the network in MetaMask before you confirm.

| Amoy setting | Value |
| --- | --- |
| Chain ID | `80002` |
| Currency | `POL` |
| RPC URL | `https://polygon-amoy.drpc.org` |
| Explorer | `https://amoy.polygonscan.com/` |

Network settings come from the [Polygon RPC documentation](https://docs.polygon.technology/pos/reference/rpc-endpoints/). See also the [Polygon test faucet](https://faucet.polygon.technology/), [OpenZeppelin access-control guide](https://docs.openzeppelin.com/contracts/5.x/access-control), [Hardhat ethers plugin](https://hardhat.org/docs/plugins/hardhat-ethers), and [Remix import guide](https://remix-ide.readthedocs.io/en/latest/import.html).

**Deployment status:** no public testnet contract has been deployed for this draft. No live contract address is claimed.

## Limits and next project work

- Build the web interface and wallet flows.
- Add IPFS upload, retrieval, and pinning. The contract currently requires a nonempty CID but does not validate its encoding, availability, or match with the submitted digest.
- Review the draft status and customs rules as a team.
- Deploy to Amoy and measure real gas cost and latency per operation.
- Review security before use beyond the course project. Admin role changes and issuer claims are trusted. The inherited admin role can be renounced; losing every admin would prevent future role grants.

All contract data is public. Use simulated parts and certificates. This design has no physical-part check, FAA integration, privacy layer, or production security audit. The contract never transfers tokens or holds payments.

## Assignment submission

Upload [`submission.txt`](submission.txt) to the course assignment. It contains only the public repository link:

```text
https://github.com/Parva101/skychain
```

The required README, draft contract, function interfaces, and high-level comments are in this repository. Source assignment files and team PDFs stay local and are not needed for this submission.
