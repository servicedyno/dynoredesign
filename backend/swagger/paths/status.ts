/**
 * @swagger
 * tags:
 *   - name: Status
 *     description: System status and infrastructure monitoring
 *   - name: Invoices
 *     description: Invoice management and PDF generation
 *   - name: KYC
 *     description: Know Your Customer verification
 *   - name: Transactions
 *     description: Transaction management and export
 */

/**
 * @swagger
 * /api/status:
 *   get:
 *     tags: [Status]
 *     summary: Get overall system status
 *     description: Returns real-time status of all DynoPay services with uptime metrics. Triggers health checks on all services.
 *     responses:
 *       200:
 *         description: System status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Status retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     overall_status:
 *                       type: string
 *                       enum: [operational, degraded, partial_outage]
 *                       example: "operational"
 *                     status_message:
 *                       type: string
 *                       example: "All Systems Operational"
 *                     services:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ServiceStatus'
 *                     last_updated:
 *                       type: string
 *                       format: date-time
 *
 * /api/status/health:
 *   get:
 *     tags: [Status]
 *     summary: Simple health check
 *     description: Quick health check endpoint for load balancers and monitoring systems
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *       503:
 *         description: System is unhealthy
 *
 * /api/status/check:
 *   post:
 *     tags: [Status]
 *     summary: Manually trigger health checks
 *     description: Runs health checks on all monitored services and stores results in database
 *     responses:
 *       200:
 *         description: Health checks completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Health checks completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ServiceHealthResult'
 *
 * /api/status/services:
 *   get:
 *     tags: [Status]
 *     summary: Get all services status
 *     description: Returns detailed status for all monitored services with uptime percentages
 *     responses:
 *       200:
 *         description: Services status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     services:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ServiceDetailedStatus'
 *
 * /api/status/services/uptime:
 *   get:
 *     tags: [Status]
 *     summary: Get uptime history for all services
 *     description: Returns historical uptime data for all services with daily breakdown
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 90
 *         description: Number of days of history (default 90)
 *     responses:
 *       200:
 *         description: Services uptime data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     services:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ServiceUptimeHistory'
 *
 * /api/status/service/{serviceId}:
 *   get:
 *     tags: [Status]
 *     summary: Get specific service status
 *     description: Returns detailed status for a single service
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [api_gateway, payment_processing, wallet_services, webhook_delivery, dashboard]
 *         description: Service identifier
 *     responses:
 *       200:
 *         description: Service status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceDetailedStatus'
 *       404:
 *         description: Service not found
 *
 * /api/status/service/{serviceId}/uptime:
 *   get:
 *     tags: [Status]
 *     summary: Get uptime history for specific service
 *     description: Returns historical uptime data for a single service with daily breakdown
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [api_gateway, payment_processing, wallet_services, webhook_delivery, dashboard]
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 90
 *         description: Number of days of history
 *     responses:
 *       200:
 *         description: Service uptime data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceUptimeHistory'
 *       404:
 *         description: Service not found
 *
 * /api/status/uptime:
 *   get:
 *     tags: [Status]
 *     summary: Get overall system uptime
 *     description: Returns aggregated uptime data across all services
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 90
 *         description: Number of days of history
 *     responses:
 *       200:
 *         description: System uptime data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     period_days:
 *                       type: integer
 *                       example: 90
 *                     uptime_percentage:
 *                       type: string
 *                       example: "99.95"
 *                     summary:
 *                       type: object
 *                       properties:
 *                         operational_days:
 *                           type: integer
 *                         degraded_days:
 *                           type: integer
 *                         outage_days:
 *                           type: integer
 *                     daily_status:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           status:
 *                             type: string
 *                             enum: [operational, degraded, outage, no_data]
 *
 * /api/status/incidents:
 *   get:
 *     tags: [Status]
 *     summary: Get recent incidents
 *     description: Returns list of recent system incidents and maintenance events
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [resolved, investigating, identified, monitoring]
 *     responses:
 *       200:
 *         description: Incidents retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     incidents:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Incident'
 *
 * /api/status/incidents/{id}:
 *   get:
 *     tags: [Status]
 *     summary: Get specific incident
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Incident retrieved
 *       404:
 *         description: Incident not found
 */

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     tags: [Invoices]
 *     summary: Get all invoices
 *     description: Returns paginated list of invoices for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: integer
 *         description: Filter by company
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, sent, paid, cancelled]
 *     responses:
 *       200:
 *         description: Invoices retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     invoices:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Invoice'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *
 * /api/invoices/{id}:
 *   get:
 *     tags: [Invoices]
 *     summary: Get invoice by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
 *       404:
 *         description: Invoice not found
 *
 * /api/invoices/{id}/pdf:
 *   get:
 *     tags: [Invoices]
 *     summary: Download invoice as PDF
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Invoice not found
 *
 * /api/transactions/{transactionId}/invoice:
 *   get:
 *     tags: [Invoices]
 *     summary: Get invoice for a transaction
 *     description: Returns invoice associated with a specific transaction, auto-generates if not exists
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice retrieved or generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
 *       404:
 *         description: Transaction not found
 */

