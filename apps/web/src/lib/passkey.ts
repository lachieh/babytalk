import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";

import { gqlRequest } from "@/lib/tambo/graphql";

const REGISTER_START = `
  mutation PasskeyRegisterStart {
    passkeyRegisterStart { optionsJSON }
  }
`;

const REGISTER_FINISH = `
  mutation PasskeyRegisterFinish($response: String!, $nickname: String) {
    passkeyRegisterFinish(response: $response, nickname: $nickname) {
      id
      nickname
      deviceType
      backedUp
      createdAt
      lastUsedAt
    }
  }
`;

const AUTH_START = `
  mutation PasskeyAuthStart($email: String) {
    passkeyAuthStart(email: $email) { optionsJSON }
  }
`;

const AUTH_FINISH = `
  mutation PasskeyAuthFinish($response: String!) {
    passkeyAuthFinish(response: $response) {
      token
      user { id email }
    }
  }
`;

export interface PasskeyInfo {
  backedUp: boolean;
  createdAt: string;
  deviceType: string;
  id: string;
  lastUsedAt: string | null;
  nickname: string | null;
}

export const isPasskeySupported = (): boolean => browserSupportsWebAuthn();

export const isPlatformAuthenticatorAvailable = async (): Promise<boolean> => {
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
};

export const enrollPasskey = async (
  nickname: string | null
): Promise<PasskeyInfo> => {
  const { passkeyRegisterStart } = await gqlRequest<{
    passkeyRegisterStart: { optionsJSON: string };
  }>(REGISTER_START);

  const options = JSON.parse(
    passkeyRegisterStart.optionsJSON
  ) as PublicKeyCredentialCreationOptionsJSON;

  const attestation: RegistrationResponseJSON = await startRegistration({
    optionsJSON: options,
  });

  const result = await gqlRequest<{
    passkeyRegisterFinish: PasskeyInfo | null;
  }>(REGISTER_FINISH, {
    nickname,
    response: JSON.stringify(attestation),
  });

  if (!result.passkeyRegisterFinish) {
    throw new Error("Couldn't save passkey");
  }
  return result.passkeyRegisterFinish;
};

export interface PasskeyAuthSuccess {
  token: string;
  user: { email: string; id: string };
}

export const signInWithPasskey = async (
  email: string | null,
  options?: { conditional?: boolean }
): Promise<PasskeyAuthSuccess> => {
  const { passkeyAuthStart } = await gqlRequest<{
    passkeyAuthStart: { optionsJSON: string };
  }>(AUTH_START, { email });

  const parsed = JSON.parse(
    passkeyAuthStart.optionsJSON
  ) as PublicKeyCredentialRequestOptionsJSON;

  const assertion: AuthenticationResponseJSON = await startAuthentication({
    optionsJSON: parsed,
    useBrowserAutofill: options?.conditional ?? false,
  });

  const result = await gqlRequest<{
    passkeyAuthFinish: PasskeyAuthSuccess | null;
  }>(AUTH_FINISH, { response: JSON.stringify(assertion) });

  if (!result.passkeyAuthFinish) {
    throw new Error("Couldn't verify passkey");
  }
  return result.passkeyAuthFinish;
};
