export const walletPaths = {
  // ============================================
  // WALLET ADDRESS MANAGEMENT - CRUD Operations
  // All CUD (Create, Update, Delete) operations require OTP verification
  // ============================================

  // READ - Get wallet addresses (No OTP required)
  '/api/wallet/getWalletAddresses': {
    get: {
      tags: ['Wallet Address Management'],
      summary: '📖 Read All Wallet Addresses',
      description: `Retrieve all cryptocurrency wallet addresses configured for your account.

**No OTP Required** - This is a read-only operation.

**Multi-tenancy:** Optionally filter by company_id.`,
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

## Why OTP?
Security measure to ensure only authorized users can add wallet addresses.

## Next Step:
Check your email for a 6-digit OTP code and call \`/api/wallet/verifyOtp\``,
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

  // UPDATE - Step 1: Send OTP
  '/api/wallet/address/send-otp': {
    post: {
      tags: ['Wallet Address Management'],
      summary: '✏️ Update Wallet Address - Step 1: Send OTP',
      description: `**Request OTP to update an existing wallet address**

## 2-Step Process:
1. **This endpoint** - Sends OTP to your email
2. **Then call** \`PUT /api/wallet/address/{id}\` - Enter OTP to complete update

## Security:
OTP verification prevents unauthorized changes to your wallet addresses.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['address_id'],
              properties: {
                address_id: {
                  type: 'string',
                  description: '✅ REQUIRED: Wallet address ID to update',
                  example: '550e8400-e29b-41d4-a716-446655440000'
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
                  message: { type: 'string', example: 'OTP sent to your email' },
                  data: {
                    type: 'object',
                    properties: {
                      address_id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
                      email: { type: 'string', example: 'jo***@example.com' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid address_id' },
        401: { description: 'Unauthorized' },
        404: { description: 'Wallet address not found' }
      }
    }
  },

  // UPDATE - Step 2: Verify OTP and update
  '/api/wallet/address/{id}': {
    put: {
      tags: ['Wallet Address Management'],
      summary: '✏️ Update Wallet Address - Step 2: Verify OTP & Update',
      description: `**Complete wallet address update by verifying OTP**

## Prerequisites:
1. Must call \`POST /api/wallet/address/send-otp\` first
2. Check your email for the 6-digit OTP code

## Updatable Fields:
- wallet_address
- wallet_name`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string' },
        description: 'Wallet address ID',
        example: '550e8400-e29b-41d4-a716-446655440000'
      }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['otp'],
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
                  description: '📝 OPTIONAL: New wallet address',
                  example: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'
                },
                wallet_name: {
                  type: 'string',
                  description: '📝 OPTIONAL: New wallet name',
                  example: 'Updated Trading Wallet'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: '✅ Wallet address updated successfully!',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Wallet address updated successfully' }
                }
              }
            }
          }
        },
        400: { description: 'Invalid or expired OTP' },
        401: { description: 'Unauthorized' },
        404: { description: 'Wallet address not found' }
      }
    }
  },

  // DELETE - Step 1: Send OTP
  '/api/wallet/address/delete/send-otp': {
    post: {
      tags: ['Wallet Address Management'],
      summary: '🗑️ Delete Wallet Address - Step 1: Send OTP',
      description: `**Request OTP to delete a wallet address**

## 2-Step Process:
1. **This endpoint** - Sends OTP to your email
2. **Then call** \`POST /api/wallet/deleteWalletAddress\` - Enter OTP to confirm deletion

## ⚠️ Warning:
Deletion is PERMANENT and cannot be undone!`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['address_id'],
              properties: {
                address_id: {
                  type: 'string',
                  description: '✅ REQUIRED: Wallet address ID to delete',
                  example: '550e8400-e29b-41d4-a716-446655440000'
                },
                company_id: {
                  type: 'integer',
                  description: '📝 OPTIONAL: Company ID for multi-tenancy verification',
                  example: 1
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
                  message: { type: 'string', example: 'OTP sent to your email for wallet deletion' },
                  data: {
                    type: 'object',
                    properties: {
                      address_id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
                      email: { type: 'string', example: 'jo***@example.com' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid address_id' },
        401: { description: 'Unauthorized' },
        404: { description: 'Wallet address not found' }
      }
    }
  },

  // DELETE - Step 2: Verify OTP and delete
  '/api/wallet/deleteWalletAddress': {
    post: {
      tags: ['Wallet Address Management'],
      summary: '🗑️ Delete Wallet Address - Step 2: Verify OTP & Delete',
      description: `**Complete wallet address deletion by verifying OTP**

## Prerequisites:
1. Must call \`POST /api/wallet/address/delete/send-otp\` first
2. Check your email for the 6-digit OTP code

## ⚠️ Warning:
This action is IRREVERSIBLE! The wallet address will be permanently removed from your account.

## Note:
This only removes the address from DynoPay. Your actual blockchain wallet is unaffected.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['address_id', 'otp'],
              properties: {
                address_id: {
                  type: 'string',
                  description: '✅ REQUIRED: Wallet address ID to delete',
                  example: '550e8400-e29b-41d4-a716-446655440000'
                },
                otp: {
                  type: 'string',
                  description: '✅ REQUIRED: 6-digit OTP from your email',
                  example: '123456',
                  minLength: 6,
                  maxLength: 6
                },
                company_id: {
                  type: 'integer',
                  description: '📝 OPTIONAL: Company ID for multi-tenancy verification',
                  example: 1
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: '✅ Wallet address deleted successfully!',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Wallet address deleted successfully' },
                  data: {
                    type: 'object',
                    properties: {
                      deleted: { type: 'boolean', example: true },
                      address_id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
                      wallet_address: { type: 'string', example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
                      wallet_name: { type: 'string', example: 'Main BTC Payment Address' },
                      currency: { type: 'string', example: 'BTC' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid or expired OTP' },
        401: { description: 'Unauthorized' },
        404: { description: 'Wallet address not found' }
      }
    }
  }
};
