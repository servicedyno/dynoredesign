export const apiKeyPaths = {
  '/api/userApi/addApi': {
    post: {
      tags: ['API Keys'],
      summary: 'Create new API key',
      description: `Create a new API key for programmatic access to DynoPay services.
      
**Features:**
- Auto-generates secure API key
- Configurable rate limits
- Webhook URL for notifications
- Withdrawal whitelist for security`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['api_name'],
              properties: {
                api_name: {
                  type: 'string',
                  description: '✅ REQUIRED: Friendly name for the API key',
                  example: 'Production API'
                },
                base_currency: {
                  type: 'string',
                  enum: ['USD', 'EUR', 'NGN', 'GBP'],
                  description: '📝 OPTIONAL: Default currency for transactions',
                  default: 'USD'
                },
                webhook_url: {
                  type: 'string',
                  format: 'uri',
                  description: '📝 OPTIONAL: URL for payment notifications',
                  example: 'https://yourapp.com/webhooks/dynopay'
                },
                withdrawal_whitelist: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '📝 OPTIONAL: Approved withdrawal addresses',
                  example: ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa']
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'API key created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      api_id: { type: 'integer' },
                      api_key: { type: 'string', description: '⚠️ SAVE THIS - Only shown once!' },
                      api_name: { type: 'string' },
                      is_active: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid API configuration' },
        401: { description: 'Unauthorized' }
      }
    }
  },
  '/api/userApi/getApi': {
    get: {
      tags: ['API Keys'],
      summary: 'Get all API keys',
      description: `Retrieve all API keys for the authenticated user.
      
**Note:** API key values are masked for security.`,
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'API keys retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ApiKey' }
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
  '/api/userApi/getApi/{id}': {
    get: {
      tags: ['API Keys'],
      summary: 'Get API key details',
      description: `Retrieve specific API key configuration and usage statistics.
      
**Security Note:** The actual API key value is not returned for security reasons. Only the key configuration and metadata are shown.`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: '✅ REQUIRED: API key ID',
        example: 1
      }],
      responses: {
        200: {
          description: 'API key details retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'API key retrieved successfully' },
                  data: { $ref: '#/components/schemas/ApiKey' }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized' },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/updateApi/{id}': {
    put: {
      tags: ['API Keys'],
      summary: 'Update API key configuration',
      description: `Update API key settings such as name, currency, webhook, and withdrawal whitelist.
      
**Configurable Settings:**
- API name (for identification)
- Base currency (default currency for transactions)
- Withdrawal whitelist (approved wallet addresses)
- Webhook URL (for payment notifications)

**Security:** Whitelisted addresses add extra security by only allowing withdrawals to approved wallets.`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: '✅ REQUIRED: API key ID',
        example: 1
      }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                api_name: { 
                  type: 'string',
                  description: '📝 OPTIONAL: Friendly name for this API key',
                  example: 'Production API'
                },
                base_currency: { 
                  type: 'string', 
                  enum: ['USD', 'EUR', 'NGN', 'GBP'],
                  description: '📝 OPTIONAL: Default currency for API transactions',
                  example: 'USD'
                },
                withdrawal_whitelist: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: '📝 OPTIONAL: Approved wallet addresses for withdrawals (security feature)',
                  example: ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', '3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy']
                },
                webhook_url: { 
                  type: 'string', 
                  format: 'uri',
                  description: '📝 OPTIONAL: URL to receive payment webhooks/notifications',
                  example: 'https://yourapp.com/api/webhooks/payments'
                }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'API key updated' },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/regenerateKey/{id}': {
    post: {
      tags: ['API Keys'],
      summary: 'Regenerate API key',
      description: 'Generate a new API key (invalidates the old one)',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      responses: {
        200: {
          description: 'New API key generated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      apiKey: { type: 'string', description: 'New API key (shown only once)' }
                    }
                  }
                }
              }
            }
          }
        },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/toggleStatus/{id}': {
    put: {
      tags: ['API Keys'],
      summary: 'Toggle API key status',
      description: 'Enable or disable an API key',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      responses: {
        200: {
          description: 'API key status toggled',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      is_active: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/revoke/{id}': {
    post: {
      tags: ['API Keys'],
      summary: 'Revoke API key',
      description: 'Permanently revoke an API key',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      responses: {
        200: { description: 'API key revoked' },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/createPlan': {
    post: {
      tags: ['API Keys'],
      summary: 'Create API plan',
      description: 'Create a new pricing plan for API access',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['plan_name', 'rate_limit', 'price'],
              properties: {
                plan_name: { type: 'string', example: 'Premium' },
                description: { type: 'string' },
                rate_limit: { type: 'integer', example: 1000, description: 'Requests per minute' },
                price: { type: 'number', example: 99.99 },
                currency: { type: 'string', default: 'USD' },
                features: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Plan created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: { $ref: '#/components/schemas/ApiPlan' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/userApi/getPlans/{id}': {
    get: {
      tags: ['API Keys'],
      summary: 'Get API plans',
      description: 'Retrieve API plans for an API key',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'API key ID'
      }],
      responses: {
        200: {
          description: 'Plans retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      plans: { type: 'array', items: { $ref: '#/components/schemas/ApiPlan' } }
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
  '/api/userApi/updatePlan/{id}': {
    put: {
      tags: ['API Keys'],
      summary: 'Update API plan',
      description: 'Update an existing API plan',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Plan ID'
      }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                plan_name: { type: 'string' },
                rate_limit: { type: 'integer' },
                price: { type: 'number' },
                features: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Plan updated' },
        404: { description: 'Plan not found' }
      }
    }
  },
  '/api/userApi/deletePlan/{id}': {
    delete: {
      tags: ['API Keys'],
      summary: 'Delete API plan',
      description: 'Delete an API plan',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      responses: {
        200: { description: 'Plan deleted' },
        404: { description: 'Plan not found' }
      }
    }
  },
  '/api/userApi/getApiCustomers': {
    post: {
      tags: ['API Keys'],
      summary: 'Get API customers',
      description: 'Retrieve customers using your API',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                api_id: { type: 'integer' },
                page: { type: 'integer', default: 1 },
                limit: { type: 'integer', default: 20 }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Customers retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      customers: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            customer_id: { type: 'integer' },
                            email: { type: 'string' },
                            plan: { type: 'string' },
                            requests_count: { type: 'integer' },
                            last_request: { type: 'string', format: 'date-time' }
                          }
                        }
                      },
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
  '/api/userApi/updateCustomer/{id}': {
    put: {
      tags: ['API Keys'],
      summary: 'Update API customer',
      description: 'Update customer plan or settings',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                plan_id: { type: 'integer' },
                rate_limit_override: { type: 'integer' },
                is_active: { type: 'boolean' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Customer updated' },
        404: { description: 'Customer not found' }
      }
    }
  },
  '/api/userApi/deleteCustomer/{id}': {
    delete: {
      tags: ['API Keys'],
      summary: 'Delete API customer',
      description: 'Remove a customer from API access',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      responses: {
        200: { description: 'Customer deleted' },
        404: { description: 'Customer not found' }
      }
    }
  }
};
