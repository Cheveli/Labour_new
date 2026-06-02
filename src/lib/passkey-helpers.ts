/* eslint-disable @typescript-eslint/no-explicit-any */
// Biometric WebAuthn Passkey Helper Utilities for Supabase Auth

// Converts base64url string to Uint8Array
export function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Converts Uint8Array to base64url string
export function bytesToBase64URL(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// Register a new fingerprint biometric passkey
export async function registerPasskey(supabase: any, friendlyName: string): Promise<boolean> {
  // 1. Get options from Supabase
  const { data: regOptions, error: optError } = await supabase.auth.passkey.startRegistration()
  if (optError) throw optError
  if (!regOptions) throw new Error("Failed to start registration")

  const { options, challenge_id } = regOptions

  // 2. Deserialize creation options (base64url -> ArrayBuffer)
  const challenge = base64UrlToUint8Array(options.challenge).buffer
  const user = {
    ...options.user,
    id: base64UrlToUint8Array(options.user.id).buffer
  }

  const excludeCredentials = options.excludeCredentials?.map((cred: any) => ({
    ...cred,
    id: base64UrlToUint8Array(cred.id).buffer
  }))

  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge,
    user,
    excludeCredentials
  }

  // 3. Invoke WebAuthn API on browser
  const credential = await navigator.credentials.create({ publicKey }) as any
  if (!credential) throw new Error("Fingerprint scan cancelled or failed")

  // 4. Serialize credential creation response
  let serializedCredential: any
  if (typeof credential.toJSON === 'function') {
    serializedCredential = credential.toJSON()
  } else {
    // Fallback serialization if toJSON is not native
    serializedCredential = {
      id: credential.id,
      rawId: credential.id,
      type: 'public-key',
      response: {
        attestationObject: bytesToBase64URL(new Uint8Array(credential.response.attestationObject)),
        clientDataJSON: bytesToBase64URL(new Uint8Array(credential.response.clientDataJSON)),
      },
      clientExtensionResults: credential.getClientExtensionResults()
    }
  }

  // 5. Complete registration verify check in Supabase Auth
  const { data: verifyData, error: verifyError } = await supabase.auth.passkey.verifyRegistration({
    challengeId: challenge_id,
    credential: serializedCredential
  })

  if (verifyError) throw verifyError

  // 6. Update friendly name of the registered passkey if provided
  if (verifyData?.id && friendlyName) {
    const { error: updateError } = await supabase.auth.passkey.update({
      passkeyId: verifyData.id,
      friendlyName: friendlyName
    })
    if (updateError) throw updateError
  }

  return true
}

// Log in using a registered fingerprint biometric passkey
export async function signInWithPasskey(supabase: any): Promise<any> {
  // 1. Start WebAuthn authentication ceremony
  const { data: authOptions, error: optError } = await supabase.auth.passkey.startAuthentication()
  if (optError) throw optError
  if (!authOptions) throw new Error("Failed to start authentication")

  const { options, challenge_id } = authOptions

  // 2. Deserialize request options (base64url -> ArrayBuffer)
  const challenge = base64UrlToUint8Array(options.challenge).buffer
  const allowCredentials = options.allowCredentials?.map((cred: any) => ({
    ...cred,
    id: base64UrlToUint8Array(cred.id).buffer
  }))

  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge,
    allowCredentials
  }

  // 3. Invoke WebAuthn API on browser
  const credential = await navigator.credentials.get({ publicKey }) as any
  if (!credential) throw new Error("Fingerprint authentication cancelled")

  // 4. Serialize credential assertion response
  let serializedCredential: any
  if (typeof credential.toJSON === 'function') {
    serializedCredential = credential.toJSON()
  } else {
    // Fallback serialization if toJSON is not native
    serializedCredential = {
      id: credential.id,
      rawId: credential.id,
      type: 'public-key',
      response: {
        authenticatorData: bytesToBase64URL(new Uint8Array(credential.response.authenticatorData)),
        clientDataJSON: bytesToBase64URL(new Uint8Array(credential.response.clientDataJSON)),
        signature: bytesToBase64URL(new Uint8Array(credential.response.signature)),
        userHandle: credential.response.userHandle
          ? bytesToBase64URL(new Uint8Array(credential.response.userHandle))
          : undefined
      },
      clientExtensionResults: credential.getClientExtensionResults()
    }
  }

  // 5. Submit verification request to Supabase to sign in
  const { data: sessionData, error: verifyError } = await supabase.auth.passkey.verifyAuthentication({
    challengeId: challenge_id,
    credential: serializedCredential
  })

  if (verifyError) throw verifyError
  return sessionData
}
