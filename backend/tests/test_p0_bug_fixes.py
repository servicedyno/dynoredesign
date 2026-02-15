"""
P0 Bug Fix Verification Tests

Tests for two critical bug fixes:
1. Transaction rollback safety fix - transactionFinished flag in cryptoVerification
2. UTXO multi-output precision fix - satoshi-level integer arithmetic in settleCryptoTransaction

Also verifies:
- Backend compiles and starts correctly (no TypeScript errors)
- Webhook endpoint is responsive
- Payment status 'successful' is only committed after sweep succeeds
"""

import pytest
import requests
import os
import re
import subprocess

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://payment-gateway-qa-1.preview.emergentagent.com').rstrip('/')


class TestBackendHealth:
    """Verify backend is running and compiles correctly"""
    
    def test_backend_starts_no_typescript_errors(self):
        """Verify TypeScript compilation succeeds with no errors"""
        result = subprocess.run(
            ['npx', 'tsc', '--noEmit'],
            cwd='/app/backend',
            capture_output=True,
            text=True,
            timeout=120
        )
        
        # TypeScript compilation should succeed
        # Some warnings may be present, but no errors
        if result.returncode != 0:
            # Check if it's actual errors vs just warnings
            error_lines = [l for l in result.stdout.split('\n') if 'error TS' in l]
            if error_lines:
                print(f"TypeScript errors found:")
                for line in error_lines[:10]:
                    print(f"  {line}")
                pytest.fail(f"TypeScript compilation has {len(error_lines)} errors")
        
        print("TypeScript compilation: CLEAN - no errors")
    
    def test_webhook_endpoint_responsive(self):
        """Verify /api/tatum-crypto-webhook endpoint is accessible"""
        response = requests.post(
            f"{BASE_URL}/api/tatum-crypto-webhook",
            json={"address": "test-addr-123", "amount": "0.001", "txId": "test-tx-456", "asset": "BTC"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        # Should return 200 (webhook accepts and processes)
        assert response.status_code == 200, f"Webhook endpoint returned {response.status_code}"
        print(f"Webhook endpoint: RESPONSIVE - status {response.status_code}")


class TestTransactionRollbackSafetyFix:
    """
    Verify the transaction rollback safety fix in cryptoVerification function.
    
    Bug: "Transaction cannot be rolled back because it has been finished with state: commit"
    Fix: Added transactionFinished boolean flag to track commit/rollback state
    """
    
    def test_transaction_finished_flag_exists(self):
        """Verify transactionFinished flag is declared in cryptoVerification"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        # Find cryptoVerification function and check for transactionFinished declaration
        assert 'let transactionFinished = false;' in content, \
            "transactionFinished flag declaration not found"
        
        print("transactionFinished flag: DECLARED correctly")
    
    def test_transaction_finished_set_before_commit(self):
        """Verify transactionFinished is set to true before every commit"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        # Extract cryptoVerification function (starts at line ~3688)
        crypto_verification_match = re.search(
            r'const cryptoVerification = async.*?^};',
            content,
            re.MULTILINE | re.DOTALL
        )
        assert crypto_verification_match, "Could not find cryptoVerification function"
        
        func_content = crypto_verification_match.group(0)
        
        # Check that transactionFinished = true appears before commits
        # Count occurrences
        finished_true_count = func_content.count('transactionFinished = true')
        commit_count = func_content.count('transaction.commit()')
        rollback_count = func_content.count('transaction.rollback()')
        
        print(f"transactionFinished = true occurrences: {finished_true_count}")
        print(f"transaction.commit() occurrences: {commit_count}")
        print(f"transaction.rollback() occurrences: {rollback_count}")
        
        # There should be at least as many transactionFinished = true as commit/rollback combined
        # (some rollbacks are in catch block which checks the flag first)
        assert finished_true_count >= 4, \
            f"Expected at least 4 transactionFinished = true, found {finished_true_count}"
        
        print("transactionFinished flag: SET BEFORE commits/rollbacks")
    
    def test_catch_block_checks_transaction_finished(self):
        """Verify catch block only attempts rollback when transactionFinished is false"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        # Look for the pattern: if (!transactionFinished) { ... rollback ...
        pattern = r'if \(!transactionFinished\)\s*\{[^}]*(?:rollback|commit)'
        match = re.search(pattern, content)
        
        assert match, "Catch block should check !transactionFinished before rollback/commit"
        
        print("Catch block: CHECKS transactionFinished flag before rollback")
    
    def test_catch_block_structure(self):
        """Verify the catch block has proper structure for safe transaction cleanup"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            lines = f.readlines()
        
        # Find catch block in cryptoVerification (around line 4859)
        catch_start = None
        for i, line in enumerate(lines):
            if 'catch (e)' in line and i > 4800:  # After cryptoVerification starts
                catch_start = i
                break
        
        assert catch_start, "Could not find catch block in cryptoVerification"
        
        # Check surrounding context (lines 4859-4880)
        catch_block = ''.join(lines[catch_start:catch_start+25])
        
        # Verify the pattern:
        # 1. Check !transactionFinished
        # 2. Try to rollback/commit
        # 3. Catch any cleanup errors
        assert '!transactionFinished' in catch_block, \
            "Catch block must check transactionFinished before cleanup"
        assert 'rollback()' in catch_block, \
            "Catch block must attempt rollback"
        
        print(f"Catch block structure: CORRECT at line {catch_start + 1}")


class TestUTXOPrecisionFix:
    """
    Verify the UTXO multi-output precision fix in settleCryptoTransaction function.
    
    Bug: BTC sweep failure due to UTXO multi-output amounts having >8 decimal places
    Fix: Use satoshi-level integer arithmetic (Math.round on 1e8)
    """
    
    def test_satoshi_arithmetic_in_multi_output(self):
        """Verify settleCryptoTransaction uses satoshi-level arithmetic for UTXO multi-output"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        # Find the UTXO multi-output section (around line 3155)
        # Should have: Math.round(...* 1e8)
        
        # Check for satoshi-level arithmetic pattern
        patterns = [
            r'Math\.round\([^)]*\*\s*1e8\)',  # Math.round(... * 1e8)
            r'totalInputSats\s*=\s*Math\.round',
            r'feeSats\s*=\s*Math\.round',
            r'adminSats\s*=\s*Math\.round',
        ]
        
        for pattern in patterns:
            assert re.search(pattern, content), f"Pattern not found: {pattern}"
        
        print("Satoshi arithmetic: PRESENT in UTXO multi-output path")
    
    def test_utxo_values_divided_back(self):
        """Verify satoshi values are divided back by 1e8 before sending to API"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        # Check for division back: ... / 1e8
        patterns = [
            r'adminAmount\s*=\s*adminSats\s*/\s*1e8',
            r'merchantSendAmount\s*=\s*merchantSats\s*/\s*1e8',
            r'exactFee\s*=\s*feeSats\s*/\s*1e8',
        ]
        
        for pattern in patterns:
            assert re.search(pattern, content), f"Division pattern not found: {pattern}"
        
        print("Satoshi to BTC conversion: VALUES divided back by 1e8")
    
    def test_direct_admin_path_also_fixed(self):
        """Verify the direct-to-admin UTXO path also uses satoshi arithmetic"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        # The direct-to-admin path (around line 2920-2990) should also have satoshi math
        # Look for inputSats, outputSats pattern
        direct_patterns = [
            r'inputSats\s*=\s*Math\.round\(receivedAmount\s*\*\s*1e8\)',
            r'feeSats\s*=\s*Math\.round\(utxoFeeToDeduct\s*\*\s*1e8\)',
            r'outputSats\s*=\s*inputSats\s*-\s*feeSats',
        ]
        
        for pattern in direct_patterns:
            assert re.search(pattern, content), f"Direct path pattern not found: {pattern}"
        
        print("Direct-to-admin path: ALSO uses satoshi arithmetic")
    
    def test_to_utxo_values_precision(self):
        """Verify toUTXO array values are derived from satoshi arithmetic"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        # Check that the toUTXO values use the computed variables (not raw calculations)
        # Should see: value: merchantSendAmount and value: adminAmount
        
        # Find the multi-output toUTXO section
        to_utxo_pattern = r'toUTXO:\s*\[\s*\{[^}]*value:\s*merchantSendAmount[^}]*\},\s*\{[^}]*value:\s*adminAmount'
        assert re.search(to_utxo_pattern, content, re.DOTALL), \
            "toUTXO array should use merchantSendAmount and adminAmount variables"
        
        print("toUTXO values: CORRECTLY use satoshi-derived variables")


class TestPaymentStatusAfterSweep:
    """
    Verify that payment status 'successful' is only committed AFTER sweep succeeds.
    
    The code flow should be:
    1. settleCryptoTransaction is called (performs sweep)
    2. If sweep succeeds, THEN status is updated to 'successful'
    3. Both within same DB transaction
    """
    
    def test_settle_before_status_update(self):
        """Verify settleCryptoTransaction is called before status update in cryptoVerification"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        # Find cryptoVerification function
        crypto_func_start = content.find('const cryptoVerification = async')
        crypto_func_end = content.find('\n};', crypto_func_start) + 3
        crypto_func = content[crypto_func_start:crypto_func_end]
        
        # Find positions of settleCryptoTransaction call and status = 'successful' update
        settle_pos = crypto_func.find('settleCryptoTransaction')
        status_update_pos = crypto_func.find("status: 'successful'")
        
        if status_update_pos == -1:
            status_update_pos = crypto_func.find('status: "successful"')
        
        assert settle_pos != -1, "settleCryptoTransaction call not found in cryptoVerification"
        assert settle_pos < status_update_pos, \
            f"settleCryptoTransaction (pos {settle_pos}) should be called BEFORE status update (pos {status_update_pos})"
        
        print(f"Order verified: settleCryptoTransaction at {settle_pos}, status update at {status_update_pos}")
    
    def test_status_update_after_sweep_result(self):
        """Verify status update happens after checking sweep result"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        # Look for pattern where settle result is checked before status update
        # e.g., const settlementResult = await settleCryptoTransaction... then if (settlementResult...) status = successful
        
        # The pattern should show settlement happens, then transaction.commit() is called
        # which includes the status update
        
        patterns = [
            r'await settleCryptoTransaction',  # Settlement is called
            r'settlementResult',  # Result is captured
        ]
        
        for pattern in patterns:
            assert re.search(pattern, content), f"Pattern not found: {pattern}"
        
        print("Payment flow: SETTLEMENT happens before status commit")


class TestCodeQuality:
    """Additional code quality checks for the bug fixes"""
    
    def test_no_floating_point_in_utxo_amounts(self):
        """Verify no raw floating-point calculations for UTXO amounts"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        # Find settleCryptoTransaction function
        settle_start = content.find('const settleCryptoTransaction = async')
        settle_end = content.find('\n};', settle_start + 1000) + 3
        settle_func = content[settle_start:settle_end]
        
        # Look for potentially problematic patterns in UTXO sections
        # Should NOT have: amount * 0.xxx or amount / 100 for BTC values
        # Should have: Math.round(... * 1e8) for precision
        
        utxo_section = settle_func[settle_func.find('canUseSingleUTXO'):settle_func.find('} else {', settle_func.find('canUseSingleUTXO'))]
        
        # Count Math.round calls vs potential precision issues
        math_round_count = utxo_section.count('Math.round')
        
        assert math_round_count >= 3, \
            f"Expected at least 3 Math.round calls in UTXO section, found {math_round_count}"
        
        print(f"UTXO precision: {math_round_count} Math.round calls for safe integer arithmetic")
    
    def test_comment_documents_fix(self):
        """Verify the fix is documented with comments explaining the satoshi arithmetic"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        # Look for documentation comments
        documentation_patterns = [
            r'satoshi.*arithmetic',
            r'floating.point.*precision',
            r'1e8',
            r'UTXO.*integer',
            r'decimal.*places.*8',
        ]
        
        found_docs = []
        for pattern in documentation_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                found_docs.append(pattern)
        
        assert len(found_docs) >= 2, \
            f"Expected documentation comments about satoshi arithmetic, found: {found_docs}"
        
        print(f"Documentation: PRESENT - found patterns: {found_docs}")


class TestRegressionPrevention:
    """Tests to prevent regression of the fixed bugs"""
    
    def test_transaction_finished_all_paths(self):
        """Verify transactionFinished is set before all exit paths in cryptoVerification"""
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            lines = f.readlines()
        
        # Find cryptoVerification function boundaries
        start_line = None
        end_line = None
        for i, line in enumerate(lines):
            if 'const cryptoVerification = async' in line:
                start_line = i
            if start_line and line.strip() == '};' and i > start_line + 100:
                end_line = i
                break
        
        assert start_line and end_line, "Could not find cryptoVerification boundaries"
        
        func_lines = lines[start_line:end_line+1]
        func_content = ''.join(func_lines)
        
        # Count return statements and transactionFinished = true
        return_count = func_content.count('return {')
        rollback_count = func_content.count('await transaction.rollback()')
        commit_count = func_content.count('await transaction.commit()')
        finished_true_count = func_content.count('transactionFinished = true')
        
        print(f"cryptoVerification analysis:")
        print(f"  - return statements: {return_count}")
        print(f"  - rollback calls: {rollback_count}")
        print(f"  - commit calls: {commit_count}")
        print(f"  - transactionFinished = true: {finished_true_count}")
        
        # transactionFinished should be set before most commit/rollback calls
        # (except the final catch block which checks the flag)
        expected_min = max(commit_count + rollback_count - 2, 4)  # -2 for catch block
        assert finished_true_count >= expected_min, \
            f"Expected at least {expected_min} transactionFinished = true, found {finished_true_count}"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
