import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { useContainer } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'body-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SwaggerTheme, SwaggerThemeNameEnum } from 'swagger-themes';

import session from 'express-session';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { APP } from './common/constants';
import { AppConfigService } from './modules/shared/config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: false,
  });
  const configService = app.get(ConfigService);
  const appConfigService = new AppConfigService(configService);

  // Trust proxy for Google Cloud and other load balancers
  // This allows Express to properly detect HTTPS via X-Forwarded-Proto header
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  // CORS configuration with proper credentials support for cookies
  const corsOrigin = (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) {
      return callback(null, true);
    }

    // Development: Allow all localhost and 127.0.0.1 origins on any port
    if (appConfigService.nodeEnv !== 'production') {
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('https://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('https://127.0.0.1:')
      ) {
        console.log(`✅ CORS: Allowing development origin: ${origin}`);
        return callback(null, origin);
      }
      // In dev mode, allow all origins for easier testing
      console.log(`✅ CORS: Allowing development origin: ${origin}`);
      return callback(null, origin);
    }

    // Production: Check allowed domains
    const allowedDomains = appConfigService.otherConfig.allowedDomains;

    // If no allowedDomains configured, log warning but allow (for easier debugging)
    if (!allowedDomains) {
      console.warn(
        `⚠️  CORS: NODE_ENV is production but ALLOWED_DOMAINS is not set. ` +
          `Allowing origin: ${origin}. Please set ALLOWED_DOMAINS for security.`,
      );
      return callback(null, origin);
    }

    const allowedList = allowedDomains.split(',').map((d) => d.trim());

    if (allowedList.includes(origin)) {
      console.log(`✅ CORS: Allowing production origin: ${origin}`);
      return callback(null, origin);
    } else {
      console.error(`❌ CORS: Blocking origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }
  };

  app.enableCors({
    origin: corsOrigin,
    credentials: true, // ⚠️ CRITICAL: Allows cookies to be sent/received
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie'],
  });

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  app.use(cookieParser());

  const sessionSecret = appConfigService.serverConfig.sessionSecret;

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: appConfigService.nodeEnv === 'production', // HTTPS only in production
        httpOnly: true,
        sameSite: appConfigService.nodeEnv === 'production' ? 'strict' : 'lax', // Relaxed for dev
        maxAge: 1000 * 60 * 60 * 24, // 1 day
      },
    }),
  );

  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ limit: '5mb', extended: true }));

  const config = new DocumentBuilder()
    .setTitle(`${APP} API`)
    .setDescription('API description')
    .setVersion('1.0')
    .addTag('api')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // here filtered out the sandbox endpoints, by checking the operationId(function name)
  const isAllowSandbox =
    appConfigService.otherConfig.allowsSandbox.toString() == 'false'
      ? false
      : true;

  if (!isAllowSandbox) {
    document.paths = Object.fromEntries(
      Object.entries(document.paths).filter(([_, methods]) => {
        return !Object.values(methods).some((method) => {
          return (
            method.operationId &&
            method.operationId.toLowerCase().includes('sandbox')
          );
        });
      }),
    );
  }

  const theme = new SwaggerTheme();
  const optionsV1 = {
    explorer: true,
    customCss: theme.getBuffer(SwaggerThemeNameEnum.DARK),
  };
  const optionsV2 = {
    explorer: true,
    customCss: theme.getBuffer(SwaggerThemeNameEnum.DARK),
  };

  SwaggerModule.setup('api-v1', app, document, optionsV1);
  SwaggerModule.setup('api-v2', app, document, optionsV2);

  const host = appConfigService.serverConfig.host;
  const port = appConfigService.serverConfig.port;

  app.use(helmet());

  // Graceful shutdown — release port before watch-mode restart
  const shutdown = async (signal: string) => {
    console.info(`\n${signal} received — closing server…`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await app.listen(port, host, async () => {
    console.info(`API server is running on http://${host}:${port}`);
  });
}
bootstrap();
