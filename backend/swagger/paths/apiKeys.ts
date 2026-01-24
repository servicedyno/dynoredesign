export const apiKeyPaths = {
  '/api/userApi/getApi/{id}': {
    get: {
      tags: ['API Keys'],
      summary: 'Get API key by ID',
      description: 'Retrieve specific API key details',
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
          description: 'API key retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: { $ref: '#/components/schemas/ApiKey' }
                }
              }
            }
          }
        },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/updateApi/{id}': {
    put: {
      tags: ['API Keys'],
      summary: 'Update API key',
      description: 'Update API key configuration',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                api_name: { type: 'string' },
                base_currency: { type: 'string', enum: ['USD', 'EUR', 'NGN'] },
                withdrawal_whitelist: { type: 'array', items: { type: 'string' } },
                webhook_url: { type: 'string', format: 'uri' }
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
