export const subscriptionPaths = {
  '/api/subscriptions': {
    get: {
      tags: ['Subscriptions'],
      summary: 'Get all subscriptions',
      description: 'Retrieve paginated list of subscriptions',
      security: [{ BearerAuth: [] }],
      parameters: [
        { in: 'query', name: 'company_id', schema: { type: 'integer' }, description: 'Filter by company' },
        { in: 'query', name: 'status', schema: { type: 'string', enum: ['active', 'paused', 'cancelled', 'expired'] } },
        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
        { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } }
      ],
      responses: {
        200: {
          description: 'Subscriptions retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      subscriptions: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Subscription' }
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized' }
      }
    },
    post: {
      tags: ['Subscriptions'],
      summary: 'Create a new subscription',
      description: 'Create a recurring payment subscription',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['customer_email', 'amount', 'currency', 'interval'],
              properties: {
                customer_email: { type: 'string', format: 'email' },
                customer_name: { type: 'string' },
                amount: { type: 'number', example: 29.99 },
                currency: { type: 'string', enum: ['USD', 'EUR', 'NGN'], default: 'USD' },
                interval: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'], example: 'monthly' },
                description: { type: 'string' },
                company_id: { type: 'integer' },
                start_date: { type: 'string', format: 'date' },
                end_date: { type: 'string', format: 'date' },
                metadata: { type: 'object' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Subscription created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: { $ref: '#/components/schemas/Subscription' }
                }
              }
            }
          }
        },
        400: { description: 'Invalid subscription data' }
      }
    }
  },
  '/api/subscriptions/{id}': {
    get: {
      tags: ['Subscriptions'],
      summary: 'Get subscription by ID',
      description: 'Retrieve detailed subscription information',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Subscription ID'
      }],
      responses: {
        200: {
          description: 'Subscription retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: { $ref: '#/components/schemas/Subscription' }
                }
              }
            }
          }
        },
        404: { description: 'Subscription not found' }
      }
    },
    put: {
      tags: ['Subscriptions'],
      summary: 'Update subscription',
      description: 'Update subscription status or details',
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
                status: { type: 'string', enum: ['active', 'paused', 'cancelled'] },
                amount: { type: 'number' },
                interval: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'] },
                end_date: { type: 'string', format: 'date' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Subscription updated' },
        400: { description: 'Invalid update data' },
        404: { description: 'Subscription not found' }
      }
    },
    delete: {
      tags: ['Subscriptions'],
      summary: 'Cancel subscription',
      description: 'Cancel an active subscription',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      responses: {
        200: { description: 'Subscription cancelled' },
        404: { description: 'Subscription not found' }
      }
    }
  }
};
