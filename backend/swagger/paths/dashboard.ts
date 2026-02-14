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

**Authentication:** Requires JWT token (Bearer Auth).
**Multi-Tenant:** company_id is validated against user ownership.`,
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

  '/api/dashboard/conversions': {
    get: {
      tags: ['Conversion Tracker'],
      summary: 'List conversion records',
      description: `Retrieve crypto-to-stablecoin conversion records with pipeline status. Each conversion tracks the full lifecycle: Detected → Sweeping → Depositing → Converting → Withdrawing → Complete.

**Multi-Tenant:** Requires \`company_id\` for proper scoping. Validates ownership — returns 403 if the company doesn't belong to the authenticated user.
**Authentication:** Requires JWT token (Bearer Auth).`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'company_id',
          schema: { type: 'integer' },
          description: 'Scope to a specific company (validated against user ownership)',
          example: 38
        },
        {
          in: 'query',
          name: 'status',
          schema: { type: 'string', enum: ['PENDING_DEPOSIT', 'DEPOSIT_CREDITED', 'CONVERTING', 'CONVERTED', 'WITHDRAWING', 'COMPLETED', 'FAILED'] },
          description: 'Filter by conversion status',
        },
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          description: 'Number of records to return',
          example: 20
        }
      ],
      responses: {
        200: {
          description: 'Conversions retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Conversions retrieved successfully' },
                  data: {
                    type: 'object',
                    properties: {
                      conversions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            conversion_id: { type: 'integer', example: 11 },
                            transaction_id: { type: 'integer', example: 1404 },
                            company_id: { type: 'integer', example: 38 },
                            company_name: { type: 'string', example: 'Bozzmail' },
                            source_currency: { type: 'string', example: 'ETH' },
                            source_amount: { type: 'string', example: '0.005650' },
                            source_amount_usd: { type: 'string', example: '10.00' },
                            target_currency: { type: 'string', example: 'USDT' },
                            target_amount: { type: 'string', example: '9.98' },
                            status: { type: 'string', example: 'COMPLETED' },
                            pipeline_stage: {
                              type: 'string',
                              enum: ['DETECTED', 'SWEEPING', 'DEPOSITING', 'CONVERTING', 'WITHDRAWING', 'COMPLETE', 'FAILED'],
                              example: 'COMPLETE',
                              description: 'User-facing pipeline stage mapped from internal status'
                            },
                            merchant_payout_usd: { type: 'string', example: '9.41' },
                            conversion_fee: { type: 'string', example: '0.15', description: 'Platform fee (1.5%) in USD' },
                            sweep_fee_usd: { type: 'string', example: '0.30', description: 'On-chain gas fee in USD' },
                            withdrawal_fee: { type: 'string', example: '0.10', description: 'Exchange withdrawal fee in USD' },
                            error_message: { type: 'string', nullable: true },
                            createdAt: { type: 'string', format: 'date-time' },
                            deposit_confirmed_at: { type: 'string', format: 'date-time', nullable: true },
                            converted_at: { type: 'string', format: 'date-time', nullable: true },
                            withdrawn_at: { type: 'string', format: 'date-time', nullable: true },
                            completed_at: { type: 'string', format: 'date-time', nullable: true },
                          }
                        }
                      },
                      count: { type: 'integer', example: 5 },
                      status_summary: {
                        type: 'object',
                        description: 'Count of conversions per status',
                        example: { COMPLETED: 5, FAILED: 2, PENDING_DEPOSIT: 1 }
                      },
                      pipeline_stages: {
                        type: 'array',
                        items: { type: 'string' },
                        example: ['DETECTED', 'SWEEPING', 'DEPOSITING', 'CONVERTING', 'WITHDRAWING', 'COMPLETE'],
                        description: 'Ordered pipeline stages for frontend rendering'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized - Invalid or missing JWT token' },
        403: { description: 'Forbidden - Company does not belong to the authenticated user' }
      }
    }
  },

  '/api/dashboard/conversions/{id}': {
    get: {
      tags: ['Conversion Tracker'],
      summary: 'Get conversion detail with timeline',
      description: `Retrieve a single conversion record with a detailed timeline and fee breakdown. The timeline maps the conversion through 6 stages: **Detected → Sweeping → Depositing → Converting → Withdrawing → Complete**.

**Multi-Tenant:** Optionally pass \`company_id\` for ownership validation. The conversion must belong to the authenticated user.
**Authentication:** Requires JWT token (Bearer Auth).`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'integer' },
          description: 'Conversion ID',
          example: 11
        },
        {
          in: 'query',
          name: 'company_id',
          schema: { type: 'integer' },
          description: 'Company ID for ownership validation (optional but recommended)',
          example: 38
        }
      ],
      responses: {
        200: {
          description: 'Conversion detail retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Conversion detail retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      conversion: {
                        type: 'object',
                        description: 'Full conversion record including all fields from the list endpoint plus company_name',
                      },
                      timeline: {
                        type: 'array',
                        description: 'Ordered pipeline stages with completion status',
                        items: {
                          type: 'object',
                          properties: {
                            stage: { type: 'string', example: 'DETECTED' },
                            label: { type: 'string', example: 'Detected' },
                            timestamp: { type: 'string', format: 'date-time', nullable: true },
                            completed: { type: 'boolean', example: true },
                            active: { type: 'boolean', example: false, description: 'True for the current stage only' },
                          }
                        },
                        example: [
                          { stage: 'DETECTED', label: 'Detected', timestamp: '2026-02-14T11:00:00Z', completed: true, active: false },
                          { stage: 'SWEEPING', label: 'Sweeping', timestamp: '2026-02-14T11:00:00Z', completed: true, active: false },
                          { stage: 'DEPOSITING', label: 'Depositing', timestamp: '2026-02-14T11:05:00Z', completed: true, active: false },
                          { stage: 'CONVERTING', label: 'Converting', timestamp: '2026-02-14T11:10:00Z', completed: true, active: false },
                          { stage: 'WITHDRAWING', label: 'Withdrawing', timestamp: '2026-02-14T11:15:00Z', completed: true, active: false },
                          { stage: 'COMPLETE', label: 'Complete', timestamp: '2026-02-14T11:20:00Z', completed: true, active: true },
                        ]
                      },
                      fee_breakdown: {
                        type: 'object',
                        properties: {
                          platform_fee_usd: { type: 'number', example: 0.15, description: '1.5% platform fee' },
                          sweep_gas_fee_usd: { type: 'number', example: 0.30, description: 'On-chain gas cost' },
                          trade_fee_usd: { type: 'number', example: 0.01, description: 'Exchange trade fee' },
                          withdrawal_fee_usd: { type: 'number', example: 0.10, description: 'Exchange withdrawal fee' },
                          gross_sale_usd: { type: 'number', example: 9.98, description: 'Total sale amount before fees' },
                          net_payout_usd: { type: 'number', example: 9.41, description: 'Final merchant payout after all deductions' },
                        }
                      },
                      is_failed: { type: 'boolean', example: false },
                      is_complete: { type: 'boolean', example: true },
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden - Company does not belong to the authenticated user' },
        404: { description: 'Conversion not found or does not belong to user' }
      }
    }
  },
};
