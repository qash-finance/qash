import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe } from 'node:test';
import { AppModule } from '../../src/app.module';

const TIME_OUT = 100_000_000;
jest.setTimeout(TIME_OUT);

describe('E2E Tests E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('App Routes', () => {
    it('should return true', async () => {
      expect(true).toBe(true);
    });
  });
});
