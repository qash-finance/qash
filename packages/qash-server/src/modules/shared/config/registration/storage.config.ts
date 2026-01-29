import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  type: 's3',
  s3: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'ap-southeast-2',
    buckets: {
      avatar: process.env.S3_AVATAR_BUCKET || 'user-avatars',
      companyLogo: process.env.S3_COMPANY_LOGO_BUCKET || 'company-logos',
      multisigLogo: process.env.S3_MULTISIG_LOGO_BUCKET || 'multisig-logos',
    },
  },
}));
