# SkyChain: Blockchain based Aircrafts Parts Provenance System

CSE 540
Fall B, 2026
Group 16

Skychain is our team's idea of a safer flight experience. Airplanes are one of the greatest inventions of mankinf and without a doubt, are the most extensive and part-heavy machines in the world. So our team proposes an idea of SkyChain, a system that records the history of aircraft parts as they move across lands and countries. EVery record has a part numbeer, serial number, manufacturer, current custodian, certificate hash and the status, Here, a sender starts a custory transfer and the recipient must accept it before the custory changes. 

Our repo right here has the Smart Contract Design. You may use Remix to compile and deploy the solidity contracts. Our future work includes web application, live IPFS uploads and Polygon Amoy deployment. A recorded status is a participant's claim and it is not proof of FAA approval or the physical condition. 

## Architecture

| Layer | Technology | Purpose | 
| --- | --- | --- |
| Frontend | Web UI, ethers.js, Metamask | Register the parts, transfer custody, verify certificates |
| On-chain | Solidity contract, OpenZeppelin AccessControl | One record per part, history, role based permissions |
| Off-chain | IPFS | Stores the release certificate files |
| Network | EVM - Polygon Amoy Testnet | Deployment target |

## Verification process

1. A manufacturer registers the part with the part number and serial number
2. An issuer uploads the release certificate to IPFS and then its gets a "CID"
3. Then the issuer records the certificate's hash and CID on chain by calling 'recordCertificate'
4. And then to verify, then anyone fetches the file from the IPFS and recomputes its SHA hash
5. Then they call 'verifyCertificate' with that hash - it returns true if the hash matches on the one on chain

## Repository Structure

```
 - .gitignore
 - README.md
 - contracts/
   - SkyChain.sol - Contract draft with access checks and comments
   - ISkyChain.sol - Data types, events and function signs 
```

## Roles
- Consortium admin: Grants and revokes roles
- Manufacturer: register a unique part and this person or the role becomes its first custodian
- Certificate Issuer: record or replace the certificate's hash and CID for a part tjat is not retired
- Repair Station: to change the status of a part @ the current custodiam
- Current custodian: Start or cancel a transfer
- named recipient: used to accept a pending transfer
- Reader: reads the part, inspects the events or maybe verify the hash of a certificate

## Status Values
| Value | Status | Meaning |
|---|---|---|
| 0 | Registered| initial record, no condition claim|
| 1 | Servicable| reported ready for use by repair station|
| 2 | UnderRepair| reported in repair |
| 3 | Retired | no mosre status changes / transfers - final state|

## Functions
- registerPart - manf. creates a part's record and becomes the first custodian
- recordCertificate - here the issuer attaches a certificate hash and IPFS CID to a part
- updateStatus - repair station that holds the part changes its status, and the Retired is final
- initiateTransfer - used to nominate a recipient 
- acceptTransfer - used to take custody
- cancelTransfer - used to cancel a pending transfer
- verifyCertificate - compare a recomputed hash to the on chain hash
- getPart - used to read the full record
- getPartId - derives the record key from a part number and ser. number
- pendingRecipient - this returns the pending recipient 

Note: Recording a new certificate or changing a parts status cancels any pending transfer - so the recipient has to agree to the changed record

## Dependencies
 - SOlidity 0.8.28
 - OpenZeppelin Contracts 5.4.0 0 - AccesscONTROL
 - Remix IDE
 - MetaMask wallet
 - Polygon Amoy testnet and a faucet for test funds
 - IPFS for certificate storage
 - ethers.js

## Setup and Deployment

> This is a work in progress. Frontend and IPFS integreation steps shall be completed in the upcoming milestones.

1. Add Polygon Amoy to MetaMask and fund the wallet from Amoy faucet
2. Open Remix and create 'contracts/SkyChain.sol' and 'contracts/ISkyChain.sol' with the files from the repi
3. Remix resolves the contracts from openZeppelin import automatically
4. Compile with the Solidity 0.8.28 - updated
5. Deploy skychain and pass the consortium admin wallet address as the constructor argument
6. Them, finally grant roles from the admin wallet

## Usage Flow
1. The Admin gives the roles to the respective participants
2. Then the manufacturer calls 'registerPart' with the part number and serial number
3. The issuer uploads the certificate to IPFS and calls the 'recordCertificate' - with the file hash and CID
4. the custodian then calls 'initiateTransfer(partId, recipient)'
5. Recipient calls 'acceptTransfer(partId)'
6. A repair station that holds the part calls, 'updateStatus' - repairs to the part
7. anyone calls 'verifyCertificate' - check that the certificate hasnt been tampered with

## Evaluation Plan 
 - Gas cost per operation - includes register, transfer, status update
 - One byte tamper test
 - Negative tests - unauthorized roles

## Milestones
 - November 1 - Smart Contract Design
 - November 15
 - December 4

## Team Roles
| Member | Roles | 
| --- | --- |
| Parva | Smart Contract Development |
| Surya | Role-based access control, Polygon Amoy Deployment, IPFS integration | 
| Rimpa | Frontend Development | 
| Saniya | Testing, documentation, final report and demo | 
