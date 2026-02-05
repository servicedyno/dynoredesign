export const directApiPaths = {
  '/api/user/createUser': {
    post: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Create a customer for payment processing',
      description: `Create a customer record to initiate payments. Returns a customer token required for subsequent payment requests.

**🔐 Authentication:** Requires \`x-api-key\` header with your encrypted API key.

**📝 How to Get Your API Key:**
1. Login to DynoPay dashboard (\`POST /api/user/login\`)
2. Navigate to API Keys section
3. Create new API key (\`POST /api/userApi/addApi\`)
4. Copy the encrypted API key value
5. Use it in the \`x-api-key\` header

**🔄 Payment Flow:**
1. Create customer with this endpoint → Get customer \`token\`
2. Use customer \`token\` in \`Authorization: Bearer {token}\` header for \`/api/user/cryptoPayment\`
3. Customer can make multiple payments using same token (token doesn't expire)

**✨ Existing Customer Handling:**
- If email already exists for your company → Returns existing customer with new token
- No duplicate customers created`,
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
                  description: '✅ REQUIRED: Customer full name',
                  example: 'John Doe'
                },
                email: {
                  type: 'string',
                  format: 'email',
                  description: '✅ REQUIRED: Customer email address',
                  example: 'customer@example.com'
                },
                mobile: {
                  type: 'string',
                  description: '📱 OPTIONAL: Customer phone number',
                  example: '+1234567890'
                }
              }
            },
            examples: {
              'Basic Customer (Minimal)': {
                summary: 'Create customer with email only',
                value: {
                  name: 'John Doe',
                  email: 'john@example.com'
                }
              },
              'Customer with Mobile': {
                summary: 'Create customer with phone number',
                value: {
                  name: 'Jane Smith',
                  email: 'jane@example.com',
                  mobile: '+1234567890'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Customer created or retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      token: { 
                        type: 'string', 
                        description: '🔑 Customer JWT token - use this in Authorization header for /api/user/cryptoPayment'
                      },
                      customer_id: { 
                        type: 'string', 
                        description: 'Unique customer UUID'
                      }
                    }
                  }
                }
              },
              examples: {
                'New Customer Created': {
                  summary: 'New customer successfully created',
                  value: {
                    success: true,
                    message: 'Registered Successful!',
                    data: {
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFiYzEyMyIsImN1c3RvbWVyX2lkIjo0NSwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwiY29tcGFueV9pZCI6MzgsImlhdCI6MTcwOTU3MTIwMH0.xyz',
                      customer_id: 'abc123-def456-ghi789'
                    }
                  }
                },
                'Existing Customer Retrieved': {
                  summary: 'Customer already exists, returned with new token',
                  value: {
                    success: true,
                    message: 'Customer already exists',
                    data: {
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFiYzEyMyIsImN1c3RvbWVyX2lkIjo0NSwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwiY29tcGFueV9pZCI6MzgsImlhdCI6MTcwOTU3MTIwMH0.xyz',
                      customer_id: 'abc123-def456-ghi789'
                    }
                  }
                }
              }
            }
          }
        },
        400: { 
          description: 'Bad Request - Missing required fields',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'Name and email are required',
                errors: [
                  { key: 'name', error: 'Name is Required' },
                  { key: 'email', error: 'Email is Required' }
                ]
              }
            }
          }
        },
        403: { 
          description: 'Forbidden - Invalid or missing API key',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'API key is required in x-api-key header'
              }
            }
          }
        },
        500: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'Internal server error'
              }
            }
          }
        }
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
- \`payment.underpaid\` - Partial payment received, awaiting remainder

**Webhook Payload (payment.confirmed):**
\`\`\`json
{
  "event": "payment.confirmed",
  "payment_id": "pay_xyz789",
  "transaction_reference": "0xabc123...",
  "status": "processing",
  "amount": 0.042,
  "currency": "ETH",
  "base_amount": 100,
  "base_currency": "USD",
  "merchant_amount": 0.0399,
  "total_fee": 0.0021,
  "total_fee_usd": 5.00,
  "fee_payer": "company",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "description": "Order #12345",
  "link_id": 411,
  "tax_info": null,
  "overpayment": null,
  "meta_data": null,
  "completed_at": "2026-02-04T13:02:37.960Z",
  "webhook_id": "wh_abc123",
  "sent_at": "2026-02-04T13:02:37.963Z"
}
\`\`\`

**Webhook Payload (payment.pending):**
\`\`\`json
{
  "event": "payment.pending",
  "address": "0x1234...",
  "txId": "0xabc123...",
  "amount": 0.042,
  "currency": "ETH",
  "payment_id": "pay_xyz789",
  "status": "pending",
  "base_amount": 100,
  "base_currency": "USD",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "description": "Order #12345",
  "link_id": 411,
  "fee_payer": "company",
  "timestamp": "2026-02-04T13:02:27.843Z"
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
