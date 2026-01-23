export interface FeeTier {
    min: number;
    max: number | null;
    fixed: number;
    buffer: number;
}

export const getBlockchainThreshold = (blockchain: string): number => {
    const envKey = `${blockchain.replace(/-/g, '_').toUpperCase()}_THRESHOLD`;
    return Number(process.env[envKey]) || 5;
};

export const getTransactionFeePercent = (): number => {
    return Number(process.env.TRANSACTION_FEE_PERCENT) || 2.0;
};

export const getFeeTiers = (): FeeTier[] => {
    // Check for new individual tier format first
    if (process.env.FEE_TIER_1_MIN) {
        const tiers: FeeTier[] = [];
        let tierNum = 1;
        
        while (process.env[`FEE_TIER_${tierNum}_MIN`]) {
            const min = Number(process.env[`FEE_TIER_${tierNum}_MIN`]);
            const maxVal = Number(process.env[`FEE_TIER_${tierNum}_MAX`]);
            const max = maxVal === 0 ? null : maxVal; // 0 means unlimited
            const fixed = Number(process.env[`FEE_TIER_${tierNum}_FIXED`]);
            const buffer = Number(process.env[`FEE_TIER_${tierNum}_BUFFER`]);
            
            tiers.push({ min, max, fixed, buffer });
            tierNum++;
        }
        
        if (tiers.length > 0) return tiers;
    }
    
    // Legacy format support: BLOCKCHAIN_FEE_TIERS
    const tierString = process.env.BLOCKCHAIN_FEE_TIERS;
    if (tierString) {
        return tierString.split(',').map(tier => {
            const [range, fee, bufferPart] = tier.split(':');
            const fixed = parseFloat(fee);
            const buffer = bufferPart ? parseFloat(bufferPart) : 0;

            if (range.includes('+')) {
                const min = parseFloat(range.replace('+', ''));
                return { min, max: null, fixed, buffer };
            }

            const [min, max] = range.split('-').map(Number);
            return { min, max, fixed, buffer };
        });
    }
    
    // Default tiers
    return [
        { min: 5, max: 100, fixed: 3, buffer: 1.0 },
        { min: 101, max: 500, fixed: 2, buffer: 0.8 },
        { min: 501, max: 1000, fixed: 1.5, buffer: 0.5 },
        { min: 1001, max: null, fixed: 1, buffer: 0.3 }
    ];
};
