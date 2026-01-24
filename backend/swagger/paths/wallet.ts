export const walletPaths = {
  '/api/wallet/validateWalletAddress': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Validate wallet address',
      description: 'Validate cryptocurrency wallet address format',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['address', 'currency'],
              properties: {
                address: { type: 'string', example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
                currency: { type: 'string', enum: ['BTC', 'ETH', 'TRX', 'LTC'], example: 'BTC' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Address validated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  valid: { type: 'boolean' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/deleteWalletAddress': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Delete saved wallet address',
      description: 'Remove a saved wallet address',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['address_id'],
              properties: {
                address_id: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Address deleted successfully' }
      }
    }
  },
  '/api/wallet/getWalletTransactions/{id}': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Get wallet transactions',
      description: 'Retrieve transactions for a specific wallet',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string' },
        description: 'Wallet ID'
      }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                page: { type: 'number', default: 1 },
                limit: { type: 'number', default: 20 }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Transactions retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  transactions: { type: 'array', items: { type: 'object' } },
                  total: { type: 'number' },
                  page: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/addFunds': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Add funds to wallet',
      description: 'Initiate wallet top-up',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency', 'payment_method'],
              properties: {
                amount: { type: 'number', example: 100 },
                currency: { type: 'string', example: 'USD' },
                payment_method: { type: 'string', enum: ['CARD', 'BANK', 'CRYPTO'] }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Top-up initiated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  transaction_id: { type: 'string' },
                  status: { type: 'string' },
                  payment_url: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/withdrawAssets': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Withdraw funds',
      description: 'Withdraw funds from wallet',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency', 'destination'],
              properties: {
                amount: { type: 'number', example: 50 },
                currency: { type: 'string', example: 'BTC' },
                destination: { type: 'string', description: 'Wallet address or bank account' },
                otp: { type: 'string', description: 'OTP for verification' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Withdrawal initiated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  withdrawal_id: { type: 'string' },
                  status: { type: 'string', enum: ['pending', 'processing', 'completed'] }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/sendConfirmationOTP': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Send withdrawal OTP',
      description: 'Send OTP for withdrawal confirmation',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'OTP sent successfully' }
      }
    }
  },
  '/api/wallet/exchangeCreate': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Create currency exchange',
      description: 'Exchange one currency for another',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['from_currency', 'to_currency', 'amount'],
              properties: {
                from_currency: { type: 'string', example: 'USD' },
                to_currency: { type: 'string', example: 'BTC' },
                amount: { type: 'number', example: 100 }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Exchange created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  exchange_id: { type: 'string' },
                  rate: { type: 'number' },
                  from_amount: { type: 'number' },
                  to_amount: { type: 'number' },
                  expires_at: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/confirmExchange': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Confirm currency exchange',
      description: 'Confirm and execute currency exchange',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['exchange_id'],
              properties: {
                exchange_id: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Exchange confirmed' }
      }
    }
  },
  '/api/wallet/getExchange': {
    get: {
      tags: ['Wallet Management'],
      summary: 'Get exchange history',
      description: 'Retrieve currency exchange history',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Exchange history retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  exchanges: { type: 'array', items: { type: 'object' } }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/getCurrencyRates': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Get exchange rates',
      description: 'Get currency exchange rates',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                base: { type: 'string', example: 'USD' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Rates retrieved' }
      }
    }
  },
  '/api/wallet/estimateFees': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Estimate transaction fees',
      description: 'Estimate fees for a transaction',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency', 'type'],
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' },
                type: { type: 'string', enum: ['withdrawal', 'transfer', 'exchange'] }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Fees estimated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  network_fee: { type: 'number' },
                  platform_fee: { type: 'number' },
                  total_fee: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/network-fees': {
    get: {
      tags: ['Wallet Management'],
      summary: 'Get network fees',
      description: 'Get blockchain network fees',
      parameters: [{
        in: 'query',
        name: 'currency',
        schema: { type: 'string' },
        required: true
      }],
      responses: {
        200: { description: 'Network fees retrieved' }
      }
    }
  },
  '/api/wallet/calculate-payment': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Calculate payment',
      description: 'Calculate payment with fees',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Payment calculated' }
      }
    }
  },
  '/api/wallet/getUserAnalytics': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Get user analytics',
      description: 'Get wallet usage analytics',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Analytics retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  total_transactions: { type: 'number' },
                  total_volume: { type: 'number' },
                  balance: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/configured-currencies': {
    get: {
      tags: ['Wallet Management'],
      summary: 'Get available currencies',
      description: 'Get list of configured currencies',
      responses: {
        200: {
          description: 'Currencies retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fiat: { type: 'array', items: { type: 'string' } },
                  crypto: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/verifyCode': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Verify OTP code',
      description: 'Verify OTP for wallet operations',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code'],
              properties: {
                code: { type: 'string', example: '123456' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Code verified' },
        400: { description: 'Invalid code' }
      }
    }
  },
  '/api/wallet/authStep': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Authentication step',
      description: '3D Secure or OTP authentication',
      security: [{ BearerAuth: [] }],
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
  '/api/wallet/verifyPayment': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Verify payment',
      description: 'Verify wallet payment status',
      security: [{ BearerAuth: [] }],
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
        200: { description: 'Payment verified' }
      }
    }
  },
  '/api/wallet/confirmPayment': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Confirm payment',
      description: 'Confirm wallet payment',
      security: [{ BearerAuth: [] }],
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
  '/api/wallet/verifyCryptoPayment': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Verify crypto payment',
      description: 'Verify cryptocurrency payment',
      security: [{ BearerAuth: [] }],
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
        200: { description: 'Crypto payment verified' }
      }
    }
  }
};
