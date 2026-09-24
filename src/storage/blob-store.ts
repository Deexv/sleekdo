import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface BlobDescriptor {
  hash: string;
  size: number;
  mimeType: string;
  createdAt: number;
  preview?: string;
}

export interface BlobPointer {
  _blobRef: string;
  size: number;
  mimeType: string;
  preview: string;
}

export class ContentAddressedBlobStore {
  public readonly storageDir: string;

  constructor(baseWorkspaceDir: string) {
    this.storageDir = path.resolve(baseWorkspaceDir, '.sleekdo', 'blobs');
  }

  public async put(data: string | Buffer, mimeType = 'text/plain'): Promise<BlobDescriptor> {
    await fs.mkdir(this.storageDir, { recursive: true });

    const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const filePath = path.join(this.storageDir, `${hash}.blob`);

    try {
      await fs.access(filePath);
      // Already exists; deduplicated!
    } catch {
      await fs.writeFile(filePath, buf);
    }

    const preview = typeof data === 'string'
      ? data.slice(0, 160).replace(/\r?\n/g, ' ')
      : `<binary ${buf.length} bytes>`;

    return {
      hash,
      size: buf.length,
      mimeType,
      createdAt: Date.now(),
      preview,
    };
  }

  public async get(hash: string): Promise<Buffer | null> {
    const filePath = path.join(this.storageDir, `${hash}.blob`);
    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  public async getText(hash: string): Promise<string | null> {
    const buf = await this.get(hash);
    return buf ? buf.toString('utf8') : null;
  }

  public async has(hash: string): Promise<boolean> {
    const filePath = path.join(this.storageDir, `${hash}.blob`);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * If string exceeds threshold (default 4KB), stores in blob store and returns a compact pointer.
   * If within threshold, returns original string.
   */
  public async externalizeIfLarge(content: string, thresholdBytes = 4096): Promise<string | BlobPointer> {
    const byteLength = Buffer.byteLength(content, 'utf8');
    if (byteLength <= thresholdBytes) {
      return content;
    }

    const desc = await this.put(content, 'text/plain');
    return {
      _blobRef: desc.hash,
      size: desc.size,
      mimeType: desc.mimeType,
      preview: desc.preview || '',
    };
  }
}
