export interface FileMetadata {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
  tags?: string[];
  description?: string;
}

export interface FileResponse {
  id: string;
  filename: string;
  url: string;
  metadata: FileMetadata;
}

export interface UploadFileDto {
  file: Buffer;
  filename: string;
  mimeType: string;
  uploadedBy: string;
  tags?: string[];
  description?: string;
}

export interface IStorageService {
  uploadFile(uploadDto: UploadFileDto): Promise<FileResponse>;
  downloadFile(fileId: string): Promise<Buffer>;
  getFileMetadata(fileId: string): Promise<FileMetadata>;
  deleteFile(fileId: string): Promise<boolean>;
  getFileUrl(fileId: string): Promise<string>;
}
