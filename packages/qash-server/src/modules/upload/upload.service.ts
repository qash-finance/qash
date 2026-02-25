import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Multer } from 'multer';
import { UploadTypeEnum, UploadResponseDto } from './upload.dto';
import { handleError } from '../../common/utils/errors';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3Client: S3Client;
  private readonly buckets: Record<string, string>;
  private readonly maxFileSizes = {
    [UploadTypeEnum.AVATAR]: 5 * 1024 * 1024, // 5MB
    [UploadTypeEnum.COMPANY_LOGO]: 10 * 1024 * 1024, // 10MB
    [UploadTypeEnum.MULTISIG_LOGO]: 10 * 1024 * 1024, // 10MB
  };
  private readonly allowedMimes = ['image/jpeg', 'image/png'];
  private readonly s3Endpoint: string;

  constructor(private configService: ConfigService) {
    const storageConfig = this.configService.get('storage') as any;

    if (!storageConfig) {
      throw new Error('Storage configuration not found (expecting "storage" config)');
    }

    if (storageConfig.type !== 's3' || !storageConfig.s3) {
      throw new Error('Storage is not configured for S3 (expected type "s3").');
    }

    const s3Config = storageConfig.s3;

    this.s3Endpoint = s3Config.endpoint;

    // Initialize S3 client with Supabase S3-compatible endpoint
    this.s3Client = new S3Client({
      region: s3Config.region,
      endpoint: s3Config.endpoint,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
      forcePathStyle: true,
    });

    this.buckets = s3Config.buckets;
  }

  async uploadFile(
    file: Express.Multer.File,
    uploadType: UploadTypeEnum,
    userId: number,
  ): Promise<UploadResponseDto> {
    try {
      this.validateFile(file, uploadType);

      const bucket = this.buckets[uploadType];
      if (!bucket) {
        throw new BadRequestException(`Unknown upload type: ${uploadType}`);
      }

      const storagePath = this.generateStoragePath(file.originalname, userId);

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: storagePath,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      // Generate public URL
      const url = this.buildPublicUrl(bucket, storagePath);

      return {
        url,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storagePath,
        uploadedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Upload failed for type ${uploadType}:`, error);
      handleError(error, this.logger);
    }
  }

  private validateFile(file: Express.Multer.File, uploadType: UploadTypeEnum): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const maxSize = this.maxFileSizes[uploadType];
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds limit of ${maxSize / (1024 * 1024)}MB`,
      );
    }

    if (!this.allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG and PNG images are allowed');
    }

    const ext = this.getExtension(file.originalname);
    if (!['jpg', 'jpeg', 'png'].includes(ext.toLowerCase())) {
      throw new BadRequestException('Invalid file extension. Only .jpg, .jpeg, and .png are allowed');
    }
  }

  private generateStoragePath(originalName: string, userId: number): string {
    const timestamp = Date.now();
    const ext = this.getExtension(originalName);
    return `${userId}/${timestamp}.${ext}`;
  }

  private getExtension(filename: string): string {
    return filename.split('.').pop() || '';
  }

  private buildPublicUrl(bucket: string, path: string): string {
    const endpoint = (this.s3Endpoint || '').replace(/\/$/, '');

    // If using Supabase's S3-compatible endpoint (e.g. <project>.storage.supabase.co),
    // construct the canonical public object URL:
    // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const supabaseMatch = endpoint.match(/^https?:\/\/([^.]+)\.storage\.supabase\.co(?:\/.*)?$/i);
    if (supabaseMatch) {
      const project = supabaseMatch[1];
      return `https://${project}.supabase.co/storage/v1/object/public/${bucket}/${path}`;
    }

    // Generic fallback: use the S3 endpoint directly
    return `${endpoint}/${bucket}/${path}`;
  }
}
