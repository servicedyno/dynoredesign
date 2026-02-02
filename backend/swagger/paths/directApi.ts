export const directApiPaths = {
  '/api/user/createUser': {
    post: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Create a customer for payment processing',
      description: `Create a customer record to initiate payments. Returns a customer token required for subsequent payment requests.

**Authentication:** Requires \`x-api-key\` header with your API key.

**Flow:**
1. Create customer with this endpoint
2. Use returned \`token\` in Authorization header for payment endpoints
3. Customer can make multiple payments using same token`,
      security: [{ ApiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'email'],
              properties: {
                name: {
                  type: 'string',
                  description: '✅ REQUIRED: Customer name',
                  example: 'John Doe'
                },
                email: {
                  type: 'string',
                  format: 'email',
                  description: '✅ REQUIRED: Customer email address',
                  example: 'customer@example.com'
                }
              }
            },
            examples: {
              'Basic Customer': {
                summary: 'Create a new customer',
                value: {
                  name: 'John Doe',
                  email: 'john@example.com'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Customer created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      token: { 
                        type: 'string', 
                        description: '🔑 Customer token - use in Authorization header for payments'
                      },
                      customer_id: { type: 'string' }
                    }
                  }
                }
              },
              example: {
                message: 'Customer Created!',
                data: {
                  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  customer_id: 'cust_abc123'
                }
              }
            }
          }
        },
        401: { description: 'Invalid or missing API key' }
      }
    }
  },

  '/api/user/cryptoPayment': {
    post: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Create a cryptocurrency payment',
      description: `Generate a crypto payment address for the customer. Returns a deposit address that the customer should send funds to.

**Authentication:** 
- Header \`x-api-key\`: Your merchant API key
- Header \`Authorization\`: Bearer token from /api/user/createUser

**Supported Currencies:** BTC, ETH, USDT, USDC, TRX, LTC, XRP, SOL, MATIC, BNB

**Webhook Flow:**
1. Customer sends crypto to the returned address
2. DynoPay detects the deposit on blockchain
3. Webhook sent to your \`webhook_url\` with payment status
4. Optional: Customer redirected to \`callback_url\` after payment

**URL Priority:**
1. Per-payment \`webhook_url\` (this request)
2. API key's configured webhook URL
3. Company's default webhook URL`,
      security: [{ ApiKeyAuth: [], BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: {
                amount: {
                  type: 'number',
                  description: '✅ REQUIRED: Payment amount in USD',
                  example: 100
                },
                currency: {
                  type: 'string',
                  description: '✅ REQUIRED: Cryptocurrency for payment',
                  enum: ['BTC', 'ETH', 'USDT', 'USDC', 'TRX', 'LTC', 'XRP', 'SOL', 'MATIC', 'BNB'],
                  example: 'ETH'
                },
                callback_url: {
                  type: 'string',
                  format: 'uri',
                  description: `🔗 OPTIONAL: URL to redirect customer after payment completion.
                  
**Use Case:** Redirect customer to your order confirmation page after they complete payment.`,
                  example: 'https://yourapp.com/order/12345/success'
                },
                webhook_url: {
                  type: 'string',
                  format: 'uri',
                  description: `📡 OPTIONAL: URL to receive payment status webhooks (overrides API key config).

**Webhook Events Sent:**
- \`payment.pending\` - Deposit detected, awaiting confirmations
- \`payment.confirmed\` - Payment fully confirmed

**Webhook Payload:**
\`\`\`json
{
  "event": "payment.confirmed",
  "payment_id": "pay_xyz789",
  "amount": 100,
  "currency": "ETH",
  "crypto_amount": "0.042",
  "tx_hash": "0xabc123...",
  "status": "confirmed"
}
\`\`\``,
                  example: 'https://yourapp.com/webhooks/crypto-payment'
                },
                fee_payer: {
                  type: 'string',
                  enum: ['customer', 'company'],
                  description: `💰 OPTIONAL: Who pays the processing fees.

**Options:**
- \`company\` (default) - Fees deducted from merchant's portion
- \`customer\` - Customer pays additional amount to cover fees`,
                  default: 'company',
                  example: 'company'
                }
              }
            },
            examples: {
              'Simple Payment': {
                summary: '⚡ Minimal - just amount and currency',
                value: {
                  amount: 50,
                  currency: 'ETH'
                }
              },
              'With Webhook': {
                summary: '📡 With webhook notification',
                value: {
                  amount: 100,
                  currency: 'BTC',
                  webhook_url: 'https://yourapp.com/webhooks/payment'
                }
              },
              'Full Options': {
                summary: '🚀 All options specified',
                value: {
                  amount: 250,
                  currency: 'USDT',
                  callback_url: 'https://yourapp.com/order/success',
                  webhook_url: 'https://yourapp.com/webhooks/payment',
                  fee_payer: 'customer'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Crypto payment address generated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      payment_id: { type: 'string', description: 'Unique payment identifier' },
                      address: { type: 'string', description: '📥 Deposit address - customer sends funds here' },
                      amount: { type: 'number', description: 'Amount in USD' },
                      crypto_amount: { type: 'string', description: 'Amount in cryptocurrency' },
                      currency: { type: 'string', description: 'Cryptocurrency symbol' },
                      expires_at: { type: 'string', format: 'date-time', description: 'Payment expiration time' },
                      qr_code: { type: 'string', description: 'QR code URL for easy scanning' }
                    }
                  }
                }
              },
              example: {
                message: 'Payment address generated',
                data: {
                  payment_id: 'pay_xyz789',
                  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE4E',
                  amount: 100,
                  crypto_amount: '0.042156',
                  currency: 'ETH',
                  expires_at: '2025-02-02T03:00:00Z',
                  qr_code: 'https://api.qrserver.com/v1/create-qr-code/?data=0x742d35...'
                }
              }
            }
          }
        },
        401: { description: 'Invalid API key or customer token' },
        400: { description: 'Invalid request parameters' }
      }
    }
  },

  '/api/user/createPayment': {
    post: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Create a fiat payment (card/bank)',
      description: `Create a fiat payment using card or bank transfer.

**Authentication:** 
- Header \`x-api-key\`: Your merchant API key
- Header \`Authorization\`: Bearer token from /api/user/createUser`,
      security: [{ ApiKeyAuth: [], BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount'],
              properties: {
                amount: {
                  type: 'number',
                  description: '✅ REQUIRED: Payment amount in base currency',
                  example: 100
                },
                redirect_uri: {
                  type: 'string',
                  format: 'uri',
                  description: '↪️ OPTIONAL: URL to redirect after payment',
                  example: 'https://yourapp.com/payment/complete'
                },
                callback_url: {
                  type: 'string',
                  format: 'uri',
                  description: '🔗 OPTIONAL: URL for payment callback',
                  example: 'https://yourapp.com/api/payment-callback'
                },
                webhook_url: {
                  type: 'string',
                  format: 'uri',
                  description: '📡 OPTIONAL: URL for webhook notifications',
                  example: 'https://yourapp.com/webhooks/payment'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment link generated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      redirect_url: { type: 'string', description: 'URL to redirect customer for payment' },
                      payment_id: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/user/getTransactions': {
    get: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Get customer transactions',
      description: `Retrieve all transactions for the authenticated customer.

**Authentication:** 
- Header \`x-api-key\`: Your merchant API key
- Header \`Authorization\`: Bearer token from /api/user/createUser`,
      security: [{ ApiKeyAuth: [], BearerAuth: [] }],
      responses: {
        200: {
          description: 'Transactions retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        transaction_id: { type: 'string' },
                        amount: { type: 'number' },
                        currency: { type: 'string' },
                        status: { type: 'string', enum: ['pending', 'confirmed', 'failed'] },
                        created_at: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/user/getBalance': {
    get: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Get customer wallet balance',
      description: `Retrieve the wallet balance for the authenticated customer.

**Authentication:** 
- Header \`x-api-key\`: Your merchant API key
- Header \`Authorization\`: Bearer token from /api/user/createUser`,
      security: [{ ApiKeyAuth: [], BearerAuth: [] }],
      responses: {
        200: {
          description: 'Balance retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      balance: { type: 'number' },
                      currency: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/getSupportedCurrency': {
    get: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Get supported cryptocurrencies',
      description: `Retrieve list of supported cryptocurrencies for payments.

**Authentication:** 
- Header \`x-api-key\`: Your merchant API key
- Header \`Authorization\`: Bearer token from /api/user/createUser`,
      security: [{ ApiKeyAuth: [], BearerAuth: [] }],
      responses: {
        200: {
          description: 'Supported currencies list',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        symbol: { type: 'string', example: 'ETH' },
                        name: { type: 'string', example: 'Ethereum' },
                        network: { type: 'string', example: 'ethereum' },
                        min_amount: { type: 'number' },
                        enabled: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
