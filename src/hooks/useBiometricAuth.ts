import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '../lib/supabase';

const CREDENTIAL_KEY = 'biometric_credential_id';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export function useBiometricAuth() {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // Check if WebAuthn (biometric authentication) is supported
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => {
          setIsSupported(available);
        })
        .catch(() => {
          setIsSupported(false);
        });
    }

    // Check if user enabled biometric login in settings
    Preferences.get({ key: BIOMETRIC_ENABLED_KEY }).then((res) => {
      setIsEnabled(res.value === 'true');
    });
  }, []);

  // Helper to convert array buffer to base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Helper to convert base64 to array buffer
  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Register passkey/biometric credential
  const registerBiometric = async (username: string): Promise<boolean> => {
    try {
      if (!isSupported) throw new Error('Biometric authentication is not supported on this device');

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const creationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'TaskFlow ERP',
          id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        },
        user: {
          id: userId,
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      };

      const credential = (await navigator.credentials.create({
        publicKey: creationOptions,
      })) as PublicKeyCredential;

      if (credential) {
        const credentialIdBase64 = arrayBufferToBase64(credential.rawId);
        await Preferences.set({ key: CREDENTIAL_KEY, value: credentialIdBase64 });
        
        // Save Supabase refresh token
        const sessionRes = await supabase.auth.getSession();
        const refreshToken = sessionRes.data.session?.refresh_token;
        if (refreshToken) {
          await Preferences.set({ key: 'saved_refresh_token', value: refreshToken });
        }

        await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: 'true' });
        setIsEnabled(true);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('[Biometric Registration Error]', err);
      throw new Error(err.message || 'Failed to register biometric credentials');
    }
  };

  // Authenticate using passkey/biometric
  const authenticateBiometric = async (): Promise<boolean> => {
    try {
      if (!isSupported) throw new Error('Biometric authentication is not supported on this device');

      const credentialIdRes = await Preferences.get({ key: CREDENTIAL_KEY });
      if (!credentialIdRes.value) {
        throw new Error('No biometric credentials registered on this device');
      }

      const rawCredentialId = base64ToArrayBuffer(credentialIdRes.value);
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const requestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [
          {
            id: rawCredentialId,
            type: 'public-key',
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      };

      const assertion = await navigator.credentials.get({
        publicKey: requestOptions,
      });

      return !!assertion;
    } catch (err: any) {
      console.error('[Biometric Authentication Error]', err);
      throw new Error(err.message || 'Biometric verification failed');
    }
  };

  // Login using biometrics & supabase session recovery
  const loginWithBiometrics = async (): Promise<boolean> => {
    const verified = await authenticateBiometric();
    if (!verified) return false;

    const savedTokenRes = await Preferences.get({ key: 'saved_refresh_token' });
    if (!savedTokenRes.value) {
      throw new Error('Biometric login is enabled, but no security token is stored. Please log in with your password first.');
    }

    const { error } = await supabase.auth.setSession({
      refresh_token: savedTokenRes.value,
      access_token: '',
    });

    if (error) {
      throw new Error('Authentication token expired. Please log in with your password.');
    }

    return true;
  };

  // Disable biometric login
  const disableBiometric = async () => {
    await Preferences.remove({ key: CREDENTIAL_KEY });
    await Preferences.remove({ key: 'saved_refresh_token' });
    await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: 'false' });
    setIsEnabled(false);
  };

  return {
    isSupported,
    isEnabled,
    registerBiometric,
    authenticateBiometric,
    loginWithBiometrics,
    disableBiometric,
  };
}