/**
 * @swagger
 * /api/wallet/getAllTransactions:
 *   post:
 *     tags: [Transactions]
 *     summary: Get all transactions with filters
 *     description: Returns paginated transactions with optional filtering
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               page:
 *                 type: integer
 *                 default: 1
 *               rowsPerPage:
 *                 type: integer
 *                 default: 10
 *               status:
 *                 type: string
 *                 enum: [pending, done, failed, expired]
 *               currency:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               company_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Transactions retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Transaction'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *
 * /api/wallet/transaction/{id}:
 *   get:
 *     tags: [Transactions]
 *     summary: Get transaction details
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction details retrieved
 *       404:
 *         description: Transaction not found
 *
 * /api/wallet/transactions/export:
 *   post:
 *     tags: [Transactions]
 *     summary: Export transactions to CSV
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *               company_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */

/**
 * @swagger
 * /api/pay/createPaymentLink:
 *   post:
 *     tags: [Payments]
 *     summary: Create a payment link
 *     description: Creates a new payment link for accepting payments
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, amount, modes]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Customer email
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               base_currency:
 *                 type: string
 *                 enum: [USD, EUR, NGN]
 *                 default: USD
 *               modes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [CRYPTO, CARD, BANK_TRANSFER, USSD, MOBILE_MONEY]
 *                 description: Allowed payment methods
 *               description:
 *                 type: string
 *               expire:
 *                 type: string
 *                 enum: [1h, 24h, 7d, 30d, never]
 *                 default: 7d
 *               fee_payer:
 *                 type: string
 *                 enum: [customer, company]
 *                 default: company
 *               company_id:
 *                 type: integer
 *               callback_url:
 *                 type: string
 *                 format: uri
 *               redirect_url:
 *                 type: string
 *                 format: uri
 *               webhook_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Payment link created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentLink'
 *
 * /api/pay/getPaymentLinks:
 *   get:
 *     tags: [Payments]
 *     summary: Get all payment links
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, paid, expired]
 *     responses:
 *       200:
 *         description: Payment links retrieved
 *
 * /api/pay/links/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment link details
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment link retrieved
 *       404:
 *         description: Payment link not found
 *   put:
 *     tags: [Payments]
 *     summary: Update payment link
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               expire:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment link updated
 *
 * /api/pay/deletePaymentLink/{id}:
 *   delete:
 *     tags: [Payments]
 *     summary: Delete payment link
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment link deleted
 */

/**
 * @swagger
 * /api/kyc/status:
 *   get:
 *     tags: [KYC]
 *     summary: Get KYC verification status
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: KYC status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KYCStatus'
 *
 * /api/kyc/submit:
 *   post:
 *     tags: [KYC]
 *     summary: Submit KYC documents
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               document_type:
 *                 type: string
 *                 enum: [passport, national_id, drivers_license]
 *               document_front:
 *                 type: string
 *                 format: binary
 *               document_back:
 *                 type: string
 *                 format: binary
 *               selfie:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: KYC submitted for review
 *       400:
 *         description: Invalid documents
 */

/**
 * @swagger
 * /api/company/getCompany:
 *   get:
 *     tags: [Company]
 *     summary: Get user companies
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Companies retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Company'
 *
 * /api/company/addCompany:
 *   post:
 *     tags: [Company]
 *     summary: Create a new company
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [company_name, email]
 *             properties:
 *               company_name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               website:
 *                 type: string
 *               address_line1:
 *                 type: string
 *               address_line2:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               country:
 *                 type: string
 *               zip_code:
 *                 type: string
 *               vat_number:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Company created
 *
 * /api/company/updateCompany/{id}:
 *   put:
 *     tags: [Company]
 *     summary: Update company details
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               company_name:
 *                 type: string
 *               email:
 *                 type: string
 *               website:
 *                 type: string
 *               vat_number:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Company updated
 *
 * /api/company/deleteCompany/{id}:
 *   delete:
 *     tags: [Company]
 *     summary: Delete company
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Company deleted
 *
 * /api/company/validateTaxId:
 *   post:
 *     tags: [Company]
 *     summary: Validate TAX ID/VAT Number
 *     description: Validates a TAX ID/VAT number using APILayer Tax Data API. This endpoint can be used before company creation to verify the tax ID is valid and registered.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vat_number, country_code]
 *             properties:
 *               vat_number:
 *                 type: string
 *                 description: Tax ID / VAT number to validate
 *                 example: "PT123456789"
 *               country_code:
 *                 type: string
 *                 description: ISO 2-letter country code
 *                 example: "PT"
 *           examples:
 *             Portugal VAT:
 *               summary: Validate Portuguese VAT
 *               value:
 *                 vat_number: "PT123456789"
 *                 country_code: "PT"
 *             German VAT:
 *               summary: Validate German VAT
 *               value:
 *                 vat_number: "DE123456789"
 *                 country_code: "DE"
 *     responses:
 *       200:
 *         description: Tax ID validation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     vat_number:
 *                       type: string
 *                     country_code:
 *                       type: string
 *                     valid:
 *                       type: boolean
 *                       description: Whether the tax ID is valid and registered
 *                     format_valid:
 *                       type: boolean
 *                       description: Whether the format is valid for the country
 *                     company_name:
 *                       type: string
 *                       description: Registered company name (if valid)
 *                     company_address:
 *                       type: string
 *                       description: Registered company address (if valid)
 *                     message:
 *                       type: string
 *                       description: Human-readable result message
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Tax validation service not configured
 */

/**
 * @swagger
 * /api/tax/lookup:
 *   get:
 *     tags: [Tax]
 *     summary: Lookup tax rate by country name
 *     parameters:
 *       - in: query
 *         name: country
 *         required: true
 *         schema:
 *           type: string
 *         description: Country name (e.g., "Portugal", "Germany")
 *     responses:
 *       200:
 *         description: Tax rate found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaxRate'
 *       404:
 *         description: Country not found
 */

export {};
