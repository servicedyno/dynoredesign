#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "DynoPay crypto payment gateway - Phase 1 Database Schema Updates verification"

backend:
  - task: "tbl_company extended with address and VAT fields"
    implemented: true
    working: true
    file: "/app/backend/models/companyModels/companyModel.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Model includes address_line1, address_line2, city, state, country, zip_code, vat_number, vat_type, vat_verified fields"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: All expected columns present in tbl_company table. Database migration successful. Columns: address_line1, address_line2, city, state, country, zip_code, vat_number, vat_type, vat_verified"

  - task: "tbl_api extended with api_name field"
    implemented: true
    working: true
    file: "/app/backend/models/apiModels/apiModel.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Model includes api_name field"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: api_name column successfully added to tbl_api table. Database migration successful."

  - task: "tbl_user_wallet extended with company_id and wallet_name"
    implemented: true
    working: true
    file: "/app/backend/models/userModels/userWalletModel.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Model includes company_id reference and wallet_name fields"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: company_id and wallet_name columns successfully added to tbl_user_wallet table. Database migration successful."

  - task: "tbl_user_addresses extended with company_id and wallet_name"
    implemented: true
    working: true
    file: "/app/backend/models/userModels/userWalletAddressModel.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Model includes company_id reference and wallet_name fields"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: company_id and wallet_name columns successfully added to tbl_user_addresses table. Database migration successful."

  - task: "tbl_tax_rate table created"
    implemented: true
    working: true
    file: "/app/backend/models/taxRateModel.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New model for caching VAT rates by country"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: tbl_tax_rate table created successfully with 8 columns: tax_id, country_code, country_name, tax_acronym, standard_rate, reduced_rates, created_at, updated_at"

  - task: "tbl_invoice table created"
    implemented: true
    working: true
    file: "/app/backend/models/invoiceModel.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New model for transaction invoices with provider/customer info"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: tbl_invoice table created successfully with 24 columns including invoice_number, transaction_id, company_id, provider_*, customer_*, vat_*, totals as specified"

  - task: "tbl_notification table created"
    implemented: true
    working: true
    file: "/app/backend/models/notificationModel.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New model for individual notifications"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: tbl_notification table created successfully with 9 columns: notification_id, user_id, company_id, type, title, message, data, is_read, created_at"

  - task: "tbl_notification_preferences table created"
    implemented: true
    working: true
    file: "/app/backend/models/notificationPreferencesModel.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New model for user notification settings"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: tbl_notification_preferences table created successfully with 12 columns including transaction_updates, payment_received, weekly_summary, email_notifications, etc."

  - task: "tbl_kyc table created"
    implemented: true
    working: true
    file: "/app/backend/models/kycModel.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New model for KYC verification records"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: tbl_kyc table created successfully with 10 columns: kyc_id, user_id, company_id, status, documents, rejection_reason, volume_threshold, submitted_at, reviewed_at, created_at"

frontend:
  - task: "No frontend changes for Phase 1"
    implemented: false
    working: "NA"
    file: ""
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Phase 1 is backend-only database schema updates"

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Phase 2: Tax API endpoints"
    - "GET /api/tax/rate/:countryCode"
    - "POST /api/tax/validate"
    - "GET /api/tax/acronyms"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Phase 2 Tax Integration implemented. New endpoints created: GET /api/tax/rate/:countryCode (cache-first VAT rates), POST /api/tax/validate (Tax ID validation), GET /api/tax/acronyms (all tax acronyms by country), GET /api/tax/lookup (lookup by country name). The APILayer tax_data API has rate limiting, so fallback VAT rates are provided for common countries."
  - agent: "testing"
    message: "✅ PHASE 1 DATABASE SCHEMA TESTING COMPLETE: All 9 backend tasks successfully verified. Database connectivity confirmed, migration executed successfully, all 5 new tables created with correct schemas (tbl_tax_rate, tbl_invoice, tbl_notification, tbl_notification_preferences, tbl_kyc), and all 4 existing tables properly extended with new columns (tbl_company, tbl_api, tbl_user_wallet, tbl_user_addresses). PostgreSQL database at yamanote.proxy.rlwy.net:42097 is fully operational with Phase 1 schema updates."