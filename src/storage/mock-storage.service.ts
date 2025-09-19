import { Injectable } from '@nestjs/common';
import {
  IStorageService,
  FileMetadata,
  FileResponse,
  UploadFileDto,
} from './storage.interface';

@Injectable()
export class MockStorageService implements IStorageService {
  private files: Map<string, { buffer: Buffer; metadata: FileMetadata }> =
    new Map();

  uploadFile(uploadDto: UploadFileDto): Promise<FileResponse> {
    const fileId = this.generateFileId();
    const filename = `${fileId}_${uploadDto.filename}`;

    const metadata: FileMetadata = {
      id: fileId,
      filename,
      originalName: uploadDto.filename,
      mimeType: uploadDto.mimeType,
      size: uploadDto.file.length,
      uploadedAt: new Date(),
      uploadedBy: uploadDto.uploadedBy,
      tags: uploadDto.tags || [],
      description: uploadDto.description,
    };

    this.files.set(fileId, {
      buffer: uploadDto.file,
      metadata,
    });

    return Promise.resolve({
      id: fileId,
      filename,
      url: `http://localhost:8089/files/${fileId}`,
      metadata,
    });
  }

  downloadFile(fileId: string): Promise<Buffer> {
    const file = this.files.get(fileId);
    if (!file) {
      return Promise.reject(new Error(`File with id ${fileId} not found`));
    }
    return Promise.resolve(file.buffer);
  }

  getFileMetadata(fileId: string): Promise<FileMetadata> {
    const file = this.files.get(fileId);
    if (!file) {
      return Promise.reject(new Error(`File with id ${fileId} not found`));
    }
    return Promise.resolve(file.metadata);
  }

  deleteFile(fileId: string): Promise<boolean> {
    return Promise.resolve(this.files.delete(fileId));
  }

  getFileUrl(fileId: string): Promise<string> {
    const file = this.files.get(fileId);
    if (!file) {
      return Promise.reject(new Error(`File with id ${fileId} not found`));
    }
    return Promise.resolve(`http://localhost:8089/files/${fileId}`);
  }

  private generateFileId(): string {
    return `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Méthodes utilitaires pour les tests
  getStoredFilesCount(): number {
    return this.files.size;
  }

  clearAllFiles(): void {
    this.files.clear();
  }
}
