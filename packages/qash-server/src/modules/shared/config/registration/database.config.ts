import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const host = process.env.POSTGRES_HOST;
  const port = parseInt(process.env.POSTGRES_PORT, 10) || 6500;
  const user = encodeURIComponent(process.env.POSTGRES_USER);
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD as string);
  const db = encodeURIComponent(process.env.POSTGRES_DB as string);
  const sslParam = process.env.POSTGRES_DB_SSL === 'true' ? '&sslmode=no-verify' : '';
  const isUnixSocket = host?.startsWith('/');

  // Unix socket (Cloud SQL): use host as query param
  // TCP: use host:port in the standard position
  const url = isUnixSocket
    ? `postgresql://${user}:${password}@/${db}?schema=public&host=${encodeURIComponent(host)}${sslParam}`
    : `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public${sslParam}`;

  return {
    host,
    port,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    ssl: {
      rejectUnauthorized: false,
      require: process.env.POSTGRES_DB_SSL === 'true' ? true : false,
    },
    url,
  };
});
