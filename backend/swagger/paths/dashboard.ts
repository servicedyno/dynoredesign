export const dashboardPaths = {
  '/api/dashboard': {
    get: {
      tags: ['Dashboard'],
      summary: 'Get dashboard statistics',
      description: `Retrieve comprehensive dashboard statistics including transaction counts, volume, active wallets, and fee tier information.

**Authentication:** Requires JWT token (Bearer Auth).`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'company_id',
          schema: { type: 'integer' },
          description: 'Filter stats by company ID (optional, defaults to user\'s primary company)',
          example: 38
        }
      ],
      responses: {
        200: {
          description: 'Dashboard statistics retrieved successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DashboardStats' }
            }
          }
        },
        401: { description: 'Unauthorized - Invalid or missing JWT token' }
      }
    }
  },

  '/api/dashboard/chart': {
    get: {
      tags: ['Dashboard'],
      summary: 'Get volume chart data',
      description: `Retrieve transaction volume chart data for visualization. Returns time-series data grouped by the specified period.

**Authentication:** Requires JWT token (Bearer Auth).`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'period',
          schema: { type: 'string', enum: ['7d', '30d', '90d', '1y'] },
          description: 'Time period for chart data',
          example: '30d'
        },
        {
          in: 'query',
          name: 'company_id',
          schema: { type: 'integer' },
          description: 'Filter by company ID',
          example: 38
        }
      ],
      responses: {
        200: {
          description: 'Chart data retrieved successfully',
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
                        date: { type: 'string', format: 'date', example: '2026-02-01' },
                        volume: { type: 'number', example: 1250.50 },
                        count: { type: 'integer', example: 15 }
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

  '/api/dashboard/fee-tiers': {
    get: {
      tags: ['Dashboard'],
      summary: 'Get fee tiers information',
      description: `Retrieve fee tier information showing current tier, volume thresholds, and discount levels.

**Authentication:** Requires JWT token (Bearer Auth).`,
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Fee tiers retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      current_tier: { type: 'string', example: 'Starter' },
                      monthly_volume: { type: 'number', example: 500.00 },
                      tiers: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string', example: 'Starter' },
                            min_volume: { type: 'number', example: 0 },
                            max_volume: { type: 'number', example: 1000 },
                            percentage_fee: { type: 'number', example: 2.0 },
                            fixed_fee: { type: 'number', example: 3.0 }
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
        401: { description: 'Unauthorized' }
      }
    }
  },

  '/api/dashboard/recent-transactions': {
    get: {
      tags: ['Dashboard'],
      summary: 'Get recent transactions',
      description: `Retrieve the most recent transactions for the dashboard overview.

**Authentication:** Requires JWT token (Bearer Auth).`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
          description: 'Number of transactions to return (default: 10)',
          example: 10
        },
        {
          in: 'query',
          name: 'company_id',
          schema: { type: 'integer' },
          description: 'Filter by company ID',
          example: 38
        }
      ],
      responses: {
        200: {
          description: 'Recent transactions retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Transaction' }
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
};
