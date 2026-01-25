export const walletPaths = {
  // ============================================
  // WALLET ADDRESS MANAGEMENT - CRUD Operations
  // All CUD (Create, Update, Delete) operations require OTP verification
  // ============================================

  // READ - Get wallet addresses (No OTP required) - PRIMARY ENDPOINT
  '/api/wallet/getWallet': {
    get: {
      tags: ['Wallet Address Management'],
      summary: '📖 Get Wallet Addresses (RECOMMENDED - Use This)',
      description: `✅ **RECOMMENDED ENDPOINT** - Retrieve all cryptocurrency wallet addresses configured for your account.

**This is the main wallet system** that integrates with payment forwarding.

## Features:
- ✅ Returns OTP-verified wallet addresses
- ✅ Includes balance information
- ✅ Shows current crypto transfer rates
- ✅ Integrated with payment forwarding system
- ✅ Enforces one-wallet-per-blockchain rule

**No OTP Required** - This is a read-only operation.

**Multi-tenancy:** Optionally filter by company_id, or omit to get all companies.

**Table:** tbl_user_wallet (Main payment system)`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'query',
        name: 'company_id',
        schema: { type: 'integer' },
        description: '(Optional) Filter by company ID. If omitted, returns wallets for all companies.',
        example: 38
      }],
      responses: {
        200: {
          description: 'Wallet addresses retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Successfully retrieved 2 wallet' },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        wallet_id: { type: 'integer', example: 145, description: '⚠️ REQUIRED for delete operations' },
                        user_id: { type: 'integer', example: 28 },
                        company_id: { type: 'integer', example: 38 },
                        wallet_type: { type: 'string', example: 'ETH', enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'USDT-TRC20', 'USDT-ERC20', 'BCH'] },
                        wallet_address: { type: 'string', example: '0x9a7221b5e32d5f99e8da95585835442e29afb38f' },
                        wallet_name: { type: 'string', example: 'ETH Main Wallet' },
                        amount: { type: 'string', example: '0.00' },
                        balance_in_usd: { type: 'string', example: '0.00' },
                        transfer_rate: { type: 'number', example: 0.00035729, description: 'Current crypto-to-USD rate' },
                        createdAt: { type: 'string', example: '2026-01-25T18:18:05.691Z' },
                        updatedAt: { type: 'string', example: '2026-01-25T23:17:20.112Z' }
                      }
                    }
                  }
                }
              },
              examples: {
                'success': {
                  summary: 'Successful response',
                  value: {
                    "message": "Successfully retrieved 2 wallet",
                    "data": [
                      {
                        "wallet_id": 431,
                        "user_id": 28,
                        "company_id": 38,
                        "wallet_type": "ETH",
                        "wallet_address": "0x9a7221b5e32d5f99e8da95585835442e29afb38f",
                        "wallet_name": "ETH Main Wallet",
                        "amount": "0.00",
                        "balance_in_usd": "0.00",
                        "transfer_rate": 0.00035729
                      },
                      {
                        "wallet_id": 430,
                        "user_id": 28,
                        "company_id": 38,
                        "wallet_type": "BTC",
                        "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
                        "wallet_name": "BTC Main Wallet",
                        "amount": "0.00",
                        "balance_in_usd": "0.00",
                        "transfer_rate": 0.00001159
                      }
                    ]
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized - Invalid or missing token' }
      }
    }
  },

  // READ - Legacy endpoint (Deprecated)
  '/api/wallet/getWalletAddresses': {
    get: {
      tags: ['Wallet Address Management'],
      summary: '⚠️ Get Wallet Addresses (LEGACY - Not Recommended)',
      description: `⚠️ **DEPRECATED - USE /api/wallet/getWallet INSTEAD**

This endpoint queries a different table (tbl_user_wallet_address) that is NOT integrated with the payment forwarding system.

## Why Not Use This:
- ❌ Returns from legacy alternative table
- ❌ NOT integrated with payment forwarding
- ❌ May return empty even if you have wallets
- ❌ No balance information
- ❌ No transfer rates

## Use This Instead:
✅ **GET /api/wallet/getWallet** - Returns wallets from main payment system

**Multi-tenancy:** Optionally filter by company_id.

**Table:** tbl_user_wallet_address (Legacy system)`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'query',
        name: 'company_id',
        schema: { type: 'integer' },
        description: '(Optional) Filter by company ID',
        example: 1
      }],
      responses: {
        200: {
          description: 'Wallet addresses retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Successfully retrieved 3 wallet addresses' },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        user_address_id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
                        wallet_address: { type: 'string', example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
                        wallet_name: { type: 'string', example: 'Main BTC Wallet' },
                        currency: { type: 'string', example: 'BTC' },
                        label: { type: 'string', example: 'BTC' },
                        company_id: { type: 'integer', example: 1 }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized - Invalid or missing token' }
      }
    }
  },

  // CREATE - Step 1: Validate address and send OTP
  '/api/wallet/validateWalletAddress': {
    post: {
      tags: ['Wallet Address Management'],
      summary: '➕ Create Wallet Address - Step 1: Validate & Send OTP',
      description: `**Add a new cryptocurrency wallet address (requires OTP verification)**

## 2-Step Process:
1. **This endpoint** - Validates the wallet address and sends OTP to your email
2. **Then call** \`POST /api/wallet/verifyOtp\` - Enter OTP to complete creation

## Important:
- ✅ Saves to main payment system (tbl_user_wallet)
- ✅ Wallet will appear in \`GET /api/wallet/getWallet\`
- ✅ Integrated with payment forwarding
- ✅ Enforces one-wallet-per-blockchain rule
- 🔒 OTP is tied to specific currency (cannot swap currencies during verification)

## Why OTP?
Security measure to ensure only authorized users can add wallet addresses and prevent cross-currency corruption.

## Next Step:
Check your email for a 6-digit OTP code and call \`/api/wallet/verifyOtp\` with the **SAME currency**`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['wallet_address', 'currency', 'company_id'],
              properties: {
                wallet_address: {
                  type: 'string',
                  description: '✅ REQUIRED: Cryptocurrency wallet address',
                  example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
                },
                currency: {
                  type: 'string',
                  enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'USDT-TRC20', 'USDT-ERC20', 'BCH', 'BSC'],
                  description: '✅ REQUIRED: Cryptocurrency type',
                  example: 'BTC'
                },
                company_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Company ID (multi-tenancy)',
                  example: 1
                },
                wallet_name: {
                  type: 'string',
                  description: '📝 OPTIONAL: Friendly name for this wallet',
                  example: 'Main BTC Payment Address',
                  maxLength: 100
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: '✅ OTP sent to your email - Proceed to Step 2',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Address validated! OTP sent to your email.' }
                }
              }
            }
          }
        },
        400: { description: 'Invalid address format or duplicate address' },
        401: { description: 'Unauthorized' },
        403: { description: 'No access to this company' }
      }
    }
  },

  // CREATE - Step 2: Verify OTP and complete creation
  '/api/wallet/verifyOtp': {
    post: {
      tags: ['Wallet Address Management'],
      summary: '➕ Create Wallet Address - Step 2: Verify OTP & Complete',
      description: `**Complete wallet address creation by verifying OTP**

## Prerequisites:
1. Must call \`POST /api/wallet/validateWalletAddress\` first
2. Check your email for the 6-digit OTP code

## After Success:
Wallet address is saved and ready to receive payments!`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['otp', 'wallet_address', 'currency', 'company_id'],
              properties: {
                otp: {
                  type: 'string',
                  description: '✅ REQUIRED: 6-digit OTP from your email',
                  example: '123456',
                  minLength: 6,
                  maxLength: 6
                },
                wallet_address: {
                  type: 'string',
                  description: '✅ REQUIRED: Same address from Step 1',
                  example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
                },
                currency: {
                  type: 'string',
                  enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'USDT-TRC20', 'USDT-ERC20', 'BCH', 'BSC'],
                  description: '✅ REQUIRED: Same currency from Step 1',
                  example: 'BTC'
                },
                company_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Same company_id from Step 1',
                  example: 1
                },
                wallet_name: {
                  type: 'string',
                  description: '📝 OPTIONAL: Same wallet_name from Step 1',
                  example: 'Main BTC Payment Address'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: '✅ Wallet address created successfully!',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'OTP verified! Wallet address saved successfully.' }
                }
              }
            }
          }
        },
        400: { description: 'Invalid or expired OTP' },
        401: { description: 'Unauthorized' }
      }
    }
  },

  // DELETE - Remove wallet from main payment system
  '/api/wallet/wallet/delete': {
    post: {
      tags: ['Wallet Address Management'],
      summary: '🗑️ Delete Payment Forwarding Wallet (Main System)',
      description: `**Remove a wallet address from the main payment forwarding system**

⚠️ **Important:** This endpoint is for wallets in the main payment system (tbl_user_wallet) that receive payment forwarding.

## Features:
- ✅ Delete by wallet_id (recommended)
- ✅ Delete by currency (legacy support)
- ✅ Multi-tenant security with company_id
- ✅ Returns deleted wallet information

## Use wallet_id from:
\`GET /api/wallet/getWallet\` response - each wallet has a unique wallet_id

## Alternative Endpoints:
- **DELETE** \`/api/wallet/wallet/{wallet_id}\` - RESTful style
- **POST** \`/api/wallet/wallet/delete\` - This endpoint (for broader compatibility)

**Table:** tbl_user_wallet (Main payment system)`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                wallet_id: {
                  type: 'integer',
                  description: '✅ RECOMMENDED: Wallet ID (get from /getWallet response)',
                  example: 431
                },
                currency: {
                  type: 'string',
                  enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'USDT-TRC20', 'USDT-ERC20', 'BCH'],
                  description: '⚠️ LEGACY: Currency type (use wallet_id instead)',
                  example: 'BTC'
                },
                company_id: {
                  type: 'integer',
                  description: '✅ RECOMMENDED: Company ID for multi-tenant security',
                  example: 38
                }
              }
            },
            examples: {
              'by_wallet_id': {
                summary: 'Delete by wallet_id (Recommended)',
                value: {
                  wallet_id: 431,
                  company_id: 38
                }
              },
              'by_currency': {
                summary: 'Delete by currency (Legacy)',
                value: {
                  currency: 'BTC',
                  company_id: 38
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Wallet address removed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Wallet address removed successfully!' },
                  data: {
                    type: 'object',
                    properties: {
                      removed: { type: 'boolean', example: true },
                      wallet_id: { type: 'integer', example: 431 },
                      wallet_type: { type: 'string', example: 'BTC' },
                      company_id: { type: 'integer', example: 38 }
                    }
                  }
                }
              },
              example: {
                "success": true,
                "message": "Wallet address removed successfully!",
                "data": {
                  "removed": true,
                  "wallet_id": 431,
                  "wallet_type": "BTC",
                  "company_id": 38
                }
              }
            }
          }
        },
        400: { description: 'wallet_id or currency is required' },
        401: { description: 'Unauthorized - Invalid or missing token' },
        404: { description: 'Wallet address not found or you don\'t have permission' }
      }
    }
  },

  // DELETE - RESTful style endpoint
  '/api/wallet/wallet/{wallet_id}': {
    delete: {
      tags: ['Wallet Address Management'],
      summary: '🗑️ Delete Payment Forwarding Wallet by ID (RESTful)',
      description: `**Remove a wallet address from the main payment forwarding system**

⚠️ **Important:** This endpoint is for wallets in the main payment system (tbl_user_wallet) that receive payment forwarding.

## RESTful DELETE method:
Uses wallet_id from URL path parameter.

## Get wallet_id from:
\`GET /api/wallet/getWallet\` response - each wallet has a unique wallet_id

**Table:** tbl_user_wallet (Main payment system)`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'wallet_id',
          required: true,
          schema: { type: 'integer' },
          description: 'Wallet ID to delete',
          example: 431
        },
        {
          in: 'query',
          name: 'company_id',
          schema: { type: 'integer' },
          description: '(Optional) Company ID for multi-tenant security',
          example: 38
        }
      ],
      responses: {
        200: {
          description: 'Wallet address removed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Wallet address removed successfully!' },
                  data: {
                    type: 'object',
                    properties: {
                      removed: { type: 'boolean', example: true },
                      wallet_id: { type: 'integer', example: 431 },
                      wallet_type: { type: 'string', example: 'BTC' },
                      company_id: { type: 'integer', example: 38 }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized - Invalid or missing token' },
        404: { description: 'Wallet address not found or you don\'t have permission' }
      }
    }
  }
};
