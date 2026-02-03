import sequelize from './utils/dbInstance';
import { QueryTypes } from 'sequelize';

async function runPoolAddressAnalysis() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Query 1: Pool Address Creation Timestamps
    console.log('\n=== QUERY 1: Pool Address Creation Timestamps ===');
    const poolAddresses = await sequelize.query(`
      SELECT 
        temp_address_id,
        owner_user_id,
        wallet_type,
        wallet_address,
        derivation_index,
        status,
        total_transactions,
        created_at,
        updated_at
      FROM tbl_merchant_temp_address 
      WHERE owner_user_id = 28
      ORDER BY created_at ASC
    `, { type: QueryTypes.SELECT });

    console.log(`Found ${poolAddresses.length} pool addresses:`);
    poolAddresses.forEach((addr: Record<string, unknown>, index) => {
      console.log(`${index + 1}. ${addr.wallet_type} - Created: ${addr.created_at} (ID: ${addr.temp_address_id})`);
    });

    // Query 2: Merchant Wallet Creation Timestamps
    console.log('\n=== QUERY 2: Merchant Wallet (xpub) Creation Timestamps ===');
    const merchantWallets = await sequelize.query(`
      SELECT 
        wallet_id,
        user_id,
        wallet_type,
        last_derivation_index,
        created_at,
        updated_at
      FROM tbl_merchant_wallet 
      WHERE user_id = 28
      ORDER BY created_at ASC
    `, { type: QueryTypes.SELECT });

    console.log(`Found ${merchantWallets.length} merchant wallets:`);
    merchantWallets.forEach((wallet: Record<string, unknown>, index) => {
      console.log(`${index + 1}. ${wallet.wallet_type} - Created: ${wallet.created_at} (ID: ${wallet.wallet_id})`);
    });

    // Query 3: User Wallet Configuration (note: uses createdAt not created_at)
    console.log('\n=== QUERY 3: User Wallet Configuration ===');
    const userWallets = await sequelize.query(`
      SELECT 
        wallet_id,
        user_id,
        wallet_type,
        "createdAt"
      FROM tbl_user_wallet
      WHERE user_id = 28
      ORDER BY "createdAt" ASC
    `, { type: QueryTypes.SELECT });

    console.log(`Found ${userWallets.length} user wallets:`);
    userWallets.forEach((wallet: Record<string, unknown>, index) => {
      console.log(`${index + 1}. ${wallet.wallet_type} - Created: ${wallet.createdAt} (ID: ${wallet.wallet_id})`);
    });

    // Query 4: Pool Transaction History
    console.log('\n=== QUERY 4: Pool Transaction History ===');
    const poolTransactions = await sequelize.query(`
      SELECT 
        pool_tx_id,
        temp_address_id,
        wallet_type,
        payment_amount,
        status,
        created_at
      FROM tbl_merchant_pool_transaction 
      WHERE owner_user_id = 28
      ORDER BY created_at ASC
    `, { type: QueryTypes.SELECT });

    console.log(`Found ${poolTransactions.length} pool transactions:`);
    poolTransactions.forEach((tx: Record<string, unknown>, index) => {
      console.log(`${index + 1}. ${tx.wallet_type} - ${tx.payment_amount} - Created: ${tx.created_at} (${tx.status})`);
    });

    // Analysis
    console.log('\n' + '='.repeat(80));
    console.log('TIMELINE ANALYSIS FOR john@dyno.pt (user_id: 28)');
    console.log('='.repeat(80));

    if (poolAddresses.length === 0) {
      console.log('❌ NO POOL ADDRESSES FOUND for user_id 28 (john@dyno.pt)');
      console.log('This suggests that either:');
      console.log('1. Pool addresses have not been created yet');
      console.log('2. Pool system has not been initialized for this user');
      console.log('3. User is using a different pool system or configuration');
      
      // Check if there are any pool addresses for other users
      const anyPoolAddresses = await sequelize.query(`
        SELECT COUNT(*) as total_count, 
               COUNT(DISTINCT owner_user_id) as unique_users
        FROM tbl_merchant_temp_address
      `, { type: QueryTypes.SELECT });
      
      console.log(`\n📊 SYSTEM-WIDE POOL ADDRESS STATUS:`);
      console.log(`   • Total pool addresses in system: ${(anyPoolAddresses[0] as Record<string, unknown>).total_count}`);
      console.log(`   • Users with pool addresses: ${(anyPoolAddresses[0] as Record<string, unknown>).unique_users}`);
      
      if ((anyPoolAddresses[0] as Record<string, unknown>).total_count > 0) {
        // Show some examples
        const sampleAddresses = await sequelize.query(`
          SELECT owner_user_id, wallet_type, created_at
          FROM tbl_merchant_temp_address
          ORDER BY created_at DESC
          LIMIT 5
        `, { type: QueryTypes.SELECT });
        
        console.log(`\n📋 SAMPLE POOL ADDRESSES (most recent):`);
        sampleAddresses.forEach((addr: Record<string, unknown>, index) => {
          console.log(`   ${index + 1}. User ${addr.owner_user_id} - ${addr.wallet_type} - ${addr.created_at}`);
        });
      }
      
      return;
    }

    // Parse timestamps for analysis
    const poolTimes = poolAddresses.map((addr: unknown) => ({
      timestamp: new Date(addr.created_at),
      wallet_type: addr.wallet_type,
      address_id: addr.temp_address_id
    })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const merchantTimes = merchantWallets.map((wallet: unknown) => ({
      timestamp: new Date(wallet.created_at),
      wallet_type: wallet.wallet_type,
      wallet_id: wallet.wallet_id
    })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const userWalletTimes = userWallets.map((wallet: unknown) => ({
      timestamp: new Date(wallet.createdAt),
      wallet_type: wallet.wallet_type,
      wallet_id: wallet.wallet_id
    })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const transactionTimes = poolTransactions.map((tx: unknown) => ({
      timestamp: new Date(tx.created_at),
      wallet_type: tx.wallet_type,
      tx_id: tx.pool_tx_id
    })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate time spans
    const firstPoolTime = poolTimes[0].timestamp;
    const lastPoolTime = poolTimes[poolTimes.length - 1].timestamp;
    const timeSpanSeconds = (lastPoolTime.getTime() - firstPoolTime.getTime()) / 1000;
    const timeSpanMinutes = timeSpanSeconds / 60;

    console.log(`\n📊 CREATION PATTERN ANALYSIS:`);
    console.log(`   • Total Pool Addresses: ${poolAddresses.length}`);
    console.log(`   • First Address Created: ${firstPoolTime.toISOString()}`);
    console.log(`   • Last Address Created: ${lastPoolTime.toISOString()}`);
    console.log(`   • Creation Time Span: ${timeSpanMinutes.toFixed(2)} minutes (${timeSpanSeconds.toFixed(2)} seconds)`);

    // Group by wallet type
    const walletTypeGroups: { [key: string]: Date[] } = {};
    poolTimes.forEach(addr => {
      if (!walletTypeGroups[addr.wallet_type]) {
        walletTypeGroups[addr.wallet_type] = [];
      }
      walletTypeGroups[addr.wallet_type].push(addr.timestamp);
    });

    console.log(`   • Wallet Types: ${Object.keys(walletTypeGroups).join(', ')}`);
    console.log(`   • Addresses per Type:`);
    Object.entries(walletTypeGroups).forEach(([type, times]) => {
      console.log(`     - ${type}: ${times.length} addresses`);
    });

    // Correlation analysis
    let merchantCorrelation = false;
    if (merchantTimes.length > 0) {
      const firstMerchantTime = merchantTimes[0].timestamp;
      const timeDiffToMerchant = Math.abs(firstPoolTime.getTime() - firstMerchantTime.getTime()) / 1000;
      merchantCorrelation = timeDiffToMerchant < 3600; // Within 1 hour
      console.log(`   • First Merchant Wallet: ${firstMerchantTime.toISOString()}`);
      console.log(`   • Time Diff to Pool: ${(timeDiffToMerchant / 60).toFixed(2)} minutes`);
    } else {
      console.log(`   • No merchant wallets found`);
    }

    let userWalletCorrelation = false;
    if (userWalletTimes.length > 0) {
      const firstUserWalletTime = userWalletTimes[0].timestamp;
      const timeDiffToUserWallet = Math.abs(firstPoolTime.getTime() - firstUserWalletTime.getTime()) / 1000;
      userWalletCorrelation = timeDiffToUserWallet < 3600; // Within 1 hour
      console.log(`   • First User Wallet: ${firstUserWalletTime.toISOString()}`);
      console.log(`   • Time Diff to Pool: ${(timeDiffToUserWallet / 60).toFixed(2)} minutes`);
    } else {
      console.log(`   • No user wallets found`);
    }

    let transactionCorrelation = false;
    if (transactionTimes.length > 0) {
      const firstTxTime = transactionTimes[0].timestamp;
      const timeDiffToTx = (firstTxTime.getTime() - firstPoolTime.getTime()) / 1000;
      transactionCorrelation = timeDiffToTx > 0; // Transactions came after addresses
      console.log(`   • First Transaction: ${firstTxTime.toISOString()}`);
      console.log(`   • Time Diff from Pool: ${(timeDiffToTx / 60).toFixed(2)} minutes`);
    } else {
      console.log(`   • No pool transactions found`);
    }

    // Determine creation method
    const bulkCreation = timeSpanSeconds < 300; // Less than 5 minutes = bulk

    console.log(`\n🔍 EVIDENCE ANALYSIS:`);
    console.log(`   • Bulk Creation (< 5 min): ${bulkCreation ? 'YES' : 'NO'}`);
    console.log(`   • Merchant Wallet Correlation (< 1 hour): ${merchantCorrelation ? 'YES' : 'NO'}`);
    console.log(`   • User Wallet Correlation (< 1 hour): ${userWalletCorrelation ? 'YES' : 'NO'}`);
    console.log(`   • Transaction Correlation (after addresses): ${transactionCorrelation ? 'YES' : 'NO'}`);

    // Final conclusion
    console.log(`\n🎯 CONCLUSION:`);
    if (bulkCreation && (merchantCorrelation || userWalletCorrelation)) {
      console.log('✅ POOL ADDRESSES WERE PRE-INITIALIZED');
      console.log('   Pool addresses were created during wallet configuration (initializeMerchantPool)');
      console.log('   Evidence: All addresses created within minutes, correlated with wallet setup.');
      if (transactionCorrelation) {
        console.log('   Transactions came after address creation, confirming pre-initialization.');
      }
    } else if (!bulkCreation && Object.keys(walletTypeGroups).length > 1) {
      console.log('✅ POOL ADDRESSES WERE CREATED ON-DEMAND');
      console.log('   Pool addresses were created lazily when payment requests were made (reserveAddress)');
      console.log('   Evidence: Addresses created at different times, likely triggered by payment requests.');
    } else if (bulkCreation && !merchantCorrelation && !userWalletCorrelation) {
      console.log('⚠️  POOL ADDRESSES WERE BULK CREATED BUT NOT DURING WALLET SETUP');
      console.log('   Addresses were created all at once but not correlated with wallet configuration.');
      console.log('   This might indicate manual initialization or a different trigger.');
    } else {
      console.log('⚠️  CREATION PATTERN IS UNCLEAR');
      console.log('   The evidence suggests a mixed or unclear creation pattern.');
      console.log('   May require further investigation or additional data points.');
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('Analysis failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runPoolAddressAnalysis();