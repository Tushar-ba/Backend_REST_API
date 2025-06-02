# Blockchain REST API

A comprehensive blockchain REST API built with Node.js and MongoDB. This API provides endpoints for user authentication, wallet management, transaction processing, and blockchain operations.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [API Documentation](#api-documentation)
  - [Authentication Flow](#authentication-flow)
  - [Wallet Management Flow](#wallet-management-flow)
  - [Transaction Flow](#transaction-flow)
  - [Blockchain Flow](#blockchain-flow)
- [API Endpoints](#api-endpoints)
  - [Authentication APIs](#authentication-apis)
  - [Wallet Management APIs](#wallet-management-apis)
  - [Transaction APIs](#transaction-apis)
  - [Blockchain APIs](#blockchain-apis)
  - [Validation APIs](#validation-apis)
- [Data Models](#data-models)
- [Security Implementation](#security-implementation)

## Features

- **User Authentication**: JWT-based authentication with refresh tokens
- **Wallet Management**: Create and manage cryptocurrency wallets
- **Transaction System**: Create, validate, and process transactions
- **Blockchain Core**: Mine blocks, validate chain integrity
- **Cryptography**: Digital signatures, key pair generation
- **API Security**: Role-based access control, input validation

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT (jsonwebtoken) + bcrypt
- **Testing**: Jest + Postman
- **Crypto**: Node.js crypto module
- **Validation**: express-validator

## Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/blockchain-rest-api.git
cd blockchain-rest-api
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables (create a .env file)

```
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/blockchain_db
JWT_SECRET=your-super-secret-jwt-key-256-bits
JWT_REFRESH_SECRET=your-refresh-token-secret-key
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
BCRYPT_ROUNDS=12
```

4. Start the server

```bash
npm start
```

## API Documentation

### Authentication Flow

1. **Register a new user account**
   - Create a new user with username, email, and password
   - User role is set to 'user' by default

2. **Login to get access tokens**
   - Authenticate with username/password
   - Receive access token (15min) and refresh token (7 days)

3. **Access protected resources**
   - Include the access token in the Authorization header
   - Format: `Authorization: Bearer <access_token>`

4. **Refresh token when expired**
   - Use refresh token to get a new access token
   - Old refresh token is invalidated

5. **Update user profile**
   - Modify user details as needed

**Example Authentication Flow:**

```json
// 1. Register a new user
POST /api/auth/register
Body: {
  "username": "testuser",
  "email": "test@example.com",
  "password": "Password123!",
  "profile": {
    "firstName": "Test",
    "lastName": "User"
  }
}

// 2. Login to get tokens
POST /api/auth/login
Body: {
  "username": "testuser",
  "password": "Password123!"
}
Response: {
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "6839798e222523165333496b",
      "username": "testuser",
      "role": "user"
    }
  }
}

// 3. Access protected resource
GET /api/auth/profile
Headers: {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Wallet Management Flow

1. **Create a new wallet**
   - Generate a new key pair (public/private keys)
   - Derive wallet address from public key
   - Store wallet details in database

2. **View wallet details and balance**
   - Get wallet information including balance
   - Balance is calculated from confirmed transactions

3. **Add funds to wallet (admin only, for testing)**
   - Create a system transaction to add funds
   - Update wallet balance

4. **Update wallet metadata**
   - Modify wallet name or description

**Example Wallet Flow:**

```json
// 1. Create a new wallet
POST /api/wallets
Headers: {
  "Authorization": "Bearer <access_token>"
}
Body: {
  "metadata": {
    "name": "My Primary Wallet",
    "description": "Personal savings wallet"
  }
}
Response: {
  "success": true,
  "data": {
    "id": "68397cef5d4752e896de15d7",
    "address": "19016666e398dd0113c41dd2245aad4c7951d7e2ce78cd85319740cc9c8dde75",
    "balance": 0
  }
}

// 2. Add funds to wallet (admin only)
POST /api/wallets/68397cef5d4752e896de15d7/balance
Headers: {
  "Authorization": "Bearer <admin_access_token>"
}
Body: {
  "amount": 1000
}
Response: {
  "success": true,
  "data": {
    "id": "68397cef5d4752e896de15d7",
    "address": "19016666e398dd0113c41dd2245aad4c7951d7e2ce78cd85319740cc9c8dde75",
    "previousBalance": 0,
    "newBalance": 1000,
    "transactionId": "68398a7f5d4752e896de15e1"
  }
}

// 3. Check wallet balance
GET /api/wallets/68397cef5d4752e896de15d7/balance
Headers: {
  "Authorization": "Bearer <access_token>"
}
Response: {
  "success": true,
  "data": {
    "walletId": "68397cef5d4752e896de15d7",
    "address": "19016666e398dd0113c41dd2245aad4c7951d7e2ce78cd85319740cc9c8dde75",
    "balance": 1000,
    "pendingOutgoing": 0,
    "pendingIncoming": 0,
    "availableBalance": 1000
  }
}
```

### Transaction Flow

1. **Validate transaction parameters**
   - Check if sender and receiver wallets exist
   - Verify sender has sufficient balance
   - Ensure user owns the sender wallet

2. **Create a new transaction**
   - Sign transaction with sender's private key
   - Verify signature with sender's public key
   - Save transaction with 'pending' status

3. **Mine a block to confirm transactions**
   - Admin mines a block containing pending transactions
   - Transactions are updated to 'confirmed' status
   - Wallet balances are updated

4. **View transaction details**
   - Check transaction status and details

**Example Transaction Flow:**

```json
// 1. Validate transaction before creating
POST /api/transactions/validate
Headers: {
  "Authorization": "Bearer <access_token>"
}
Body: {
  "fromWallet": "19016666e398dd0113c41dd2245aad4c7951d7e2ce78cd85319740cc9c8dde75",
  "toWallet": "d556935edc1f7742aa4dc9526fc26cb9e66dd99721698f44692ba1fa5e6a0bde",
  "amount": 10
}
Response: {
  "success": true,
  "data": {
    "isValid": true,
    "validationDetails": {
      "fromWallet": {
        "exists": true,
        "isOwner": true,
        "balance": 1000,
        "availableBalance": 1000,
        "pendingOutgoing": 0,
        "hasSufficientBalance": true,
        "hasPendingTransactions": false
      },
      "toWallet": {
        "exists": true
      },
      "amount": {
        "isValid": true,
        "minimumAmount": 0.01
      },
      "fee": 0.001,
      "totalCost": 10.001
    }
  }
}

// 2. Create the transaction
POST /api/transactions
Headers: {
  "Authorization": "Bearer <access_token>"
}
Body: {
  "fromWallet": "19016666e398dd0113c41dd2245aad4c7951d7e2ce78cd85319740cc9c8dde75",
  "toWallet": "d556935edc1f7742aa4dc9526fc26cb9e66dd99721698f44692ba1fa5e6a0bde",
  "amount": 10
}
Response: {
  "success": true,
  "data": {
    "id": "68398b7f5d4752e896de15e2",
    "fromWallet": "19016666e398dd0113c41dd2245aad4c7951d7e2ce78cd85319740cc9c8dde75",
    "toWallet": "d556935edc1f7742aa4dc9526fc26cb9e66dd99721698f44692ba1fa5e6a0bde",
    "amount": 10,
    "fee": 0.001,
    "status": "pending",
    "hash": "a1b2c3d4e5f6...",
    "timestamp": "2025-05-30T10:41:00Z"
  }
}

// 3. Check wallet balance after transaction creation
GET /api/wallets/68397cef5d4752e896de15d7/balance
Headers: {
  "Authorization": "Bearer <access_token>"
}
Response: {
  "success": true,
  "data": {
    "walletId": "68397cef5d4752e896de15d7",
    "address": "19016666e398dd0113c41dd2245aad4c7951d7e2ce78cd85319740cc9c8dde75",
    "balance": 1000,
    "pendingOutgoing": 10.001,
    "pendingIncoming": 0,
    "availableBalance": 989.999
  }
}
```

### Blockchain Flow

1. **Mine a block (admin only)**
   - Collect pending transactions
   - Calculate merkle root
   - Perform proof-of-work mining
   - Create a new block
   - Update transaction statuses
   - Update wallet balances

2. **View blockchain status**
   - Check total blocks, transactions, etc.

3. **Validate blockchain integrity**
   - Verify hash chain and block integrity

**Example Blockchain Flow:**

```json
// 1. Mine a block (admin only)
POST /api/blockchain/mine
Headers: {
  "Authorization": "Bearer <admin_access_token>"
}
Body: {
  "minerWallet": "19016666e398dd0113c41dd2245aad4c7951d7e2ce78cd85319740cc9c8dde75"
}
Response: {
  "success": true,
  "data": {
    "blockId": "68399c7f5d4752e896de15e3",
    "index": 1,
    "hash": "000048a1c3f63d7eb7b9c5f4b7d9e8a2c1b0f9e8d7c6b5a4f3e2d1c0b9a8f7e6",
    "previousHash": "0000000000000000000000000000000000000000000000000000000000000000",
    "timestamp": "2025-05-30T10:49:00Z",
    "transactionCount": 1,
    "merkleRoot": "a1b2c3d4e5f6...",
    "difficulty": 4,
    "nonce": 12345,
    "miningTimeMs": 1500
  }
}

// 2. Check wallet balance after mining (transaction confirmed)
GET /api/wallets/68397cef5d4752e896de15d7/balance
Headers: {
  "Authorization": "Bearer <access_token>"
}
Response: {
  "success": true,
  "data": {
    "walletId": "68397cef5d4752e896de15d7",
    "address": "19016666e398dd0113c41dd2245aad4c7951d7e2ce78cd85319740cc9c8dde75",
    "balance": 989.999,
    "pendingOutgoing": 0,
    "pendingIncoming": 0,
    "availableBalance": 989.999
  }
}

// 3. Check blockchain status
GET /api/blockchain/status
Response: {
  "success": true,
  "data": {
    "totalBlocks": 1,
    "latestBlockIndex": 1,
    "latestBlockHash": "000048a1c3f63d7eb7b9c5f4b7d9e8a2c1b0f9e8d7c6b5a4f3e2d1c0b9a8f7e6",
    "latestBlockTime": "2025-05-30T10:49:00Z",
    "totalTransactions": 1,
    "pendingTransactions": 0,
    "averageBlockTime": null,
    "currentDifficulty": 4
  }
}
```

## API Endpoints

### Authentication APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user account | No |
| POST | `/api/auth/login` | Login and get JWT token | No |
| POST | `/api/auth/refresh` | Refresh JWT token | No |
| GET | `/api/auth/profile` | Get current user profile | Yes |
| PUT | `/api/auth/profile` | Update user profile | Yes |

### Wallet Management APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/wallets` | Create a new wallet | Yes |
| GET | `/api/wallets` | Get user's wallets | Yes |
| GET | `/api/wallets/:walletId` | Get wallet details | Yes + Owner |
| GET | `/api/wallets/:walletId/balance` | Get wallet balance | Yes + Owner |
| PUT | `/api/wallets/:walletId` | Update wallet metadata | Yes + Owner |
| POST | `/api/wallets/:walletId/balance` | Add balance to wallet | Yes + Admin |

### Transaction APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/transactions` | Create new transaction | Yes |
| GET | `/api/transactions/:transactionId` | Get transaction details | No |
| GET | `/api/transactions` | List transactions | No |
| GET | `/api/transactions/wallet/:walletId` | Get wallet transactions | Yes + Owner |

### Blockchain APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/blockchain/blocks` | Get all blocks | No |
| GET | `/api/blockchain/blocks/:blockId` | Get specific block | No |
| POST | `/api/blockchain/mine` | Mine pending transactions | Yes + Admin |
| GET | `/api/blockchain/status` | Get blockchain metrics | No |

### Validation APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/transactions/validate` | Validate transaction | Yes |
| GET | `/api/blockchain/validate` | Validate blockchain | Yes + Admin |

## Data Models

### User Schema
```javascript
{
  _id: ObjectId,
  username: String, // unique
  email: String,    // unique
  password: String, // bcrypt hashed
  role: String,     // 'user', 'admin'
  profile: {
    firstName: String,
    lastName: String,
    avatar: String
  },
  refreshTokens: [String], // for JWT refresh
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Wallet Schema
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // Reference to User
  address: String, // SHA256 hash (unique)
  publicKey: String,
  privateKey: String, // Encrypted storage
  balance: Number,
  metadata: {
    name: String,
    description: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Transaction Schema
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // Who initiated transaction
  fromWallet: String, // wallet address
  toWallet: String,   // wallet address
  amount: Number,
  fee: Number,
  signature: String, // Digital signature
  timestamp: Date,
  status: String, // 'pending', 'confirmed', 'failed'
  blockId: ObjectId, // null if pending
  hash: String // transaction hash
}
```

### Block Schema
```javascript
{
  _id: ObjectId,
  index: Number,
  timestamp: Date,
  transactions: [ObjectId], // Array of transaction IDs
  transactionCount: Number,
  previousHash: String,
  hash: String,
  nonce: Number,
  merkleRoot: String,
  difficulty: Number,
  minedBy: ObjectId // Reference to User
}
```

## Security Implementation

- **JWT Authentication**: Token-based authentication with proper expiration
- **Password Hashing**: bcrypt with salt rounds: 12
- **Input Validation**: express-validator for request validation
- **Role-Based Access Control**: Different permissions for users and admins
- **Ownership Verification**: Users can only access their own resources
- **Digital Signatures**: Transactions are signed and verified
- **Rate Limiting**: Prevents abuse of API endpoints
- **Secure Headers**: Using helmet.js for security headers
- **Refresh Token Rotation**: For secure token refresh