# Backend Architecture: Qash + Miden Multisig

## Overview

This document describes the backend architecture for integrating Miden multisig functionality with the Qash payment platform.

## Problem Statement

- **Qash** is the main product built with TypeScript/NestJS
- **Miden Client** only has a Rust implementation (no TypeScript bindings)
- We need multisig functionality from Miden, but don't want to rewrite everything in Rust
- Both systems need to share data about accounts, proposals, and signatures

## Solution: API Gateway Pattern

We use a microservices architecture where:
1. **qash-server** (TypeScript/NestJS) - Main application server
2. **miden-multisig-server** (Rust/Axum) - Stateless Miden client wrapper
3. **PostgreSQL** - Single source of truth for all data

```
┌─────────────┐
│  Frontend   │
│  (React)    │
└──────┬──────┘
       │
       │ HTTP
       ▼
┌─────────────────────────────────────────┐
│         qash-server (NestJS)            │
│  ┌────────────────────────────────────┐ │
│  │  MultisigService                   │ │
│  │  - Create account                  │ │
│  │  - Manage proposals                │ │
│  │  - Collect signatures              │ │
│  │  - Execute transactions            │ │
│  └───────────┬────────────────────────┘ │
│              │                           │
│              │ HTTP (internal)           │
│              ▼                           │
│  ┌────────────────────────────────────┐ │
│  │  PostgreSQL                        │ │
│  │  - MultisigAccount                 │ │
│  │  - MultisigProposal                │ │
│  │  - MultisigSignature               │ │
│  └────────────────────────────────────┘ │
└──────────┬──────────────────────────────┘
           │
           │ HTTP
           ▼
┌─────────────────────────────────────────┐
│  miden-multisig-server (Rust/Axum)     │
│  STATELESS - No database, no storage   │
│  ┌────────────────────────────────────┐ │
│  │  Miden Client Operations           │ │
│  │  - Create account (via Miden)      │ │
│  │  - Get consumable notes            │ │
│  │  - Create proposals                │ │
│  │  - Execute transactions            │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Rust Server (miden-multisig-server)

**Location:** `miden-para-multisig/server/`

**Purpose:** Stateless wrapper around Miden client

**Endpoints:**
- `POST /multisig/create-account` - Create multisig account via Miden
- `GET /multisig/{account_id}/notes` - Get consumable notes
- `GET /multisig/{account_id}/balances` - Get account balances
- `POST /multisig/consume-proposal` - Create consume notes proposal
- `POST /multisig/send-proposal` - Create send funds proposal
- `POST /multisig/execute` - Execute transaction with signatures

**Key Characteristics:**
- No database connection
- No persistent storage
- All data returns to caller (qash-server)
- Pure Miden client operations only

## TypeScript Server (qash-server)

**Location:** `qash-server/`

**Purpose:** Main application server with business logic and data persistence

### Database Schema

**MultisigAccount:**
```prisma
model MultisigAccount {
  accountId   String   // Miden account ID (bech32)
  publicKeys  String[] // Approver public keys
  threshold   Int      // Required signatures
  companyId   Int      // Owner company
  proposals   MultisigProposal[]
}
```

**MultisigProposal:**
```prisma
model MultisigProposal {
  accountId         String  // Link to MultisigAccount
  description       String
  proposalType      CONSUME | SEND
  summaryCommitment String  // From Miden
  summaryBytesHex   String  // Transaction summary
  requestBytesHex   String  // Transaction request
  status            PENDING | READY | EXECUTED | FAILED
  signatures        MultisigSignature[]
}
```

**MultisigSignature:**
```prisma
model MultisigSignature {
  proposalId        Int     // Link to proposal
  approverIndex     Int     // Index in approvers array
  approverPublicKey String  // For verification
  signatureHex      String  // From Para wallet
}
```


## Data Flow Examples

### Creating a Multisig Account

```
1. Frontend → qash-server POST /multisig/accounts
2. qash-server → miden-server POST /multisig/create-account
3. miden-server → Miden Client (creates account)
4. miden-server → qash-server (returns accountId)
5. qash-server → PostgreSQL (stores account)
6. qash-server → Frontend (returns account details)
```

### Creating and Executing a Proposal

```
1. Frontend → qash-server POST /multisig/proposals/consume
2. qash-server → miden-server POST /multisig/consume-proposal
3. miden-server → Miden Client (creates proposal summary)
4. miden-server → qash-server (returns summary for signing)
5. qash-server → PostgreSQL (stores proposal)
6. qash-server → Frontend (returns proposal ID + summary commitment)

7. Frontend → Para Wallet (sign summary)
8. Frontend → qash-server POST /multisig/proposals/:id/signatures
9. qash-server → PostgreSQL (stores signature, checks threshold)
10. Repeat 7-9 for each approver

11. Frontend → qash-server POST /multisig/proposals/:id/execute
12. qash-server → PostgreSQL (fetch proposal + signatures)
13. qash-server → miden-server POST /multisig/execute
14. miden-server → Miden Client (executes transaction)
15. miden-server → qash-server (returns transaction ID)
16. qash-server → PostgreSQL (update status to EXECUTED)
17. qash-server → Frontend (transaction complete)
```
