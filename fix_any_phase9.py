#!/usr/bin/env python3
"""
Phase 9: Fix final remaining 'any' types - targeted fixes
"""

import re
from pathlib import Path

def fix_specific_patterns(filepath):
    """Fix specific remaining patterns"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Swagger UI type assertions (library requires this)
        content = re.sub(
            r'swaggerUi\.serve as any',
            'swaggerUi.serve as express.RequestHandler[]',
            content
        )
        content = re.sub(
            r'\}\) as any\);$',
            '}) as express.RequestHandler);',
            content,
            flags=re.MULTILINE
        )
        
        # forEach with typed parameter
        content = re.sub(
            r'\.forEach\(\((\w+):\s*any,\s*(\w+)\)',
            r'.forEach((\1: Record<string, unknown>, \2)',
            content
        )
        
        # Query result casts
        content = re.sub(
            r'\)\s+as\s+any\[\];',
            ') as Array<Record<string, unknown>>;',
            content
        )
        
        # Single query result cast
        content = re.sub(
            r'const\s+\[(\w+)\]:\s*any\s*=\s*await\s+sequelize\.query',
            r'const [\1]: Array<Record<string, unknown>> = await sequelize.query',
            content
        )
        
        # Model metadata field
        content = re.sub(
            r'metadata\?:\s*any;',
            'metadata?: Record<string, unknown>;',
            content
        )
        
        # Association checks
        content = re.sub(
            r'\((\w+)\s+as\s+any\)\.associations',
            r'(\1 as unknown as { associations?: Record<string, unknown> }).associations',
            content
        )
        
        # Webhook functions with any
        content = re.sub(
            r'const\s+callMerchantWebhook\s*=\s*async\s*\(customerData:\s*any,\s*eventData:\s*any\)',
            'const callMerchantWebhook = async (customerData: Record<string, unknown>, eventData: Record<string, unknown>)',
            content
        )
        content = re.sub(
            r'eventData:\s*any,',
            'eventData: Record<string, unknown>,',
            content
        )
        
        # Payload casts
        content = re.sub(
            r'\(payload\s+as\s+any\)\.(\w+)',
            r'(payload as Record<string, unknown>).\1',
            content
        )
        
        # Service return types
        content = re.sub(
            r':\s*Promise<any\s*\|\s*null>',
            ': Promise<Record<string, unknown> | null>',
            content
        )
        
        # Record types
        content = re.sub(
            r':\s*Record<string,\s*any\[\]>',
            ': Record<string, Array<Record<string, unknown>>>',
            content
        )
        content = re.sub(
            r':\s*Record<string,\s*any>',
            ': Record<string, unknown>',
            content
        )
        content = re.sub(
            r'Map<string,\s*any>',
            'Map<string, Record<string, unknown>>',
            content
        )
        
        # as any on objects - convert to proper type
        content = re.sub(
            r'\}\s+as\s+any\);',
            '} as Record<string, unknown>);',
            content
        )
        
        # Referrer/user property access
        content = re.sub(
            r'\(referrer\s+as\s+any\)\?\.(\w+)',
            r'(referrer as Record<string, unknown> | null)?.\1',
            content
        )
        
        # Process stdout - special case for Node.js types
        content = re.sub(
            r'process\.stdout\.write\s*=\s*\(chunk:\s*any,\s*encoding\?:\s*any,\s*callback\?:\s*any\)',
            'process.stdout.write = (chunk: string | Uint8Array, encoding?: BufferEncoding | ((err?: Error) => void), callback?: (err?: Error) => void)',
            content
        )
        content = re.sub(
            r'\(process\.stdout\s+as\s+any\)\._handle\?\.flush',
            '(process.stdout as unknown as { _handle?: { flush?: () => void } })._handle?.flush',
            content
        )
        
        # Count result access
        content = re.sub(
            r'\(rows\[0\]\s+as\s+any\)\.count',
            '(rows[0] as Record<string, unknown>).count as number',
            content
        )
        
        # Array total/unique access
        content = re.sub(
            r'\((\w+)\[0\]\s+as\s+any\)\.(\w+)',
            r'(\1[0] as Record<string, unknown>).\2',
            content
        )
        
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
    
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    backend_dir = Path('/app/backend')
    
    # Target specific files we know have remaining issues
    target_files = [
        'swagger/index.ts',
        'server.ts',
        'routes/testRouter.ts',
        'models/securityModels/securityLogModel.ts',
        'models/associations.ts',
        'webhooks/index.ts',
        'services/pendingPaymentService.ts',
        'services/monitoringService.ts',
        'services/merchantPoolService.ts',
        'services/referralService.ts',
        'scripts/analysis/pool_address_analysis.ts',
        'scripts/debug/check_database.ts',
        'scripts/debug/check_result.ts',
        'scripts/debug/manual_trigger_payment.ts',
        'scripts/debug/check_admin_fees.ts',
        'scripts/migration/sync_database.ts',
    ]
    
    print("="*80)
    print("  Phase 9: Final Targeted Fixes for 100% Completion")
    print("="*80)
    print()
    
    fixed_count = 0
    
    for file_path in target_files:
        full_path = backend_dir / file_path
        if full_path.exists():
            if fix_specific_patterns(full_path):
                print(f"✓ {file_path}")
                fixed_count += 1
    
    print()
    print(f"✅ Fixed {fixed_count} files")

if __name__ == "__main__":
    main()
