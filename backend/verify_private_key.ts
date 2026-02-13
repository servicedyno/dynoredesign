import { KeyManagementServiceClient } from '@google-cloud/kms';
import { ethers } from 'ethers';

async function verifyPrivateKey() {
  try {
    const encryptedPrivateKey = "CiQAAxOcdYBXr6dQRhCdxkOdZKGM5Z4d3FUKHebkNTFd0jiqfNsShwEqhAEKFAoMSh41C1oJ9ju+CTiCELmii7gMElIKShG4N+gs4OGcHuhp4ZrOU8BZNNfqaZrN/X3yHwDpze1utNbmIgaGeK1trjL1FgkXUa6mY14CKNqIQL6Y0YXKEawxr8JDL/Oc6kAkEK66uOQBGhgKECP+HNxMIa70BatFdEHzVKQQ9Y2j2As=";
    
    const projectId = process.env.PROJECT_ID;
    const locationId = process.env.LOCATION_ID;
    const keyRingId = process.env.KEY_RING_ID;
    const keyId = process.env.KEY_ID;
    
    const client = new KeyManagementServiceClient();
    const name = `projects/${projectId}/locations/${locationId}/keyRings/${keyRingId}/cryptoKeys/${keyId}`;
    
    const [decryptResponse] = await client.decrypt({
      name,
      ciphertext: Buffer.from(encryptedPrivateKey, 'base64'),
    });
    
    const privateKey = decryptResponse.plaintext?.toString('utf8');
    
    if (!privateKey) {
      console.error('Failed to decrypt private key');
      process.exit(1);
    }
    
    // Verify the address matches
    const wallet = new ethers.Wallet(privateKey);
    const derivedAddress = wallet.address;
    const expectedAddress = "0xdb0c01c41879d877654050002e6e6f283841c9c3";
    
    console.log('Decrypted private key successfully');
    console.log('Derived address:', derivedAddress);
    console.log('Expected address:', expectedAddress);
    console.log('Match:', derivedAddress.toLowerCase() === expectedAddress.toLowerCase());
    
    // Try to get nonce
    const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
    const nonce = await provider.getTransactionCount(derivedAddress);
    console.log('Current nonce:', nonce);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyPrivateKey();
