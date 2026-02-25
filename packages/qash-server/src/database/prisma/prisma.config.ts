import { defineConfig } from 'prisma/config';

const host = process.env.POSTGRES_HOST;
const isUnixSocket = host?.startsWith('/');

const url = isUnixSocket
  ? `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@/${process.env.POSTGRES_DB}?schema=${process.env.POSTGRES_SCHEMA}&host=${encodeURIComponent(host)}`
  : `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${host}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}?schema=${process.env.POSTGRES_SCHEMA}`;

export default defineConfig({
  datasource: { url },
});
