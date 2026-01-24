export const adminPaths = {
  '/api/admin/login': {
    post: {
      tags: ['Admin'],
      summary: 'Admin login',
      description: 'Authenticate admin user and receive JWT token',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email', example: 'admin@dynopay.com' },
                password: { type: 'string', example: 'adminPassword123' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Login successful' },
                  data: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      admin: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Invalid credentials' }
      }
    }
  },
  '/api/admin/createWallets': {
    post: {
      tags: ['Admin'],
      summary: 'Create platform wallets',
      description: 'Create cryptocurrency wallets for the platform (admin only)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                currencies: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['BTC', 'ETH', 'TRX']
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Wallets created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      wallets: { type: 'array', items: { type: 'object' } }
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
  '/api/admin/withdrawAssets': {
    post: {
      tags: ['Admin'],
      summary: 'Withdraw assets from platform wallet',
      description: 'Withdraw cryptocurrency from platform wallets to external address',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['currency', 'amount', 'destination'],
              properties: {
                currency: { type: 'string', example: 'BTC' },
                amount: { type: 'number', example: 0.5 },
                destination: { type: 'string', description: 'External wallet address' }
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
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      withdrawal_id: { type: 'string' },
                      status: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Insufficient balance or invalid address' }
      }
    }
  },
  '/api/admin/getWallets': {
    get: {
      tags: ['Admin'],
      summary: 'Get platform wallets',
      description: 'Retrieve all platform cryptocurrency wallets and balances',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Wallets retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      wallets: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            currency: { type: 'string' },
                            address: { type: 'string' },
                            balance: { type: 'number' }
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
    }
  },
  '/api/admin/getAllTransactions': {
    get: {
      tags: ['Admin'],
      summary: 'Get all platform transactions',
      description: 'Retrieve all transactions across the platform with optional filters',
      security: [{ BearerAuth: [] }],
      parameters: [
        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
        { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
        { in: 'query', name: 'status', schema: { type: 'string', enum: ['pending', 'done', 'failed'] } },
        { in: 'query', name: 'currency', schema: { type: 'string' } },
        { in: 'query', name: 'startDate', schema: { type: 'string', format: 'date' } },
        { in: 'query', name: 'endDate', schema: { type: 'string', format: 'date' } }
      ],
      responses: {
        200: {
          description: 'Transactions retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
                      pagination: { $ref: '#/components/schemas/Pagination' }
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
  '/api/admin/getAllUsers': {
    get: {
      tags: ['Admin'],
      summary: 'Get all users',
      description: 'Retrieve all registered users with pagination',
      security: [{ BearerAuth: [] }],
      parameters: [
        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
        { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
        { in: 'query', name: 'status', schema: { type: 'string' } },
        { in: 'query', name: 'search', schema: { type: 'string', description: 'Search by name or email' } }
      ],
      responses: {
        200: {
          description: 'Users retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      users: { type: 'array', items: { $ref: '#/components/schemas/User' } },
                      pagination: { $ref: '#/components/schemas/Pagination' }
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
  '/api/admin/getAdminAnalytics': {
    post: {
      tags: ['Admin'],
      summary: 'Get platform analytics',
      description: 'Retrieve platform-wide analytics and statistics',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                period: { type: 'string', enum: ['7d', '30d', '90d', '1y'], default: '30d' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Analytics retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      total_users: { type: 'integer' },
                      total_transactions: { type: 'integer' },
                      total_volume: { type: 'number' },
                      total_fees_collected: { type: 'number' },
                      new_users_period: { type: 'integer' },
                      active_users_period: { type: 'integer' }
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
  '/api/admin/getTransferFees': {
    get: {
      tags: ['Admin'],
      summary: 'Get transfer fee configuration',
      description: 'Retrieve current transfer fee settings',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Transfer fees retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      fees: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            currency: { type: 'string' },
                            fee_percentage: { type: 'number' },
                            min_fee: { type: 'number' },
                            max_fee: { type: 'number' }
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
    }
  },
  '/api/admin/updateTransferFees': {
    put: {
      tags: ['Admin'],
      summary: 'Update transfer fee configuration',
      description: 'Update transfer fee settings for currencies',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['currency', 'fee_percentage'],
              properties: {
                currency: { type: 'string', example: 'BTC' },
                fee_percentage: { type: 'number', example: 1.5 },
                min_fee: { type: 'number' },
                max_fee: { type: 'number' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Transfer fees updated' },
        400: { description: 'Invalid fee configuration' }
      }
    }
  },
  '/api/admin/getFeeWalletBalance': {
    get: {
      tags: ['Admin'],
      summary: 'Get fee wallet balance',
      description: 'Retrieve balance of collected platform fees',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Fee wallet balance retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      balances: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            currency: { type: 'string' },
                            balance: { type: 'number' },
                            usd_value: { type: 'number' }
                          }
                        }
                      },
                      total_usd: { type: 'number' }
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
  '/api/admin/newTransactionFee': {
    post: {
      tags: ['Admin'],
      summary: 'Create new transaction fee tier',
      description: 'Add a new transaction fee tier configuration',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['tier_name', 'min_volume', 'max_volume', 'fee_percentage'],
              properties: {
                tier_name: { type: 'string', example: 'Premium' },
                min_volume: { type: 'number', example: 10000 },
                max_volume: { type: 'number', example: 50000 },
                fee_percentage: { type: 'number', example: 0.5 }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Transaction fee tier created' },
        400: { description: 'Invalid fee tier configuration' }
      }
    }
  },
  '/api/admin/getTransactionFee': {
    get: {
      tags: ['Admin'],
      summary: 'Get transaction fee tiers',
      description: 'Retrieve all transaction fee tier configurations',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Transaction fee tiers retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      tiers: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            tier_id: { type: 'integer' },
                            tier_name: { type: 'string' },
                            min_volume: { type: 'number' },
                            max_volume: { type: 'number' },
                            fee_percentage: { type: 'number' }
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
    }
  },
  '/api/admin/updateFeeLimits': {
    put: {
      tags: ['Admin'],
      summary: 'Update fee limits',
      description: 'Update minimum and maximum fee limits',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                tier_id: { type: 'integer' },
                min_fee: { type: 'number' },
                max_fee: { type: 'number' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Fee limits updated' }
      }
    }
  },
  '/api/admin/changePassword': {
    put: {
      tags: ['Admin'],
      summary: 'Change admin password',
      description: 'Update admin account password',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['oldPassword', 'newPassword'],
              properties: {
                oldPassword: { type: 'string' },
                newPassword: { type: 'string', minLength: 8 }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Password changed successfully' },
        401: { description: 'Current password is incorrect' }
      }
    }
  },
  '/api/admin/updateEmail': {
    put: {
      tags: ['Admin'],
      summary: 'Update admin email',
      description: 'Update admin account email address',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['newEmail', 'password'],
              properties: {
                newEmail: { type: 'string', format: 'email' },
                password: { type: 'string', description: 'Current password for verification' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Email updated successfully' },
        400: { description: 'Email already in use' },
        401: { description: 'Invalid password' }
      }
    }
  }
};
