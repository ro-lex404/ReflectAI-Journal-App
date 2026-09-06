import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// In-memory cache for accessed secrets to prevent latency on subsequent requests
const secretCache = new Map<string, string>();
let clientInstance: SecretManagerServiceClient | null = null;

function getClient(): SecretManagerServiceClient {
  if (!clientInstance) {
    clientInstance = new SecretManagerServiceClient();
  }
  return clientInstance;
}

/**
 * Resolves the active Google Cloud project ID from standard environment indicators.
 */
export function getProjectId(): string | undefined {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.PROJECT_ID ||
    process.env.GCLOUD_PROJECT
  );
}

/**
 * Dynamically retrieves a secret payload from Google Cloud Secret Manager,
 * with graceful, zero-downtime fallback to environment variable injection.
 *
 * @param secretId - The name of the secret in Google Cloud Secret Manager (e.g., 'GEMINI_API_KEY')
 * @param versionId - The secret version to access (defaults to 'latest')
 * @returns The decrypted secret string payload
 */
export async function accessSecret(
  secretId: string,
  versionId: string = 'latest'
): Promise<string> {
  // 1. Return from in-memory cache if previously resolved
  if (secretCache.has(secretId)) {
    return secretCache.get(secretId)!;
  }

  const projectId = getProjectId();

  // 2. Attempt Google Cloud Secret Manager RPC if project is configured
  if (projectId) {
    try {
      const client = getClient();
      const secretName = `projects/${projectId}/secrets/${secretId}/versions/${versionId}`;
      const [response] = await client.accessSecretVersion({ name: secretName });
      const payload = response.payload?.data?.toString();

      if (payload && payload.trim().length > 0) {
        secretCache.set(secretId, payload.trim());
        return payload.trim();
      }
    } catch (err: any) {
      // Log notification and continue to environment variable fallback
      console.warn(
        `[Secret Manager] Unable to retrieve secret "${secretId}" from Secret Manager API (${err?.message || 'Unauthorized / Not Found'}). Falling back to environment variable.`
      );
    }
  }

  // 3. Fallback to process.env injection (standard for Cloud Run mounted secrets or local .env)
  const envValue = process.env[secretId];
  if (envValue && envValue.trim().length > 0) {
    secretCache.set(secretId, envValue.trim());
    return envValue.trim();
  }

  throw new Error(
    `Operational credential "${secretId}" could not be resolved from Google Cloud Secret Manager or environment variables.`
  );
}

/**
 * Checks whether a secret is available either in memory cache or environment variable.
 */
export function isSecretAvailable(secretId: string): boolean {
  return Boolean(secretCache.get(secretId) || process.env[secretId]);
}
