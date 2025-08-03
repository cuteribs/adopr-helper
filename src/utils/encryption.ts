import * as crypto from 'crypto';
import * as os from 'os';
import * as vscode from 'vscode';

const algorithm = 'aes-256-gcm';
const encryptionFormat = 'base64';

/**
 * Generate a machine-specific encryption key based on hardware characteristics
 */
function getMachineKey(): Buffer {
    const machineId = vscode.env.machineId; // VS Code's unique machine identifier
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();

    // Combine machine characteristics to create a unique key
    const combinedData = `${machineId}.${hostname}.${platform}.${arch}`;

    // Create a hash to use as encryption key
    const key = crypto.createHash('sha256')
        .update(combinedData)
        .digest('hex')
        .substring(0, 32);
    return Buffer.from(key);
}

/**
 * Encrypt a string using AES-256-GCM with machine-specific key
 */
export function encryptPAT(pat: string): string {
    try {
        const key = getMachineKey();
        const iv = crypto.randomBytes(16); // Initialization vector
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(pat);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();
        const combinedData = `${authTag.toString(encryptionFormat)}.${iv.toString(encryptionFormat)}.${encrypted.toString(encryptionFormat)}`;
        return combinedData;
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Failed to encrypt PAT');
    }
}

/**
 * Decrypt a PAT using AES-256-GCM with machine-specific key
 */
export function decryptPAT(encryptedPAT: string): string {
    try {
        const key = getMachineKey();
        const parts = encryptedPAT.split('.');
        const authTag = Buffer.from(parts[0], encryptionFormat);
        const iv = Buffer.from(parts[1], encryptionFormat);
        const encrypted = Buffer.from(parts[2], encryptionFormat);
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Failed to decrypt PAT - this may be due to machine changes or corrupted data');
    }
}

/**
 * Safely get the PAT from configuration, handling both encrypted and plain text
 */
export function getDecryptedPAT(): string | undefined {
    const config = vscode.workspace.getConfiguration();
    const storedPAT = config.get<string>('adopr-helper.pat');

    if (!storedPAT) return undefined;

    try {
        return decryptPAT(storedPAT);
    } catch (error) {
        console.error('Failed to decrypt PAT:', error);
        vscode.window.showErrorMessage(
            'Failed to decrypt stored PAT. Please re-enter your Personal Access Token.',
            'Set PAT'
        ).then(selection => {
            if (selection === 'Set PAT') {
                vscode.commands.executeCommand('adopr-helper.setPAT');
            }
        });
        return undefined;
    }
}

/**
 * Store an encrypted PAT in configuration
 */
export async function storeEncryptedPAT(pat: string): Promise<void> {
    try {
        const encrypted = encryptPAT(pat);
        const config = vscode.workspace.getConfiguration();

        await config.update(
            'adopr-helper.pat',
            encrypted,
            vscode.ConfigurationTarget.Global
        );
    } catch (error) {
        console.error('Failed to store encrypted PAT:', error);
        throw new Error('Failed to securely store PAT');
    }
}

/**
 * Migrate existing plain text PAT to encrypted storage
 */
async function migrateToEncrypted(plainPAT: string): Promise<void> {
    try {
        await storeEncryptedPAT(plainPAT);
        vscode.window.showInformationMessage(
            'Your PAT has been automatically encrypted for better security.',
            { modal: false }
        );
    } catch (error) {
        console.warn('Failed to migrate PAT to encrypted storage:', error);
    }
}

/**
 * Clear the stored PAT (useful for logout or reset)
 */
export async function clearStoredPAT(): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    await config.update(
        'adopr-helper.pat',
        undefined,
        vscode.ConfigurationTarget.Global
    );
}
