import { customerTransactionModel, customerModel } from './models';
import { Op } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

async function fixNullCustomerIds() {
  console.log('\n=== Fixing NULL customer_id in tbl_customer_transaction ===\n');
  
  try {
    // Step 1: Check how many records have NULL customer_id
    const nullCount = await customerTransactionModel.count({
      where: {
        customer_id: null
      }
    });
    
    console.log(`Found ${nullCount} records with NULL customer_id`);
    
    if (nullCount === 0) {
      console.log('✅ No NULL customer_id records found. Database is clean!');
      return;
    }
    
    // Step 2: Get a sample of NULL records to understand the data
    const sampleNullRecords = await customerTransactionModel.findAll({
      where: { customer_id: null },
      limit: 5,
      attributes: ['id', 'transaction_id', 'company_id', 'payment_mode', 'base_amount', 'status']
    });
    
    console.log('\n📋 Sample NULL customer_id records:');
    sampleNullRecords.forEach((record: unknown) => {
      const data = record.dataValues;
      console.log(`  ID: ${data.id}, TX: ${data.transaction_id}, Company: ${data.company_id}, Mode: ${data.payment_mode}, Amount: ${data.base_amount}`);
    });
    
    // Step 3: Offer solutions
    console.log('\n📊 Solutions Available:\n');
    console.log('1. DELETE NULL RECORDS (if they are test/invalid data)');
    console.log('2. CREATE PLACEHOLDER CUSTOMER and assign to NULL records');
    console.log('3. KEEP customer_id as NULLABLE (modify model in other repo)');
    
    console.log('\n⚠️  Recommended: Option 2 (Create placeholder customer)');
    console.log('   This preserves transaction history while fixing the constraint issue.\n');
    
    // Let's implement Option 2: Create placeholder customer
    console.log('Implementing Option 2: Creating placeholder customer...\n');
    
    // Check if placeholder customer already exists
    let placeholderCustomer = await customerModel.findOne({
      where: {
        email: 'placeholder@system.internal'
      }
    });
    
    if (!placeholderCustomer) {
      console.log('Creating system placeholder customer...');
      
      // Get first company to associate with
      const firstTransaction = await customerTransactionModel.findOne({
        where: { customer_id: null },
        attributes: ['company_id']
      });
      
      const companyId = firstTransaction?.dataValues?.company_id || 1;
      
      placeholderCustomer = await customerModel.create({
        company_id: companyId,
        email: 'placeholder@system.internal',
        name: 'System Placeholder',
        status: 'active',
        phone: '+0000000000'
      });
      
      console.log(`✅ Placeholder customer created: ID ${placeholderCustomer.dataValues.customer_id}`);
    } else {
      console.log(`✅ Placeholder customer exists: ID ${placeholderCustomer.dataValues.customer_id}`);
    }
    
    // Step 4: Update NULL records
    console.log('\nUpdating NULL customer_id records...');
    
    const [updateCount] = await customerTransactionModel.update(
      { customer_id: placeholderCustomer.dataValues.customer_id },
      {
        where: {
          customer_id: null
        }
      }
    );
    
    console.log(`✅ Updated ${updateCount} records with placeholder customer_id`);
    
    // Step 5: Verify fix
    const remainingNulls = await customerTransactionModel.count({
      where: { customer_id: null }
    });
    
    console.log(`\n📊 Final verification: ${remainingNulls} NULL records remaining`);
    
    if (remainingNulls === 0) {
      console.log('\n🎉 SUCCESS! All NULL customer_id values have been fixed!');
      console.log('You can now restart the other repository - the migration should succeed.');
    } else {
      console.log('\n⚠️  Some NULL values remain. Manual intervention may be needed.');
    }
    
  } catch (error: unknown) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

async function deleteNullRecords() {
  console.log('\n=== Alternative: DELETE NULL customer_id records ===\n');
  console.log('⚠️  WARNING: This will permanently delete transaction records!\n');
  
  try {
    const deleteCount = await customerTransactionModel.destroy({
      where: {
        customer_id: null
      }
    });
    
    console.log(`🗑️  Deleted ${deleteCount} records with NULL customer_id`);
    console.log('✅ Database cleaned. Restart the other repository.');
    
  } catch (error: unknown) {
    console.error('❌ Error:', error.message);
  }
}

// Main execution
console.log('\n' + '='.repeat(80));
console.log('  DATABASE MIGRATION FIX UTILITY');
console.log('  Issue: NULL customer_id in tbl_customer_transaction');
console.log('='.repeat(80));

fixNullCustomerIds().then(() => {
  console.log('\n' + '='.repeat(80));
  console.log('  CLEANUP COMPLETE');
  console.log('='.repeat(80) + '\n');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
