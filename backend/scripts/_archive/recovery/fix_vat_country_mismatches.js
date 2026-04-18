/**
 * Fix VAT Country Mismatches Script
 * 
 * This script identifies and fixes companies with mismatched VAT/country data.
 * 
 * Options:
 * 1. DRY RUN: Show mismatches without making changes
 * 2. AUTO FIX: Auto-correct country to match VAT number
 * 3. REPORT ONLY: Generate report for manual review
 * 
 * Usage:
 *   node fix_vat_country_mismatches.js --dry-run
 *   node fix_vat_country_mismatches.js --auto-fix
 *   node fix_vat_country_mismatches.js --report
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration from environment or Railway config
const dbConfig = {
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: process.env.DB_PORT || process.env.PGPORT || 5432,
  database: process.env.DB_NAME || process.env.PGDATABASE,
  user: process.env.DB_USER || process.env.PGUSER,
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
  connectionTimeoutMillis: 30000
};

// Country names mapping
const COUNTRY_NAMES = {
  AT: "Austria", BE: "Belgium", BG: "Bulgaria", CY: "Cyprus", CZ: "Czech Republic",
  DE: "Germany", DK: "Denmark", EE: "Estonia", ES: "Spain", FI: "Finland",
  FR: "France", GR: "Greece", HR: "Croatia", HU: "Hungary", IE: "Ireland",
  IT: "Italy", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MT: "Malta",
  NL: "Netherlands", PL: "Poland", PT: "Portugal", RO: "Romania", SE: "Sweden",
  SI: "Slovenia", SK: "Slovakia", GB: "United Kingdom", US: "United States",
};

function getCountryName(code) {
  return COUNTRY_NAMES[code.toUpperCase()] || code;
}

async function findMismatches(client) {
  console.log('\n🔍 Searching for VAT/Country mismatches...\n');
  
  const result = await client.query(`
    SELECT 
      company_id,
      company_name,
      email,
      country,
      vat_number,
      SUBSTRING(vat_number, 1, 2) as vat_country,
      vat_verified,
      "createdAt"
    FROM tbl_company
    WHERE 
      vat_number IS NOT NULL 
      AND vat_number != ''
      AND country IS NOT NULL
      AND country != ''
      AND UPPER(SUBSTRING(vat_number, 1, 2)) != UPPER(country)
    ORDER BY "createdAt" DESC
  `);
  
  return result.rows;
}

async function findVATWithoutCountry(client) {
  console.log('\n🔍 Searching for companies with VAT but no country...\n');
  
  const result = await client.query(`
    SELECT 
      company_id,
      company_name,
      email,
      vat_number,
      SUBSTRING(vat_number, 1, 2) as vat_country
    FROM tbl_company
    WHERE 
      vat_number IS NOT NULL 
      AND vat_number != ''
      AND (country IS NULL OR country = '')
    ORDER BY "createdAt" DESC
  `);
  
  return result.rows;
}

async function autoFixCompany(client, company, dryRun = false) {
  const vatCountry = company.vat_country.toUpperCase();
  const oldCountry = company.country;
  
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Fixing Company ID ${company.company_id}: ${company.company_name}`);
  console.log(`  Old Country: ${oldCountry} (${getCountryName(oldCountry)})`);
  console.log(`  New Country: ${vatCountry} (${getCountryName(vatCountry)})`);
  console.log(`  VAT Number: ${company.vat_number}`);
  
  if (!dryRun) {
    await client.query(
      'UPDATE tbl_company SET country = $1 WHERE company_id = $2',
      [vatCountry, company.company_id]
    );
    console.log(`  ✅ Updated successfully\n`);
  } else {
    console.log(`  ⏸️  Would update (dry run mode)\n`);
  }
}

async function generateReport(mismatches, vatWithoutCountry) {
  const reportDate = new Date().toISOString().split('T')[0];
  const reportPath = path.join(__dirname, `vat_country_report_${reportDate}.txt`);
  
  let report = '';
  report += '================================================================================\n';
  report += '  VAT/COUNTRY DATA QUALITY REPORT\n';
  report += `  Generated: ${new Date().toISOString()}\n`;
  report += '================================================================================\n\n';
  
  report += `SUMMARY:\n`;
  report += `  - Companies with mismatched VAT/Country: ${mismatches.length}\n`;
  report += `  - Companies with VAT but no Country: ${vatWithoutCountry.length}\n`;
  report += `  - Total issues: ${mismatches.length + vatWithoutCountry.length}\n\n`;
  
  if (mismatches.length > 0) {
    report += '================================================================================\n';
    report += '  MISMATCHED VAT/COUNTRY\n';
    report += '================================================================================\n\n';
    
    mismatches.forEach((company, index) => {
      report += `${index + 1}. Company ID: ${company.company_id}\n`;
      report += `   Name: ${company.company_name}\n`;
      report += `   Email: ${company.email}\n`;
      report += `   Country: ${company.country} (${getCountryName(company.country)})\n`;
      report += `   VAT Number: ${company.vat_number}\n`;
      report += `   VAT Country: ${company.vat_country} (${getCountryName(company.vat_country)})\n`;
      report += `   Created: ${company.createdAt}\n`;
      report += `   ❌ MISMATCH\n\n`;
    });
  }
  
  if (vatWithoutCountry.length > 0) {
    report += '================================================================================\n';
    report += '  VAT WITHOUT COUNTRY (CAN BE AUTO-FIXED)\n';
    report += '================================================================================\n\n';
    
    vatWithoutCountry.forEach((company, index) => {
      report += `${index + 1}. Company ID: ${company.company_id}\n`;
      report += `   Name: ${company.company_name}\n`;
      report += `   Email: ${company.email}\n`;
      report += `   VAT Number: ${company.vat_number}\n`;
      report += `   Suggested Country: ${company.vat_country} (${getCountryName(company.vat_country)})\n\n`;
    });
  }
  
  report += '================================================================================\n';
  report += '  RECOMMENDATIONS\n';
  report += '================================================================================\n\n';
  
  if (mismatches.length > 0) {
    report += '⚠️  ACTION REQUIRED FOR MISMATCHES:\n';
    report += '   1. Review each mismatch manually\n';
    report += '   2. Contact companies to verify correct data\n';
    report += '   3. Run with --auto-fix to correct country to match VAT\n';
    report += '   4. Or manually update in database\n\n';
  }
  
  if (vatWithoutCountry.length > 0) {
    report += '✅ VAT WITHOUT COUNTRY CAN BE AUTO-FIXED:\n';
    report += '   Run: node fix_vat_country_mismatches.js --auto-fix-missing\n\n';
  }
  
  if (mismatches.length === 0 && vatWithoutCountry.length === 0) {
    report += '✅ No issues found! Data quality is excellent.\n\n';
  }
  
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}\n`);
  
  return reportPath;
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--dry-run';
  
  console.log('================================================================================');
  console.log('  VAT/COUNTRY MISMATCH FIX TOOL');
  console.log('================================================================================\n');
  
  const client = new Client(dbConfig);
  
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Find all issues
    const mismatches = await findMismatches(client);
    const vatWithoutCountry = await findVATWithoutCountry(client);
    
    console.log(`Found ${mismatches.length} companies with mismatched VAT/Country`);
    console.log(`Found ${vatWithoutCountry.length} companies with VAT but no Country\n`);
    
    if (mismatches.length === 0 && vatWithoutCountry.length === 0) {
      console.log('✅ No issues found! Data quality is excellent.\n');
      await client.end();
      return;
    }
    
    // Handle based on mode
    switch (mode) {
      case '--dry-run':
        console.log('📋 DRY RUN MODE - No changes will be made\n');
        console.log('=' .repeat(80));
        
        if (mismatches.length > 0) {
          console.log('\nMISMATCHED VAT/COUNTRY:\n');
          for (const company of mismatches) {
            await autoFixCompany(client, company, true);
          }
        }
        
        if (vatWithoutCountry.length > 0) {
          console.log('\nVAT WITHOUT COUNTRY:\n');
          for (const company of vatWithoutCountry) {
            console.log(`[DRY RUN] Would set country to ${company.vat_country} for ${company.company_name}`);
            console.log(`  Company ID: ${company.company_id}`);
            console.log(`  VAT: ${company.vat_number}\n`);
          }
        }
        
        console.log('=' .repeat(80));
        console.log('\nTo apply fixes, run with --auto-fix');
        break;
        
      case '--auto-fix':
        console.log('🔧 AUTO FIX MODE - Will update database\n');
        
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
          readline.question(`⚠️  This will update ${mismatches.length + vatWithoutCountry.length} companies. Continue? (yes/no): `, resolve);
        });
        
        readline.close();
        
        if (answer.toLowerCase() !== 'yes') {
          console.log('Cancelled.');
          await client.end();
          return;
        }
        
        console.log('\n🔧 Applying fixes...\n');
        
        let fixed = 0;
        
        // Fix mismatches
        for (const company of mismatches) {
          await autoFixCompany(client, company, false);
          fixed++;
        }
        
        // Fix VAT without country
        for (const company of vatWithoutCountry) {
          console.log(`Fixing Company ID ${company.company_id}: ${company.company_name}`);
          console.log(`  Setting country to: ${company.vat_country} (${getCountryName(company.vat_country)})`);
          console.log(`  VAT Number: ${company.vat_number}`);
          
          await client.query(
            'UPDATE tbl_company SET country = $1 WHERE company_id = $2',
            [company.vat_country.toUpperCase(), company.company_id]
          );
          console.log(`  ✅ Updated successfully\n`);
          fixed++;
        }
        
        console.log(`\n✅ Fixed ${fixed} companies!\n`);
        break;
        
      case '--report':
        console.log('📄 REPORT MODE - Generating report...\n');
        const reportPath = await generateReport(mismatches, vatWithoutCountry);
        console.log(`Report generated: ${reportPath}`);
        break;
        
      default:
        console.log('Unknown mode. Use --dry-run, --auto-fix, or --report');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { findMismatches, autoFixCompany };
