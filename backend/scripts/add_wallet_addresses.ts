import userWalletModel from "../models/userModels/userWalletModel";

async function addWalletAddresses() {
  try {
    console.log("=== Adding BTC Wallet Address ===");
    
    // Update BTC wallet (ID: 430) with address and company
    await userWalletModel.update(
      {
        wallet_address: "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7",
        company_id: 38,
        wallet_name: "BTC Wallet - Johnnys LDA",
      },
      {
        where: {
          wallet_id: 430,
          user_id: 28,
        },
      }
    );
    
    console.log("✅ BTC Wallet updated successfully");
    
    // Verify
    const wallet = await userWalletModel.findOne({
      where: { wallet_id: 430 },
    });
    
    console.log("✅ Verification:", JSON.stringify(wallet?.dataValues, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

addWalletAddresses();
