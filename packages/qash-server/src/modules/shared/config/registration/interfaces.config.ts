export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: {
    rejectUnauthorized: boolean;
    require: boolean;
  };
  url: string;
}

export interface MailConfig {
  mailgun: {
    domain: string;
    apiKey: string;
    from: {
      name: string;
    };
  };
  resendInterval: number;
}

export interface AuthConfig {
  jwt: {
    secret: string;
    accessTokenExpiresIn: string;
    refreshTokenExpiresIn: string;
  };
  admin: {
    email: string;
  };
  apiKey: string;
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  para: {
    jwksUrl: string;
  };
}

export interface OthersConfig {
  frontendUrl: string;
  allowsSandbox: boolean;
  allowedDomains: string;
  requireSignupWithReferral: boolean;
  referralCodeMaximumUsage: number;
  defaultRole: string;
  require2FA: boolean;
}

export interface ServerConfig {
  sessionSecret: string;
  host: string;
  port: number;
  serverUrl: string;
}
