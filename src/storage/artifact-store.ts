import * as fs from 'node:fs';
import * as path from 'node:path';
import { ReviewResult, WorkspaceSnapshot } from '../types/domain.js';

export class ArtifactStore {
  private readonly sleekdoDir: string;
  private readonly reviewsDir: string;
  private readonly artifactsDir: string;
  private readonly snapshotsDir: string;

  constructor(workspaceDir: string) {
    this.sleekdoDir = path.join(workspaceDir, '.sleekdo');
    this.reviewsDir = path.join(this.sleekdoDir, 'reviews');
    this.artifactsDir = path.join(this.sleekdoDir, 'artifacts');
    this.snapshotsDir = path.join(this.sleekdoDir, 'snapshots');
    this.ensureDirs();
  }

  private ensureDirs(): void {
    for (const dir of [this.reviewsDir, this.artifactsDir, this.snapshotsDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  public saveReview(review: ReviewResult): string {
    const filename = `${review.id}_${review.taskId}.json`;
    const filePath = path.join(this.reviewsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(review, null, 2), 'utf8');
    return filePath;
  }

  public getReview(reviewId: string): ReviewResult | null {
    const files = fs.readdirSync(this.reviewsDir);
    const target = files.find(f => f.startsWith(`${reviewId}_`) || f === `${reviewId}.json`);
    if (!target) return null;
    const content = fs.readFileSync(path.join(this.reviewsDir, target), 'utf8');
    return JSON.parse(content) as ReviewResult;
  }

  public saveSnapshot(snapshot: WorkspaceSnapshot): string {
    const filename = `${snapshot.id}.json`;
    const filePath = path.join(this.snapshotsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
    return filePath;
  }

  public getSnapshot(snapshotId: string): WorkspaceSnapshot | null {
    const filePath = path.join(this.snapshotsDir, `${snapshotId}.json`);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as WorkspaceSnapshot;
  }

  public saveArtifact(name: string, content: string | Buffer): string {
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(this.artifactsDir, safeName);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  public getArtifact(name: string): Buffer | null {
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(this.artifactsDir, safeName);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }

  public savePlan(version: number, planData: unknown): string {
    const plansDir = path.join(this.sleekdoDir, 'plans');
    if (!fs.existsSync(plansDir)) {
      fs.mkdirSync(plansDir, { recursive: true });
    }
    const filename = `plan_v${version}.json`;
    const filePath = path.join(plansDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(planData, null, 2), 'utf8');
    return filePath;
  }

  public getPlan(version: number): unknown | null {
    const plansDir = path.join(this.sleekdoDir, 'plans');
    const filePath = path.join(plansDir, `plan_v${version}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
}
