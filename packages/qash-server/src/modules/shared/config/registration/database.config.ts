import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT, 10) || 6500,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  ssl: {
    rejectUnauthorized: false,
    require: process.env.POSTGRES_DB_SSL === 'true' ? true : false,
  },
  url: `postgresql://${encodeURIComponent(process.env.POSTGRES_USER)}:${encodeURIComponent(
    process.env.POSTGRES_PASSWORD as string,
  )}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${encodeURIComponent(
    process.env.POSTGRES_DB as string,
  )}?schema=public${process.env.POSTGRES_DB_SSL === 'true' ? '&sslmode=no-verify' : ''}`,
}));
