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
 *     description: |
 *       Update an existing company profile.
 *       
 *       **💡 Swagger UI Usage:**
 *       1. Click "Try it out"
 *       2. Fill only the fields you want to update
 *       3. Leave other fields empty
 *       4. Click "Execute"
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
 *               company_name:
 *                 type: string
 *                 description: Company legal name
 *                 example: Updated Company Name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Company contact email
 *                 example: newemail@company.com
 *               mobile:
 *                 type: string
 *                 description: Company phone number
 *                 example: '+1234567890'
 *               website:
 *                 type: string
 *                 format: uri
 *                 description: Company website
 *               address_line1:
 *                 type: string
 *                 description: Street address
 *               address_line2:
 *                 type: string
 *                 description: Additional address info
 *               city:
 *                 type: string
 *                 description: City
 *               state:
 *                 type: string
 *                 description: State/Province
 *               country:
 *                 type: string
 *                 description: Country code (ISO 2-letter)
 *               zip_code:
 *                 type: string
 *                 description: Postal/ZIP code
 *               vat_number:
 *                 type: string
 *                 description: VAT/Tax ID
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
