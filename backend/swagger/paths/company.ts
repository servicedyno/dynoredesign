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
 *       **📝 Note**: This endpoint requires JWT authentication. Make sure to:
 *       1. First login using `/api/user/login` endpoint
 *       2. Copy the JWT token from the login response
 *       3. Click the "Authorize" button at the top of this page
 *       4. Enter your token in the format: `your-jwt-token-here` (without "Bearer" prefix)
 *       
 *       **⚠️ IMPORTANT - Editing the data field:**
 *       The `data` field is a JSON string. When using "Try it out":
 *       - Click on the data field and edit the JSON string directly
 *       - Only provide the fields you want to set
 *       - Minimum required: `{"company_name":"Your Company","email":"your@email.com"}`
 *       - Optional fields: mobile, address_line1, city, state, country, zip_code, vat_number
 *       
 *       **Required Fields**: company_name and email
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: string
 *                 description: JSON string containing company information
 *                 example: '{"company_name":"My Company","email":"company@example.com"}'
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Company logo (optional)
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
 *     description: Retrieve a specific company by its ID
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
 *     description: Update an existing company profile
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: string
 *                 description: JSON string containing updated company information
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: New company logo (optional)
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
 */

export const companyPaths = {};
