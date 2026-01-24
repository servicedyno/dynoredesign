export const paymentPaths = {
  // ==================== PAYMENT LINKS ====================
  '/api/pay/createPaymentLink': {
    post: {
      tags: ['Payments'],
      summary: 'Create payment link',
      description: 'Create a new payment link for accepting crypto or fiat payments. The link can be shared with customers to collect payments.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency', 'company_id'],
              properties: {
                amount: { type: 'number', description: 'Payment amount' },
                currency: { type: 'string', enum: ['USD', 'EUR', 'NGN', 'GBP'], description: 'Fiat currency for the payment' },
                company_id: { type: 'integer', description: 'Company ID receiving the payment' },
                description: { type: 'string', description: 'Payment description shown to customer' },
                redirect_url: { type: 'string', format: 'uri', description: 'URL to redirect after successful payment' },
                webhook_url: { type: 'string', format: 'uri', description: 'URL to receive payment notifications' },
                expires_at: { type: 'string', format: 'date-time', description: 'Link expiration time (optional)' },
                metadata: { type: 'object', description: 'Custom metadata (order_id, customer_id, etc.)' }
              }
            },
            examples: {
              'E-commerce Order': {
                summary: 'Online store checkout',
                value: {
                  amount: 199.99,
                  currency: 'USD',
                  company_id: 1,
                  description: 'Order #12345 - Premium Subscription',
                  redirect_url: 'https://mystore.com/order/12345/success',
                  webhook_url: 'https://mystore.com/webhooks/dynopay',
                  metadata: {
                    order_id: '12345',
                    customer_email: 'customer@example.com',
                    items: ['Premium Plan - Annual']
                  }
                }
              },
              'Invoice Payment': {
                summary: 'B2B invoice payment',
                value: {
                  amount: 5000.00,
                  currency: 'USD',
                  company_id: 1,
                  description: 'Invoice #INV-2024-001 - Consulting Services',
                  redirect_url: 'https://mybusiness.com/invoices/paid',
                  webhook_url: 'https://mybusiness.com/api/payment-webhook',
                  expires_at: '2024-12-31T23:59:59Z',
                  metadata: {
                    invoice_id: 'INV-2024-001',
                    client_name: 'Acme Corp'
                  }
                }
              },
              'Simple Payment': {
                summary: 'Basic payment without redirect',
                value: {
                  amount: 50.00,
                  currency: 'USD',
                  company_id: 1,
                  description: 'Donation to Project X'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment link created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      link_id: { type: 'string', format: 'uuid' },
                      payment_url: { type: 'string', format: 'uri' },
                      amount: { type: 'number' },
                      currency: { type: 'string' },
                      status: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      expires_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              },
              example: {
                message: 'Payment link created successfully',
                data: {
                  link_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  payment_url: 'https://checkout.dynopay.com/pay/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  amount: 199.99,
                  currency: 'USD',
                  status: 'active',
                  created_at: '2024-01-15T10:30:00Z',
                  expires_at: null
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request',
          content: {
            'application/json': {
              example: { message: 'Amount must be greater than 0', error: true }
            }
          }
        },
        401: { description: 'Unauthorized - Invalid or missing token' }
      }
    }
  },
  '/api/pay/getPaymentLinks': {
    get: {
      tags: ['Payments'],
      summary: 'Get all payment links',
      description: 'Retrieve all payment links for the authenticated user with pagination and filtering',
      security: [{ BearerAuth: [] }],
      parameters: [
        { in: 'query', name: 'company_id', schema: { type: 'integer' }, description: 'Filter by company' },
        { in: 'query', name: 'status', schema: { type: 'string', enum: ['active', 'paid', 'expired', 'cancelled'] } },
        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
        { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } }
      ],
      responses: {
        200: {
          description: 'Payment links retrieved',
          content: {
            'application/json': {
              example: {
                message: 'Payment links retrieved',
                data: {
                  links: [
                    {
                      link_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                      amount: 199.99,
                      currency: 'USD',
                      description: 'Order #12345',
                      status: 'paid',
                      payment_url: 'https://checkout.dynopay.com/pay/a1b2c3d4...',
                      created_at: '2024-01-15T10:30:00Z',
                      paid_at: '2024-01-15T10:45:00Z'
                    },
                    {
                      link_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
                      amount: 50.00,
                      currency: 'USD',
                      description: 'Consultation Fee',
                      status: 'active',
                      payment_url: 'https://checkout.dynopay.com/pay/b2c3d4e5...',
                      created_at: '2024-01-16T09:00:00Z',
                      expires_at: '2024-01-23T09:00:00Z'
                    }
                  ],
                  pagination: { total: 25, page: 1, limit: 20, totalPages: 2 }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/links/{id}': {
    get: {
      tags: ['Payments'],
      summary: 'Get payment link by ID',
      description: 'Retrieve detailed information about a specific payment link',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      }],
      responses: {
        200: {
          description: 'Payment link details',
          content: {
            'application/json': {
              example: {
                message: 'Payment link retrieved',
                data: {
                  link_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  amount: 199.99,
                  currency: 'USD',
                  description: 'Order #12345 - Premium Subscription',
                  status: 'paid',
                  payment_url: 'https://checkout.dynopay.com/pay/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  redirect_url: 'https://mystore.com/order/12345/success',
                  webhook_url: 'https://mystore.com/webhooks/dynopay',
                  metadata: { order_id: '12345', customer_email: 'customer@example.com' },
                  created_at: '2024-01-15T10:30:00Z',
                  paid_at: '2024-01-15T10:45:00Z',
                  transaction: {
                    transaction_id: 'txn_abc123',
                    crypto_currency: 'BTC',
                    crypto_amount: 0.00456,
                    confirmations: 3,
                    tx_hash: '0x1234567890abcdef...'
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Payment link not found',
          content: {
            'application/json': {
              example: { message: 'Payment link not found', error: true }
            }
          }
        }
      }
    },
    put: {
      tags: ['Payments'],
      summary: 'Update payment link',
      description: 'Update an existing payment link (only active links can be updated)',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string', format: 'uuid' }
      }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                redirect_url: { type: 'string', format: 'uri' },
                webhook_url: { type: 'string', format: 'uri' },
                expires_at: { type: 'string', format: 'date-time' },
                status: { type: 'string', enum: ['active', 'cancelled'] }
              }
            },
            example: {
              description: 'Updated: Order #12345 - Premium Subscription (Discounted)',
              expires_at: '2024-02-15T23:59:59Z'
            }
          }
        }
      },
      responses: {
        200: { description: 'Payment link updated' },
        400: { description: 'Cannot update paid or expired links' },
        404: { description: 'Payment link not found' }
      }
    }
  },
  '/api/pay/deletePaymentLink/{id}': {
    delete: {
      tags: ['Payments'],
      summary: 'Delete payment link',
      description: 'Delete/cancel a payment link (only active unpaid links can be deleted)',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string', format: 'uuid' }
      }],
      responses: {
        200: {
          description: 'Payment link deleted',
          content: {
            'application/json': {
              example: { message: 'Payment link deleted successfully' }
            }
          }
        },
        400: { description: 'Cannot delete paid links' },
        404: { description: 'Payment link not found' }
      }
    }
  },

  // ==================== PAYMENT PROCESSING ====================
  '/api/pay/getData': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Get payment data',
      description: 'Retrieve payment information for checkout page. Called when customer opens a payment link.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment data retrieved',
          content: {
            'application/json': {
              example: {
                message: 'Payment data retrieved',
                data: {
                  transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  amount: 199.99,
                  currency: 'USD',
                  description: 'Order #12345 - Premium Subscription',
                  company: {
                    name: 'My Online Store',
                    logo: 'https://mystore.com/logo.png'
                  },
                  supported_currencies: ['BTC', 'ETH', 'USDT-TRC20', 'USDT-ERC20', 'TRX', 'LTC'],
                  status: 'pending',
                  expires_at: '2024-01-16T10:30:00Z'
                }
              }
            }
          }
        },
        404: {
          description: 'Payment not found or expired',
          content: {
            'application/json': {
              example: { message: 'Payment link not found or has expired', error: true }
            }
          }
        }
      }
    }
  },
  '/api/pay/createCryptoPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Initiate crypto payment',
      description: 'Customer selects cryptocurrency and receives a deposit address. The system monitors this address for incoming payments.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id', 'crypto_currency'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' },
                crypto_currency: { type: 'string', enum: ['BTC', 'ETH', 'USDT-TRC20', 'USDT-ERC20', 'TRX', 'LTC', 'DOGE'] },
                customer_email: { type: 'string', format: 'email', description: 'Optional: for payment receipt' }
              }
            },
            examples: {
              'Bitcoin Payment': {
                summary: 'Pay with BTC',
                value: {
                  transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  crypto_currency: 'BTC',
                  customer_email: 'customer@example.com'
                }
              },
              'USDT on Tron': {
                summary: 'Pay with USDT (TRC20)',
                value: {
                  transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  crypto_currency: 'USDT-TRC20'
                }
              },
              'Ethereum Payment': {
                summary: 'Pay with ETH',
                value: {
                  transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  crypto_currency: 'ETH',
                  customer_email: 'customer@example.com'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Crypto payment initiated - deposit address generated',
          content: {
            'application/json': {
              examples: {
                'BTC Response': {
                  summary: 'Bitcoin deposit address',
                  value: {
                    message: 'Crypto payment initiated',
                    data: {
                      deposit_address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
                      crypto_currency: 'BTC',
                      crypto_amount: 0.00456789,
                      usd_amount: 199.99,
                      exchange_rate: 43750.00,
                      qr_code: 'data:image/png;base64,iVBORw0KGgo...',
                      expires_at: '2024-01-15T11:30:00Z',
                      confirmations_required: 1,
                      network: 'Bitcoin Mainnet'
                    }
                  }
                },
                'USDT-TRC20 Response': {
                  summary: 'USDT TRC20 deposit address',
                  value: {
                    message: 'Crypto payment initiated',
                    data: {
                      deposit_address: 'TN7cWz1s5p5XKT8KJhKjZ8EWPH4v8hGhqN',
                      crypto_currency: 'USDT-TRC20',
                      crypto_amount: 199.99,
                      usd_amount: 199.99,
                      exchange_rate: 1.00,
                      qr_code: 'data:image/png;base64,iVBORw0KGgo...',
                      expires_at: '2024-01-15T11:30:00Z',
                      confirmations_required: 20,
                      network: 'Tron (TRC20)'
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid currency or payment already processed',
          content: {
            'application/json': {
              example: { message: 'Unsupported cryptocurrency', error: true }
            }
          }
        }
      }
    }
  },
  '/api/pay/verifyCryptoPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Verify crypto payment status',
      description: 'Check the status of a cryptocurrency payment. Poll this endpoint to show payment progress to customers.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment status retrieved',
          content: {
            'application/json': {
              examples: {
                'Awaiting Payment': {
                  summary: 'No payment received yet',
                  value: {
                    message: 'Payment status',
                    data: {
                      status: 'awaiting_payment',
                      deposit_address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
                      expected_amount: 0.00456789,
                      received_amount: 0,
                      crypto_currency: 'BTC',
                      expires_at: '2024-01-15T11:30:00Z'
                    }
                  }
                },
                'Confirming': {
                  summary: 'Payment received, awaiting confirmations',
                  value: {
                    message: 'Payment status',
                    data: {
                      status: 'confirming',
                      confirmations: 1,
                      confirmations_required: 3,
                      tx_hash: '7a91f8b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
                      received_amount: 0.00456789,
                      crypto_currency: 'BTC'
                    }
                  }
                },
                'Completed': {
                  summary: 'Payment confirmed and completed',
                  value: {
                    message: 'Payment status',
                    data: {
                      status: 'completed',
                      confirmations: 3,
                      tx_hash: '7a91f8b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
                      received_amount: 0.00456789,
                      crypto_currency: 'BTC',
                      completed_at: '2024-01-15T11:15:00Z',
                      redirect_url: 'https://mystore.com/order/12345/success'
                    }
                  }
                },
                'Partial Payment': {
                  summary: 'Insufficient amount received',
                  value: {
                    message: 'Payment status',
                    data: {
                      status: 'partial',
                      expected_amount: 0.00456789,
                      received_amount: 0.00400000,
                      remaining_amount: 0.00056789,
                      crypto_currency: 'BTC',
                      grace_period_ends: '2024-01-15T11:45:00Z'
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
  '/api/pay/confirmPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Confirm payment completion',
      description: 'Finalize and confirm a completed payment. Triggers webhook notification to merchant.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment confirmed',
          content: {
            'application/json': {
              example: {
                message: 'Payment confirmed successfully',
                data: {
                  status: 'completed',
                  redirect_url: 'https://mystore.com/order/12345/success'
                }
              }
            }
          }
        }
      }
    }
  },

  // ==================== FIAT PAYMENTS ====================
  '/api/pay/addPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Initiate fiat payment',
      description: 'Create fiat (card/bank) payment via Flutterwave',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id', 'payment_mode'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' },
                payment_mode: { type: 'string', enum: ['CARD', 'BANK'] },
                customer: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    name: { type: 'string' },
                    phone: { type: 'string' }
                  }
                }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              payment_mode: 'CARD',
              customer: {
                email: 'customer@example.com',
                name: 'John Doe',
                phone: '+1234567890'
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Fiat payment initiated',
          content: {
            'application/json': {
              example: {
                message: 'Payment initiated',
                data: {
                  payment_url: 'https://checkout.flutterwave.com/v3/hosted/pay/xyz123',
                  reference: 'FLW-TXN-123456'
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/verifyPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Verify fiat payment',
      description: 'Verify fiat payment status after redirect from payment provider',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment verification result',
          content: {
            'application/json': {
              examples: {
                'Successful': {
                  value: {
                    status: 'successful',
                    message: 'Payment completed',
                    data: { redirect_url: 'https://mystore.com/success' }
                  }
                },
                'Pending': {
                  value: {
                    status: 'pending',
                    message: 'Payment is being processed'
                  }
                },
                'Failed': {
                  value: {
                    status: 'failed',
                    message: 'Payment was declined'
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  // ==================== UTILITIES ====================
  '/api/pay/getCurrencyRates': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Get currency exchange rates',
      description: 'Retrieve current crypto-to-fiat exchange rates',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' }
              }
            },
            example: { from: 'USD', to: 'BTC' }
          }
        }
      },
      responses: {
        200: {
          description: 'Exchange rates',
          content: {
            'application/json': {
              example: {
                data: {
                  BTC: { rate: 0.0000228, usd_price: 43859.65 },
                  ETH: { rate: 0.000428, usd_price: 2336.45 },
                  'USDT-TRC20': { rate: 1.0, usd_price: 1.0 },
                  TRX: { rate: 9.52, usd_price: 0.105 },
                  LTC: { rate: 0.0143, usd_price: 69.93 }
                },
                timestamp: '2024-01-15T10:30:00Z'
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/network-fees': {
    get: {
      tags: ['Payment Processing'],
      summary: 'Get blockchain network fees',
      description: 'Retrieve current blockchain transaction fees for supported networks',
      parameters: [{
        in: 'query',
        name: 'currency',
        schema: { type: 'string', enum: ['BTC', 'ETH', 'TRX', 'LTC'] },
        required: true,
        example: 'BTC'
      }],
      responses: {
        200: {
          description: 'Network fees',
          content: {
            'application/json': {
              example: {
                data: {
                  currency: 'BTC',
                  slow: { fee: 5, time: '60 minutes', satoshi_per_byte: 10 },
                  medium: { fee: 12, time: '30 minutes', satoshi_per_byte: 25 },
                  fast: { fee: 25, time: '10 minutes', satoshi_per_byte: 50 }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/calculate-payment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Calculate payment amount',
      description: 'Calculate total payment including platform fees and network fees',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' },
                payment_method: { type: 'string', enum: ['CARD', 'CRYPTO'] },
                crypto_currency: { type: 'string' },
                fee_payer: { type: 'string', enum: ['customer', 'merchant'], default: 'merchant' }
              }
            },
            examples: {
              'Customer Pays Fees': {
                value: {
                  amount: 100,
                  currency: 'USD',
                  payment_method: 'CRYPTO',
                  crypto_currency: 'BTC',
                  fee_payer: 'customer'
                }
              },
              'Merchant Absorbs Fees': {
                value: {
                  amount: 100,
                  currency: 'USD',
                  payment_method: 'CRYPTO',
                  crypto_currency: 'USDT-TRC20',
                  fee_payer: 'merchant'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment calculation',
          content: {
            'application/json': {
              example: {
                data: {
                  subtotal: 100.00,
                  platform_fee: 1.50,
                  network_fee: 2.50,
                  total: 104.00,
                  merchant_receives: 98.50,
                  currency: 'USD',
                  crypto_amount: 0.00237,
                  crypto_currency: 'BTC'
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/getBalance': {
    get: {
      tags: ['Payment Processing'],
      summary: 'Get customer balance',
      description: 'Retrieve customer wallet balance',
      parameters: [{
        in: 'query',
        name: 'customer_id',
        schema: { type: 'string' },
        required: true
      }],
      responses: {
        200: {
          description: 'Balance retrieved',
          content: {
            'application/json': {
              example: {
                data: {
                  balances: [
                    { currency: 'BTC', balance: 0.05234, usd_value: 2295.12 },
                    { currency: 'ETH', balance: 1.234, usd_value: 2883.09 },
                    { currency: 'USDT', balance: 500.00, usd_value: 500.00 }
                  ],
                  total_usd: 5678.21
                }
              }
            }
          }
        }
      }
    }
  },

  // ==================== WEBHOOKS ====================
  '/api/pay/webhook/tatum': {
    post: {
      tags: ['Webhooks'],
      summary: 'Tatum blockchain webhook',
      description: 'Receives blockchain transaction notifications from Tatum. This endpoint is called automatically when deposits are detected.',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                subscriptionType: { type: 'string' },
                address: { type: 'string' },
                txId: { type: 'string' },
                amount: { type: 'string' },
                currency: { type: 'string' },
                blockNumber: { type: 'integer' }
              }
            },
            example: {
              subscriptionType: 'ADDRESS_TRANSACTION',
              address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
              txId: '7a91f8b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
              amount: '0.00456789',
              currency: 'BTC',
              blockNumber: 823456
            }
          }
        }
      },
      responses: {
        200: { description: 'Webhook processed' }
      }
    }
  },
  '/api/pay/getCurrencyRatesInternal': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Get internal currency rates',
      description: 'Internal endpoint for service-to-service rate queries',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                currencies: { type: 'array', items: { type: 'string' } }
              }
            },
            example: { currencies: ['BTC', 'ETH', 'USDT'] }
          }
        }
      },
      responses: {
        200: { description: 'Internal rates retrieved' }
      }
    }
  },
  '/api/pay/authStep': {
    post: {
      tags: ['Payment Processing'],
      summary: '3D Secure authentication',
      description: 'Handle 3D Secure authentication step for card payments',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                transaction_id: { type: 'string' },
                otp: { type: 'string' }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              otp: '123456'
            }
          }
        }
      },
      responses: {
        200: { description: 'Authentication successful' },
        400: { description: 'Invalid OTP' }
      }
    }
  }
};
