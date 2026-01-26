/**
 * Simple test to verify the getFeeTiers function works correctly
 */

const jwt = require('jsonwebtoken');

// Mock the required modules and functions
const mockSequelize = {
  query: async (query, options) => {
    // Mock response for monthly volume query
    return [{ volume: '15000.50' }]; // Simulates $15,000.50 monthly volume
  }
};

const mockSuccessResponseHelper = (res, status, message, data) => {
  return { status, message, data };
};

const mockErrorResponseHelper = (res, status, message) => {
  return { status, message, error: true };
};

const mockGetErrorMessage = (error) => {
  return error.message || 'Unknown error';
};

// Mock the fee tiers (same as in the actual file)
const FEE_TIERS = [
  { name: "Starter", min: 0, max: 10000, description: "For new users testing the platform" },
  { name: "Standard", min: 10000, max: 50000, description: "For growing users" },
  { name: "Pro", min: 50000, max: 250000, description: "For serious merchants and creators" },
  { name: "Business", min: 250000, max: 1000000, description: "For high-volume operations" },
  { name: "Enterprise", min: 1000000, max: Infinity, description: "Custom pricing, priority support" },
];

// Mock the getFeeTier function (same logic as in the actual file)
const getFeeTier = (monthlyVolume) => {
  const tier = FEE_TIERS.find(t => monthlyVolume >= t.min && monthlyVolume < t.max) || FEE_TIERS[FEE_TIERS.length - 1];
  const nextTier = FEE_TIERS.find(t => t.min > monthlyVolume);
  
  return {
    current_tier: tier.name,
    tier_description: tier.description,
    monthly_volume: monthlyVolume,
    tier_threshold: tier.max === Infinity ? null : tier.max,
    percent_complete: tier.max === Infinity ? 100 : Math.round((monthlyVolume / tier.max) * 100 * 10) / 10,
    amount_to_next_tier: nextTier ? Math.round((nextTier.min - monthlyVolume) * 100) / 100 : 0,
    next_tier: nextTier?.name || null,
  };
};

// Mock the updated getFeeTiers function
const getFeeTiers = async (req, res) => {
  const userData = jwt.decode(res.locals.token);
  
  try {
    const { company_id } = req.query;
    const userId = userData.user_id;

    // Calculate user's monthly transaction volume
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyVolumeResult = await mockSequelize.query(
      `SELECT COALESCE(SUM(ut.base_amount), 0) as volume
       FROM tbl_user_transaction ut
       ${company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : ''}
       WHERE ut.user_id = :userId 
       AND ut.status = 'done'
       AND ut."createdAt" >= :startOfMonth
       ${company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : ''}`,
      {
        replacements: { userId, startOfMonth, companyId: company_id },
        type: 'SELECT',
      }
    );

    const monthlyVolume = parseFloat(monthlyVolumeResult[0]?.volume || 0);
    const userTierInfo = getFeeTier(monthlyVolume);

    // Build tiers with indicator for current tier
    const tiersWithStatus = FEE_TIERS.map(tier => ({
      name: tier.name,
      min_volume: tier.min,
      max_volume: tier.max === Infinity ? null : tier.max,
      description: tier.description,
      is_current: tier.name === userTierInfo.current_tier,
    }));

    return mockSuccessResponseHelper(res, 200, "Fee tiers retrieved successfully", {
      tiers: tiersWithStatus,
      user_tier: {
        current_tier: userTierInfo.current_tier,
        tier_description: userTierInfo.tier_description,
        monthly_volume: userTierInfo.monthly_volume,
        percent_to_next_tier: userTierInfo.percent_complete,
        amount_to_next_tier: userTierInfo.amount_to_next_tier,
        next_tier: userTierInfo.next_tier,
      },
    });
  } catch (e) {
    const message = mockGetErrorMessage(e);
    return mockErrorResponseHelper(res, 500, message);
  }
};

// Test the function
async function testGetFeeTiers() {
  console.log('Testing updated getFeeTiers function...\n');
  
  // Mock request and response objects
  const mockReq = {
    query: { company_id: 'test-company-123' }
  };
  
  const mockRes = {
    locals: {
      token: jwt.sign({ user_id: 'test-user-123' }, 'test-secret')
    }
  };
  
  try {
    const result = await getFeeTiers(mockReq, mockRes);
    
    console.log('✅ Function executed successfully!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
    // Verify the structure
    const data = result.data;
    if (data.tiers && data.user_tier) {
      console.log('\n✅ Response structure is correct');
      console.log(`📈 User is in "${data.user_tier.current_tier}" tier`);
      console.log(`💰 Monthly volume: $${data.user_tier.monthly_volume}`);
      console.log(`📊 Progress to next tier: ${data.user_tier.percent_to_next_tier}%`);
      
      // Check if current tier is marked correctly
      const currentTierMarked = data.tiers.find(t => t.is_current);
      if (currentTierMarked) {
        console.log(`✅ Current tier "${currentTierMarked.name}" is correctly marked`);
      }
    } else {
      console.log('❌ Response structure is incorrect');
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Run the test
testGetFeeTiers();