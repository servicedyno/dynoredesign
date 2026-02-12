/**
 * @swagger
 * /api/company/addCompany:
 *   post:
 *     tags:
 *       - Company Management
 *     summary: Create a new company profile
 *     description: |
 *       Create a new company profile for the authenticated user. 
 *       
 *       **📝 Authentication Required**: 
 *       1. Login using `/api/user/login` endpoint
 *       2. Copy the JWT token from response
 *       3. Click "Authorize" button above
 *       4. Paste token (without "Bearer" prefix)
 *       
 *       **💡 How to Use in Swagger UI:**
 *       1. Click "Try it out"
 *       2. Fill in the form fields below (company_name and email are required)
 *       3. Optionally upload a company logo
 *       4. Click "Execute"
 *       
 *       **Note**: The form data will be automatically converted to the required format.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - company_name
 *               - email
 *             properties:
 *               company_name:
 *                 type: string
 *                 description: Company legal name (required)
 *                 example: My Company Ltd
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Company contact email (required)
 *                 example: contact@company.com
 *               mobile:
 *                 type: string
 *                 description: Company phone number (optional)
 *                 example: '+1234567890'
 *               website:
 *                 type: string
 *                 format: uri
 *                 description: Company website (optional)
 *                 example: 'https://company.com'
 *               address_line1:
 *                 type: string
 *                 description: Street address (optional)
 *                 example: '123 Main Street'
 *               address_line2:
 *                 type: string
 *                 description: Additional address info (optional)
 *                 example: 'Suite 100'
 *               city:
 *                 type: string
 *                 description: City (optional)
 *                 example: 'New York'
 *               state:
 *                 type: string
 *                 description: State/Province (optional)
 *                 example: 'NY'
 *               country:
 *                 type: string
 *                 description: Country code (ISO 2-letter, optional)
 *                 example: 'US'
 *               zip_code:
 *                 type: string
 *                 description: Postal/ZIP code (optional)
 *                 example: '10001'
 *               vat_number:
 *                 type: string
 *                 description: VAT/Tax ID (optional, will be validated if provided)
 *                 example: ''
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Company logo (optional, PNG/JPG)
 *               overpayment_threshold_usd:
 *                 type: number
 *                 format: float
 *                 description: '💰 Min overpayment (USD) to trigger special handling. Default: $5.00. **Payment Links only** — Direct API ignores this.'
 *                 example: 5.00
 *               underpayment_threshold_usd:
 *                 type: number
 *                 format: float
 *                 description: '💰 Max underpayment (USD) to accept as full payment. Default: $1.00. **Payment Links only** — Direct API ignores this.'
 *                 example: 1.00
 *               grace_period_minutes:
 *                 type: integer
 *                 description: '⏱️ Time (minutes) for partial payment completion. Default: 30, max: 30. **Payment Links only** — Direct API ignores this.'
 *                 example: 30
 *     responses:
 *       200:
 *         description: Company created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     company_id:
 *                       type: integer
 *                     company_name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     mobile:
 *                       type: string
 *                     address_line1:
 *                       type: string
 *                     vat_verified:
 *                       type: boolean
 *       400:
 *         description: Invalid input or missing required fields
 *       401:
 *         description: Authentication required - Please login first
 *       500:
 *         description: Server error
 * 
 * /api/company/getCompany:
 *   get:
 *     tags:
 *       - Company Management
 *     summary: Get all companies for authenticated user
 *     description: Retrieve all companies associated with the authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of companies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Authentication required
 * 
 * /api/company/getCompany/{id}:
 *   get:
 *     tags:
 *       - Company Management
 *     summary: Get company by ID
 *     description: |
 *       Retrieve a specific company by its ID.
 *       
 *       **Payment Settings in Response (Payment Links only — Direct API ignores these):**
 *       - `overpayment_threshold_usd`: Min overpayment to trigger handling (null = default $5)
 *       - `underpayment_threshold_usd`: Max underpayment to accept as full (null = default $1)
 *       - `grace_period_minutes`: Time for partial payment completion (null = default 30 min, max 30)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Company details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     company_id:
 *                       type: integer
 *                       example: 38
 *                     company_name:
 *                       type: string
 *                       example: "My Company"
 *                     email:
 *                       type: string
 *                       example: "contact@company.com"
 *                     overpayment_threshold_usd:
 *                       type: number
 *                       nullable: true
 *                       description: "Minimum overpayment (USD) to trigger handling. Payment Links only. null = default $5"
 *                       example: 5.00
 *                     underpayment_threshold_usd:
 *                       type: number
 *                       nullable: true
 *                       description: "Maximum underpayment (USD) to accept as full. Payment Links only. null = default $1"
 *                       example: 1.00
 *                     grace_period_minutes:
 *                       type: integer
 *                       nullable: true
 *                       description: "Time (minutes) for partial payment. Payment Links only. Max 30. null = default 30"
 *                       example: 30
 *       404:
 *         description: Company not found
 *       401:
 *         description: Authentication required
 * 
 * /api/company/updateCompany/{id}:
 *   put:
 *     tags:
 *       - Company Management
 *     summary: Update company information
 *     description: |
 *       Update an existing company profile including payment threshold settings.
 *       
 *       **Required Fields:** company_name and email must always be provided
 *       
 *       **💰 Payment Settings (apply to Payment Links only — Direct API ignores these):**
 *       - `overpayment_threshold_usd`: Min overpayment to trigger handling (default: $5)
 *       - `underpayment_threshold_usd`: Max underpayment to accept as full (default: $1)
 *       - `grace_period_minutes`: Time for customer to complete partial payment (default: 30 min, max: 30 min)
 *       
 *       **💡 Swagger UI Usage:**
 *       1. Click "Try it out"
 *       2. Enter company ID
 *       3. Fill in company_name and email (required)
 *       4. Fill any other fields you want to update
 *       5. Click "Execute"
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *         example: 38
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - company_name
 *               - email
 *             properties:
 *               company_name:
 *                 type: string
 *                 description: '✅ REQUIRED: Company legal name'
 *                 example: Updated Company Name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: '✅ REQUIRED: Company contact email'
 *                 example: newemail@company.com
 *               mobile:
 *                 type: string
 *                 description: '📝 OPTIONAL: Company phone number'
 *                 example: '+1234567890'
 *               website:
 *                 type: string
 *                 format: uri
 *                 description: '📝 OPTIONAL: Company website'
 *                 example: 'https://company.com'
 *               address_line1:
 *                 type: string
 *                 description: '📝 OPTIONAL: Street address'
 *                 example: '123 Main Street'
 *               address_line2:
 *                 type: string
 *                 description: '📝 OPTIONAL: Additional address info'
 *                 example: 'Suite 100'
 *               city:
 *                 type: string
 *                 description: '📝 OPTIONAL: City'
 *                 example: 'New York'
 *               state:
 *                 type: string
 *                 description: '📝 OPTIONAL: State/Province'
 *                 example: 'NY'
 *               country:
 *                 type: string
 *                 description: '📝 OPTIONAL: Country code (ISO 2-letter)'
 *                 example: 'US'
 *               zip_code:
 *                 type: string
 *                 description: '📝 OPTIONAL: Postal/ZIP code'
 *                 example: '10001'
 *               vat_number:
 *                 type: string
 *                 description: '📝 OPTIONAL: VAT/Tax ID (validated if provided)'
 *                 example: ''
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: '📝 OPTIONAL: New company logo (PNG/JPG)'
 *               overpayment_threshold_usd:
 *                 type: number
 *                 format: float
 *                 description: '💰 OPTIONAL: Minimum overpayment amount (USD) to trigger special handling. **Payment Links only** — Direct API processes full amount regardless. Default: $5.00'
 *                 example: 5.00
 *               underpayment_threshold_usd:
 *                 type: number
 *                 format: float
 *                 description: '💰 OPTIONAL: Maximum underpayment amount (USD) to accept as full payment. **Payment Links only** — Direct API processes whatever is received. Default: $1.00'
 *                 example: 1.00
 *               grace_period_minutes:
 *                 type: integer
 *                 description: '⏱️ OPTIONAL: Time (in minutes) to allow customer to complete partial/underpayment. **Payment Links only** — Direct API processes immediately. Min: 1, Max: 30. Default: 30 minutes'
 *                 example: 30
 *     responses:
 *       200:
 *         description: Company updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Company not found
 * 
 * /api/company/deleteCompany/{id}:
 *   delete:
 *     tags:
 *       - Company Management
 *     summary: Delete a company
 *     description: Delete a company profile
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Company deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Company not found
 * 
 * /api/company/validateTaxId:
 *   post:
 *     tags:
 *       - Company Management
 *     summary: Validate VAT/Tax ID
 *     description: |
 *       Validate a VAT or Tax ID against the government registry.
 *       Returns format validation and registration status.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vat_number
 *               - country_code
 *             properties:
 *               vat_number:
 *                 type: string
 *                 example: "PT518713130"
 *                 description: VAT number to validate (can include or exclude country prefix)
 *               country_code:
 *                 type: string
 *                 example: "PT"
 *                 description: Two-letter country code (ISO 3166-1 alpha-2)
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     vat_number:
 *                       type: string
 *                     country_code:
 *                       type: string
 *                     valid:
 *                       type: boolean
 *                       description: Whether the VAT number is registered
 *                     format_valid:
 *                       type: boolean
 *                       description: Whether the VAT number format is correct
 *                     message:
 *                       type: string
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Authentication required
 * 
 * /api/company/getTransactions/{id}:
 *   get:
 *     tags:
 *       - Company Management
 *     summary: Get company transactions
 *     description: Retrieve all transactions for a specific company
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     responses:
 *       200:
 *         description: List of transactions
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Company not found
 * 
 * /api/company/webhook-settings/{id}:
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: Get webhook settings
 *     description: |
 *       Retrieve webhook configuration for a company.
 *       Returns the webhook URL and whether a secret is configured (secret value is masked).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *         example: 38
 *     responses:
 *       200:
 *         description: Webhook settings retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Webhook settings retrieved
 *                 data:
 *                   type: object
 *                   properties:
 *                     company_id:
 *                       type: string
 *                     webhook_url:
 *                       type: string
 *                       nullable: true
 *                       example: https://your-domain.com/webhook
 *                     webhook_secret_set:
 *                       type: boolean
 *                       example: true
 *                     webhook_secret_preview:
 *                       type: string
 *                       nullable: true
 *                       example: "***a1b2c3d4"
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Company not found
 *   put:
 *     tags:
 *       - Webhooks
 *     summary: Update webhook settings
 *     description: |
 *       Configure webhook URL and secret for a company.
 *       
 *       **Webhook Secret (Optional):**
 *       - Set to `"generate"` to create a new secret
 *       - Set to `null` or omit to disable signature verification
 *       - The secret is only shown once when generated
 *       
 *       **Webhook Events:**
 *       - `payment.pending` - Payment detected, awaiting confirmations
 *       - `payment.confirmed` - Payment fully confirmed
 *       - `payment.underpaid` - Partial payment received, awaiting remainder
 *       
 *       **Enhanced Webhook Payload Fields:**
 *       All webhooks now include these additional fields for better developer experience:
 *       - `merchant_amount` - Net amount merchant receives (crypto)
 *       - `total_fee` / `total_fee_usd` - Fees charged
 *       - `fee_payer` - Who paid fees ('customer' or 'company')
 *       - `customer_name` / `customer_email` - Customer details
 *       - `description` - Payment description
 *       - `link_id` - Payment link ID
 *       - `tax_info` - Tax details if applicable (object or null)
 *       - `overpayment` - Overpayment info if applicable (object or null)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *         example: 38
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               webhook_url:
 *                 type: string
 *                 format: uri
 *                 description: URL to receive webhook notifications (HTTPS recommended)
 *                 example: https://your-domain.com/webhook
 *               webhook_secret:
 *                 type: string
 *                 nullable: true
 *                 description: |
 *                   Set to "generate" to create new secret, null to disable
 *                 example: generate
 *     responses:
 *       200:
 *         description: Webhook settings updated
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
 *                     company_id:
 *                       type: string
 *                     webhook_url:
 *                       type: string
 *                     webhook_secret_set:
 *                       type: boolean
 *                     webhook_secret:
 *                       type: string
 *                       description: Full secret (only shown on generation)
 *       400:
 *         description: Invalid webhook URL format
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Company not found
 * 
 * /api/company/webhook-test/{id}:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: Send test webhook
 *     description: |
 *       Send a test webhook to verify your endpoint configuration.
 *       
 *       The test webhook will include:
 *       - Event type: `webhook.test`
 *       - Sample payload with company info
 *       - Signature header (if secret is configured)
 *       
 *       **Response includes:**
 *       - Delivery status (success/failed)
 *       - Response status code from your endpoint
 *       - Response time in milliseconds
 *       - The exact payload that was sent
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *         example: 38
 *     responses:
 *       200:
 *         description: Test webhook result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Test webhook sent successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [success, failed]
 *                     webhook_url:
 *                       type: string
 *                     response_status:
 *                       type: integer
 *                       example: 200
 *                     response_time_ms:
 *                       type: integer
 *                       example: 150
 *                     payload_sent:
 *                       type: object
 *                     signature_included:
 *                       type: boolean
 *       400:
 *         description: No webhook URL configured
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Company not found
 * 
 * /api/company/webhook-history/{id}:
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: Get webhook delivery history
 *     description: |
 *       Retrieve paginated webhook delivery history with optional filters.
 *       
 *       **Filters:**
 *       - `status`: Filter by delivery status (success/failed)
 *       - `event_type`: Filter by event type (payment.pending, payment.confirmed, webhook.test)
 *       
 *       **Pagination:**
 *       - Default: 20 items per page (max 100)
 *       - Use `page` and `limit` query parameters
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *         example: 38
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [success, failed]
 *         description: Filter by delivery status
 *       - in: query
 *         name: event_type
 *         schema:
 *           type: string
 *           enum: [payment.pending, payment.confirmed, webhook.test]
 *         description: Filter by event type
 *     responses:
 *       200:
 *         description: Webhook history retrieved
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
 *                     company_id:
 *                       type: string
 *                     logs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           log_id:
 *                             type: integer
 *                           event_type:
 *                             type: string
 *                           webhook_id:
 *                             type: string
 *                           status:
 *                             type: string
 *                           response_status:
 *                             type: integer
 *                           response_time_ms:
 *                             type: integer
 *                           error_message:
 *                             type: string
 *                             nullable: true
 *                           retry_count:
 *                             type: integer
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         total_pages:
 *                           type: integer
 *                         has_more:
 *                           type: boolean
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Company not found
 * 
 * /api/company/webhook-history/{id}/detail/{logId}:
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: Get webhook delivery detail
 *     description: |
 *       Retrieve full details of a specific webhook delivery, including the complete payload.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *         example: 38
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Webhook log ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Webhook detail retrieved
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
 *                     log_id:
 *                       type: integer
 *                     company_id:
 *                       type: integer
 *                     webhook_url:
 *                       type: string
 *                     event_type:
 *                       type: string
 *                     webhook_id:
 *                       type: string
 *                     payload:
 *                       type: object
 *                       description: Full webhook payload that was sent
 *                     status:
 *                       type: string
 *                     response_status:
 *                       type: integer
 *                     response_time_ms:
 *                       type: integer
 *                     error_message:
 *                       type: string
 *                       nullable: true
 *                     retry_count:
 *                       type: integer
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     completed_at:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Company or webhook log not found
 * 
 * /api/company/webhook-stats/{id}:
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: Get webhook statistics
 *     description: |
 *       Retrieve webhook delivery statistics for a company.
 *       
 *       **Includes:**
 *       - Overall success rate
 *       - Average response time
 *       - Breakdown by event type
 *       - Daily delivery counts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *         example: 38
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *           maximum: 30
 *         description: Number of days to include in statistics
 *     responses:
 *       200:
 *         description: Webhook statistics retrieved
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
 *                     company_id:
 *                       type: string
 *                     period_days:
 *                       type: integer
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_deliveries:
 *                           type: integer
 *                         successful:
 *                           type: integer
 *                         failed:
 *                           type: integer
 *                         success_rate:
 *                           type: string
 *                           example: "95.5%"
 *                         avg_response_time_ms:
 *                           type: integer
 *                         last_delivery:
 *                           type: string
 *                           format: date-time
 *                     by_event_type:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           event_type:
 *                             type: string
 *                           total:
 *                             type: string
 *                           successful:
 *                             type: string
 *                           failed:
 *                             type: string
 *                     daily_breakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           total:
 *                             type: string
 *                           successful:
 *                             type: string
 *                           failed:
 *                             type: string
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Company not found
 * 
 * /api/company/auto-convert/{id}:
 *   get:
 *     tags:
 *       - Auto-Stablecoin Conversion
 *     summary: Get auto-convert settings
 *     description: |
 *       Retrieve auto-stablecoin conversion settings for a company.
 *       
 *       When enabled, volatile crypto payments (BTC, ETH, SOL, TRX, etc.) are automatically
 *       converted to the merchant's chosen stablecoin (USDT or USDC) via Binance,
 *       then withdrawn to the merchant's settlement wallet.
 *       
 *       Stablecoin payments (USDT, USDC, RLUSD) are NOT converted — they go directly
 *       to the merchant's crypto wallet as normal.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *         example: 38
 *     responses:
 *       200:
 *         description: Auto-convert settings retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     company_id:
 *                       type: integer
 *                       example: 38
 *                     company_name:
 *                       type: string
 *                       example: "My Company"
 *                     auto_convert_enabled:
 *                       type: boolean
 *                       example: false
 *                       description: Whether auto-conversion is active
 *                     settlement_currency:
 *                       type: string
 *                       nullable: true
 *                       enum: [USDT, USDC]
 *                       example: "USDT"
 *                       description: Target stablecoin for conversion
 *                     settlement_wallet_address:
 *                       type: string
 *                       nullable: true
 *                       example: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
 *                       description: Merchant's stablecoin wallet address
 *                     settlement_chain:
 *                       type: string
 *                       nullable: true
 *                       enum: [ERC20, TRC20, POLYGON, BEP20, SOL]
 *                       example: "ERC20"
 *                       description: Blockchain network for stablecoin withdrawal
 *                     valid_currencies:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["USDT", "USDC"]
 *                     valid_chains:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["ERC20", "TRC20", "POLYGON", "BEP20", "SOL"]
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Company not found
 *   put:
 *     tags:
 *       - Auto-Stablecoin Conversion
 *     summary: Update auto-convert settings
 *     description: |
 *       Enable or disable auto-stablecoin conversion for a company.
 *       
 *       **When enabled:**
 *       - Volatile crypto payments (BTC, ETH, SOL, TRX, LTC, DOGE, BCH, XRP, POLYGON)
 *         are redirected to admin wallet (Binance deposit address)
 *       - Binance Convert API converts to chosen stablecoin (USDT/USDC)
 *       - Stablecoin is withdrawn to merchant's settlement wallet
 *       - Full audit trail maintained in `tbl_stablecoin_conversion`
 *       
 *       **When disabled (or for stablecoins):**
 *       - Payments go directly to merchant's crypto wallet (normal flow)
 *       
 *       **Validation:** All 3 fields (settlement_currency, settlement_wallet_address, settlement_chain) 
 *       are required when enabling auto-convert.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *         example: 38
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - auto_convert_enabled
 *             properties:
 *               auto_convert_enabled:
 *                 type: boolean
 *                 description: Enable/disable auto-conversion
 *                 example: true
 *               settlement_currency:
 *                 type: string
 *                 enum: [USDT, USDC]
 *                 description: "Target stablecoin (required when enabling)"
 *                 example: "USDT"
 *               settlement_wallet_address:
 *                 type: string
 *                 description: "Merchant's stablecoin wallet address (required when enabling)"
 *                 example: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
 *               settlement_chain:
 *                 type: string
 *                 enum: [ERC20, TRC20, POLYGON, BEP20, SOL]
 *                 description: "Blockchain network for withdrawal (required when enabling)"
 *                 example: "ERC20"
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     auto_convert_enabled:
 *                       type: boolean
 *                     settlement_currency:
 *                       type: string
 *                     settlement_wallet_address:
 *                       type: string
 *                     settlement_chain:
 *                       type: string
 *       400:
 *         description: Invalid settlement_currency, missing wallet address, or invalid chain
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Company not found
 * 
 * /api/company/conversion-history/{id}:
 *   get:
 *     tags:
 *       - Auto-Stablecoin Conversion
 *     summary: Get conversion history
 *     description: |
 *       Retrieve paginated stablecoin conversion history for a company.
 *       
 *       Each record tracks the full lifecycle:
 *       - `PENDING_DEPOSIT` — Crypto sent to admin wallet (Binance), waiting for deposit credit
 *       - `DEPOSIT_CREDITED` — Binance credited the deposit
 *       - `CONVERTING` — Binance Convert quote requested
 *       - `CONVERTED` — Conversion complete, stablecoin in Binance balance
 *       - `WITHDRAWING` — Withdrawal to merchant wallet initiated
 *       - `COMPLETED` — Stablecoin delivered to merchant
 *       - `FAILED` — Error (retryable)
 *       
 *       **Filter by status:** Use `?status=COMPLETED` to see only completed conversions.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *         example: 38
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING_DEPOSIT, DEPOSIT_CREDITED, CONVERTING, CONVERTED, WITHDRAWING, COMPLETED, FAILED]
 *         description: Filter by conversion status
 *     responses:
 *       200:
 *         description: Conversion history retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/StablecoinConversion'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Company not found
 */

export const companyPaths = {};
