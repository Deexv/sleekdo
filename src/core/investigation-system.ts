import { Investigation, InvestigationId, TaskId, InvestigationHypothesis } from '../types/domain.js';
import { StateStore } from '../storage/state-store.js';

export class InvestigationSystem {
  private readonly stateStore: StateStore;

  constructor(stateStore: StateStore) {
    this.stateStore = stateStore;
  }

  public createInvestigation(
    taskId: TaskId,
    failure: { expected: string; actual: string; scenario: string },
    initialHypotheses: string[]
  ): Investigation {
    const id: InvestigationId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const hypotheses: InvestigationHypothesis[] = initialHypotheses.map((h, index) => ({
      id: `H${index + 1}`,
      description: h,
      status: 'untested',
    }));

    const investigation: Investigation = {
      id,
      taskId,
      observedFailure: failure,
      hypotheses,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.stateStore.updateState((draft) => {
      draft.investigations[id] = investigation;
    });

    return investigation;
  }

  public recordDiagnosticStep(
    investigationId: InvestigationId,
    hypothesisId: string,
    result: 'surviving' | 'eliminated',
    evidence: string
  ): Investigation {
    let updated: Investigation | undefined;
    this.stateStore.updateState((draft) => {
      const inv = draft.investigations[investigationId];
      if (!inv) throw new Error(`Investigation ${investigationId} not found`);

      const hyp = inv.hypotheses.find((h) => h.id === hypothesisId);
      if (hyp) {
        hyp.status = result;
        hyp.evidence = evidence;
      }
      inv.updatedAt = Date.now();
      updated = inv;
    });
    return updated!;
  }

  public confirmMechanism(
    investigationId: InvestigationId,
    description: string,
    evidence: string[],
    fixPlan: {
      description: string;
      smallestScopeFiles: string[];
      regressionTestPlan: string;
    }
  ): Investigation {
    let updated: Investigation | undefined;
    this.stateStore.updateState((draft) => {
      const inv = draft.investigations[investigationId];
      if (!inv) throw new Error(`Investigation ${investigationId} not found`);

      inv.confirmedMechanism = {
        description,
        evidence,
      };
      inv.fixPlan = fixPlan;
      inv.status = 'confirmed';
      inv.updatedAt = Date.now();
      updated = inv;
    });
    return updated!;
  }

  public resolveInvestigation(investigationId: InvestigationId): void {
    this.stateStore.updateState((draft) => {
      const inv = draft.investigations[investigationId];
      if (inv) {
        inv.status = 'resolved';
        inv.updatedAt = Date.now();
      }
    });
  }

  public getActiveInvestigations(): Investigation[] {
    const state = this.stateStore.getState();
    return Object.values(state.investigations).filter((inv) => inv.status === 'active' || inv.status === 'confirmed');
  }
}
