export const walletPaths = {
  '/api/wallet/addWalletAddress': {
    post: {
      tags: ['Wallet Addresses'],
      summary: 'Add wallet address for receiving payments',
      description: `Add a cryptocurrency wallet address to your company account for receiving payments.
      
**Purpose:** Merchants use this to configure where crypto payments should be forwarded.

**Multi-Tenant:** Each wallet address belongs to a specific company.

**Supported Cryptocurrencies:**
- BTC (Bitcoin)
- ETH (Ethereum)
- TRX (Tron)
- LTC (Litecoin)
- DOGE (Dogecoin)
- USDT-ERC20 (Tether on Ethereum)
- USDT-TRC20 (Tether on Tron)
- BCH (Bitcoin Cash)
- BSC (Binance Smart Chain)`,
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
                  description: '✅ REQUIRED: Cryptocurrency wallet address where payments will be forwarded',
                  example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
                },
                currency: {
                  type: 'string',
                  enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'USDT-ERC20', 'USDT-TRC20', 'BCH', 'BSC'],
                  description: '✅ REQUIRED: Cryptocurrency type',
                  example: 'BTC'
                },
                company_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Company ID (wallet belongs to this company)',
                  example: 1
                },
                wallet_name: {
                  type: 'string',
                  description: '📝 OPTIONAL: Friendly name for identification (e.g., "Main BTC Wallet", "Business ETH Address")',
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
          description: '✅ Wallet address added successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Address added successfully!' },
                  data: {
                    type: 'object',
                    properties: {
                      wallet_id: { type: 'string' },
                      wallet_address: { type: 'string' },
                      currency: { type: 'string' },
                      wallet_name: { type: 'string' },
                      company_id: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid wallet address format or duplicate address' },
        401: { description: 'Unauthorized - JWT token required' },
        403: { description: 'You don\'t have access to this company' }
      }
    }
  },
  '/api/wallet/getWalletAddresses': {
    get: {
      tags: ['Wallet Addresses'],
      summary: 'Get all wallet addresses',
      description: `Retrieve all cryptocurrency wallet addresses configured for your companies.
      
**Returns:** List of all wallet addresses with their details (address, currency, name, company).`,
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Wallet addresses retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        wallet_id: { type: 'string' },
                        wallet_address: { type: 'string' },
                        wallet_name: { type: 'string' },
                        wallet_type: { type: 'string' },
                        company_id: { type: 'integer' },
                        amount: { type: 'number' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized - JWT token required' }
      }
    }
  },
  '/api/wallet/address/send-otp': {
    post: {
      tags: ['Wallet Addresses'],
      summary: 'Send OTP to edit wallet address',
      description: `Send OTP verification code to edit an existing wallet address.
      
**Security:** OTP verification required before making any changes to wallet addresses.

**OTP Details:**
- Sent to your registered email
- Valid for 5 minutes
- Single-use only`,
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
                  description: '✅ REQUIRED: ID of the wallet address to edit',
                  example: '550e8400-e29b-41d4-a716-446655440000'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'OTP sent successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'OTP sent to your email' }
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
  '/api/wallet/address/{id}': {
    put: {
      tags: ['Wallet Addresses'],
      summary: 'Update wallet address (OTP required)',
      description: `Update an existing wallet address after OTP verification.
      
**Prerequisites:**
1. Call \`/api/wallet/address/send-otp\` first
2. Check email for OTP code
3. Use this endpoint with OTP to complete update

**Updatable Fields:**
- Wallet address
- Wallet name
- Currency`,
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
                  description: '✅ REQUIRED: 6-digit OTP from email',
                  example: '123456',
                  minLength: 6,
                  maxLength: 6
                },
                wallet_address: {
                  type: 'string',
                  description: '📝 OPTIONAL: New wallet address',
                  example: '3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy'
                },
                wallet_name: {
                  type: 'string',
                  description: '📝 OPTIONAL: New wallet name',
                  example: 'Updated Trading Wallet'
                },
                currency: {
                  type: 'string',
                  enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE'],
                  description: '📝 OPTIONAL: Update currency',
                  example: 'BTC'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Wallet address updated successfully',
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
        400: { description: 'Invalid OTP or expired OTP' },
        401: { description: 'Unauthorized' },
        404: { description: 'Wallet address not found' }
      }
    }
  },
  '/api/wallet/deleteWalletAddress': {
    post: {
      tags: ['Wallet Addresses'],
      summary: 'Delete wallet address',
      description: `Remove a wallet address from your company account.
      
**Note:** This only removes the address from your saved list. The actual blockchain wallet is unaffected.`,
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
                  description: '✅ REQUIRED: ID of the wallet address to delete',
                  example: '550e8400-e29b-41d4-a716-446655440000'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Wallet address deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Wallet address deleted successfully' }
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
  }
};
