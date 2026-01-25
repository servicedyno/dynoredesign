export const walletPaths = {
  '/api/wallet/validateWalletAddress': {
    post: {
      tags: ['Wallet Addresses'],
      summary: 'Create Wallet Address - Step 1: Send OTP',
      description: `Add a new cryptocurrency wallet address to your company (requires OTP verification).
      
**This is Step 1 of 2-step process:**
1. This endpoint validates address & sends OTP to your email
2. Then call \`/api/wallet/verifyOtp\` with the OTP to complete

**Purpose:** Configure where crypto payments should be forwarded for your company.

**Security:** OTP verification ensures only authorized users can add wallet addresses.`,
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
                  enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE'],
                  description: '✅ REQUIRED: Cryptocurrency type',
                  example: 'BTC'
                },
                company_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Company ID',
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
          description: '✅ OTP sent to email - Check your email and proceed to Step 2',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Address is a valid address and saved successfully!' }
                }
              }
            }
          }
        },
        400: { description: 'Invalid address or duplicate address' },
        401: { description: 'Unauthorized' },
        403: { description: 'No access to this company' }
      }
    }
  },
  '/api/wallet/verifyOtp': {
    post: {
      tags: ['Wallet Addresses'],
      summary: 'Create Wallet Address - Step 2: Verify OTP',
      description: `Complete wallet address creation by verifying OTP.
      
**Prerequisites:**
- Must call \`/api/wallet/validateWalletAddress\` first
- Check email for 6-digit OTP code

**After this step:** Wallet address is permanently saved and ready to receive payments.`,
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
                  description: '✅ REQUIRED: 6-digit OTP from email',
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
                  enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE'],
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
                  message: { type: 'string', example: 'OTP verified successfully!' }
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
  '/api/wallet/getWalletAddresses': {
    get: {
      tags: ['Wallet Addresses'],
      summary: 'Read All Wallet Addresses',
      description: `Get all cryptocurrency wallet addresses for your companies.
      
**No OTP required** for reading.`,
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
                        company_id: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized' }
      }
    }
  },
  '/api/wallet/address/send-otp': {
    post: {
      tags: ['Wallet Addresses'],
      summary: 'Update Wallet Address - Step 1: Send OTP',
      description: `Send OTP to update an existing wallet address.
      
**This is Step 1 of 2-step process:**
1. This endpoint sends OTP to your email
2. Then call \`PUT /api/wallet/address/{id}\` with OTP to update

**Security:** OTP verification required to prevent unauthorized changes.`,
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
          description: '✅ OTP sent to email - Check your email and proceed to Step 2',
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
      summary: 'Update Wallet Address - Step 2: Verify OTP & Update',
      description: `Update wallet address after OTP verification.
      
**Prerequisites:**
- Must call \`/api/wallet/address/send-otp\` first
- Check email for 6-digit OTP code

**Updatable:** wallet_address, wallet_name, currency`,
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
                  description: '📝 OPTIONAL: New currency',
                  example: 'BTC'
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
  '/api/wallet/address/delete/send-otp': {
    post: {
      tags: ['Wallet Addresses'],
      summary: 'Delete Wallet Address - Step 1: Send OTP',
      description: `Send OTP to delete a wallet address.
      
**This is Step 1 of 2-step process:**
1. This endpoint sends OTP to your email
2. Then call \`/api/wallet/deleteWalletAddress\` with OTP to complete deletion

**Security:** OTP verification prevents accidental or unauthorized deletions.`,
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
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: '✅ OTP sent to email - Check your email and proceed to Step 2',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'OTP sent to your email for wallet deletion' }
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
  '/api/wallet/deleteWalletAddress': {
    post: {
      tags: ['Wallet Addresses'],
      summary: 'Delete Wallet Address - Step 2: Verify OTP & Delete',
      description: `Delete wallet address after OTP verification.
      
**Prerequisites:**
- Must call \`/api/wallet/address/delete/send-otp\` first
- Check email for 6-digit OTP code

**Note:** This removes the address from your account. The blockchain wallet itself is unaffected.`,
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
                  description: '✅ REQUIRED: 6-digit OTP from email',
                  example: '123456',
                  minLength: 6,
                  maxLength: 6
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
                  message: { type: 'string', example: 'Wallet address deleted successfully' }
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
