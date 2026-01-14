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

    // Always allow localhost origins (for local development/testing)
    if (
      origin.startsWith('http://localhost:') ||
      origin.startsWith('https://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('https://127.0.0.1:')
    ) {
      return callback(null, origin); // Return specific origin, not true
    }
    return callback(null, origin); // Return specific origin

    // In production, check allowed domains
    if (appConfigService.nodeEnv === 'production') {
      const allowedDomains = appConfigService.otherConfig.allowedDomains;

      // If no allowedDomains configured, log warning but allow (for easier debugging)
      if (!allowedDomains) {
        console.warn(
          `⚠️  CORS: NODE_ENV is production but ALLOWED_DOMAINS is not set. ` +
            `Allowing origin: ${origin}. Please set ALLOWED_DOMAINS for security.`,
        );
        return callback(null, origin); // Return specific origin
      }

      const allowedList = allowedDomains.split(',').map((d) => d.trim());

      if (allowedList.includes(origin)) {
        return callback(null, origin); // Return specific origin
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    }

    // Development mode: allow all origins but return the specific origin
    // This is required when credentials: true is set
    return callback(null, origin);
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
        secure: false,
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

  await app.listen(port, host, async () => {
    console.info(`API server is running on http://${host}:${port}`);
  });
}
bootstrap();
