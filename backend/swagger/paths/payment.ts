export const paymentPaths = {
  '/api/pay/getData': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Get payment data',
      description: 'Retrieve payment information by transaction ID',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string', example: 'uuid' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment data retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/addPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Initiate fiat payment',
      description: 'Create fiat (card/bank) payment',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id', 'payment_mode'],
              properties: {
                transaction_id: { type: 'string' },
                payment_mode: { type: 'string', enum: ['CARD', 'BANK'], example: 'CARD' },
                customer: {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                    name: { type: 'string' },
                    phone: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Payment initiated' }
      }
    }
  },
  '/api/pay/createCryptoPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Initiate crypto payment',
      description: 'Create cryptocurrency payment',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id', 'crypto_currency'],
              properties: {
                transaction_id: { type: 'string' },
                crypto_currency: { type: 'string', enum: ['BTC', 'ETH', 'USDT', 'TRX'], example: 'BTC' },
                customer_email: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Crypto payment created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  address: { type: 'string', description: 'Deposit address' },
                  amount: { type: 'number' },
                  currency: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/authStep': {
    post: {
      tags: ['Payment Processing'],
      summary: '3D Secure authentication',
      description: 'Handle 3D Secure authentication step',
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
            }
          }
        }
      },
      responses: {
        200: { description: 'Authentication successful' }
      }
    }
  },
  '/api/pay/verifyPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Verify fiat payment',
      description: 'Verify fiat payment status',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment verified',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['pending', 'successful', 'failed'] },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/verifyCryptoPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Verify crypto payment',
      description: 'Verify cryptocurrency payment status',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Crypto payment verified',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  confirmations: { type: 'number' },
                  hash: { type: 'string' }
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
      description: 'Confirm and finalize payment',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Payment confirmed' }
      }
    }
  },
  '/api/pay/getBalance': {
    get: {
      tags: ['Payment Processing'],
      summary: 'Get customer balance',
      description: 'Retrieve customer account balance',
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
              schema: {
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
  },
  '/api/pay/getCurrencyRates': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Get currency exchange rates',
      description: 'Retrieve current exchange rates',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                from: { type: 'string', example: 'USD' },
                to: { type: 'string', example: 'BTC' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Rates retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rate: { type: 'number' },
                  timestamp: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/getCurrencyRatesInternal': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Get internal currency rates',
      description: 'Retrieve internal exchange rates (admin)',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                currencies: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Internal rates retrieved' }
      }
    }
  },
  '/api/pay/network-fees': {
    get: {
      tags: ['Payment Processing'],
      summary: 'Get blockchain network fees',
      description: 'Retrieve current blockchain transaction fees',
      parameters: [{
        in: 'query',
        name: 'currency',
        schema: { type: 'string', enum: ['BTC', 'ETH', 'TRX'] },
        required: true
      }],
      responses: {
        200: {
          description: 'Network fees retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  slow: { type: 'number' },
                  medium: { type: 'number' },
                  fast: { type: 'number' },
                  unit: { type: 'string', example: 'satoshi/byte' }
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
      description: 'Calculate total payment including fees',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: {
                amount: { type: 'number', example: 100 },
                currency: { type: 'string', example: 'USD' },
                payment_method: { type: 'string', enum: ['CARD', 'CRYPTO'] },
                fee_payer: { type: 'string', enum: ['customer', 'merchant'] }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment calculated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  subtotal: { type: 'number' },
                  fees: { type: 'number' },
                  total: { type: 'number' },
                  currency: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }
};
