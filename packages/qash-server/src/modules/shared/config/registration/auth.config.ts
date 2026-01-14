import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '3600',
    refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '604800',
  },
  admin: {
    email: process.env.ADMIN_EMAIL,
  },
  apiKey: process.env.X_API_KEY,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },
  para: {
    jwksUrl:
      process.env.PARA_JWKS_URL ||
      'https://api.beta.getpara.com/.well-known/jwks.json',
  },
}));
