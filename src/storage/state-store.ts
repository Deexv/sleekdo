import * as fs from 'node:fs';
import * as path from 'node:path';
import { SleekdoState, TaskId, Task, ReviewId, ReviewResult, RequirementId, Requirement, InvestigationId, Investigation } from '../types/domain.js';

export class StateStore {
  private readonly sleekdoDir: string;
  private readonly statePath: string;
  private currentState: SleekdoState;

  constructor(workspaceDir: string) {
    this.sleekdoDir = path.join(workspaceDir, '.sleekdo');
    this.statePath = path.join(this.sleekdoDir, 'state.json');
    this.ensureDirs();
    this.currentState = this.loadOrCreateState();
  }

  private ensureDirs(): void {
    const dirs = [
      this.sleekdoDir,
      path.join(this.sleekdoDir, 'reviews'),
      path.join(this.sleekdoDir, 'artifacts'),
      path.join(this.sleekdoDir, 'snapshots'),
      path.join(this.sleekdoDir, 'locks'),
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private loadOrCreateState(): SleekdoState {
    if (fs.existsSync(this.statePath)) {
      try {
        const raw = fs.readFileSync(this.statePath, 'utf8');
        return JSON.parse(raw) as SleekdoState;
      } catch (err) {
        // Backup corrupted state
        const backupPath = `${this.statePath}.corrupted.${Date.now()}`;
        fs.copyFileSync(this.statePath, backupPath);
        throw new Error(`Corrupted state.json detected. Backed up to ${backupPath}: ${err}`);
      }
    }

    const initialState: SleekdoState = {
      revision: 0,
      projectId: `proj_${Date.now()}`,
      originalRequest: '',
      status: 'INITIALIZING',
      planVersion: 1,
      currentTaskId: null,
      tasks: {},
      requirements: {},
      reviews: {},
      investigations: {},
      cleanupFindings: [],
      snapshots: {},
      updatedAt: Date.now(),
    };

    this.saveState(initialState);
    return initialState;
  }

  public getState(): Readonly<SleekdoState> {
    return this.currentState;
  }

  public updateState(updater: (draft: SleekdoState) => void): SleekdoState {
    const nextState: SleekdoState = JSON.parse(JSON.stringify(this.currentState));
    updater(nextState);
    nextState.revision = (this.currentState.revision || 0) + 1;
    nextState.updatedAt = Date.now();
    this.saveState(nextState);
    this.currentState = nextState;
    return this.currentState;
  }

  private saveState(state: SleekdoState): void {
    const tempPath = `${this.statePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tempPath, this.statePath);
  }

  public getTask(id: TaskId): Task | undefined {
    return this.currentState.tasks[id];
  }

  public getRequirement(id: RequirementId): Requirement | undefined {
    return this.currentState.requirements[id];
  }

  public getReview(id: ReviewId): ReviewResult | undefined {
    return this.currentState.reviews[id];
  }

  public getInvestigation(id: InvestigationId): Investigation | undefined {
    return this.currentState.investigations[id];
  }

  public getRevision(): number {
    return this.currentState.revision;
  }
}
