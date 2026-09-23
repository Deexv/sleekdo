import { ReviewDecision, TaskType } from '../types/domain.js';

export interface PlanTaskItem {
  id: string;
  title: string;
  objective: string;
  requirements: string[];
  acceptanceCriteria: string[];
  dependencies: string[];
  type?: TaskType;
}

export interface PlanRequirementItem {
  id: string;
  description: string;
  verificationCriteria: string[];
}

export interface InitialPlanOutput {
  requirements: PlanRequirementItem[];
  tasks: PlanTaskItem[];
  architectureOverview?: string;
}

export interface ReassessmentOutput {
  remainingRequirements: string[];
  newlyDiscoveredRequirements: PlanRequirementItem[];
  newTasks: PlanTaskItem[];
  obsoleteTaskIds: string[];
  defects: string[];
  isComplete: boolean;
  reason: string;
}

export interface ReviewOutput {
  decision: ReviewDecision;
  summary: string;
  requirementCompliance: boolean;
  acceptanceCriteriaMet: boolean;
  implementationExists: boolean;
  testsPass: boolean;
  noRegressions: boolean;
  scopeControlled: boolean;
  noDeadCodeIntroduced: boolean;
  blockingIssues: Array<{
    description: string;
    evidence: string;
    affectedRequirement: string;
    requiredFix: string;
    verification: string;
  }>;
}

export class SchemaValidator {
  public static validateInitialPlan(data: unknown): { valid: boolean; errors: string[]; parsed?: InitialPlanOutput } {
    const errors: string[] = [];
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Plan must be a JSON object'] };
    }

    const obj = data as Partial<InitialPlanOutput>;
    if (!Array.isArray(obj.requirements)) {
      errors.push('requirements must be an array');
    }
    if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
      errors.push('tasks must be a non-empty array');
    } else {
      for (let i = 0; i < obj.tasks.length; i++) {
        const t = obj.tasks[i];
        if (!t.id) errors.push(`task[${i}] missing id`);
        if (!t.title) errors.push(`task[${i}] missing title`);
        if (!t.objective) errors.push(`task[${i}] missing objective`);
        if (!Array.isArray(t.requirements)) errors.push(`task[${i}] requirements must be an array`);
        if (!Array.isArray(t.acceptanceCriteria) || t.acceptanceCriteria.length === 0) {
          errors.push(`task[${i}] acceptanceCriteria must be a non-empty array`);
        }
        if (!Array.isArray(t.dependencies)) errors.push(`task[${i}] dependencies must be an array`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      parsed: errors.length === 0 ? (obj as InitialPlanOutput) : undefined,
    };
  }

  public static validateReassessment(data: unknown): { valid: boolean; errors: string[]; parsed?: ReassessmentOutput } {
    const errors: string[] = [];
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Reassessment must be a JSON object'] };
    }

    const obj = data as Partial<ReassessmentOutput>;
    if (typeof obj.isComplete !== 'boolean') {
      errors.push('isComplete must be a boolean');
    }
    if (!Array.isArray(obj.remainingRequirements)) {
      errors.push('remainingRequirements must be an array');
    }
    if (!Array.isArray(obj.newTasks)) {
      errors.push('newTasks must be an array');
    }
    if (typeof obj.reason !== 'string' || !obj.reason) {
      errors.push('reason must be a non-empty string');
    }

    return {
      valid: errors.length === 0,
      errors,
      parsed: errors.length === 0 ? (obj as ReassessmentOutput) : undefined,
    };
  }

  public static validateReview(data: unknown): { valid: boolean; errors: string[]; parsed?: ReviewOutput } {
    const errors: string[] = [];
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Review must be a JSON object'] };
    }

    const obj = data as Partial<ReviewOutput>;
    const validDecisions: ReviewDecision[] = ['APPROVE', 'REJECT', 'BLOCK'];
    if (!obj.decision || !validDecisions.includes(obj.decision)) {
      errors.push(`decision must be one of: ${validDecisions.join(', ')}`);
    }

    if (typeof obj.summary !== 'string' || !obj.summary) {
      errors.push('summary must be a non-empty string');
    }

    if (typeof obj.requirementCompliance !== 'boolean') errors.push('requirementCompliance must be a boolean');
    if (typeof obj.acceptanceCriteriaMet !== 'boolean') errors.push('acceptanceCriteriaMet must be a boolean');
    if (typeof obj.implementationExists !== 'boolean') errors.push('implementationExists must be a boolean');
    if (typeof obj.testsPass !== 'boolean') errors.push('testsPass must be a boolean');
    if (typeof obj.noRegressions !== 'boolean') errors.push('noRegressions must be a boolean');
    if (typeof obj.scopeControlled !== 'boolean') errors.push('scopeControlled must be a boolean');
    if (typeof obj.noDeadCodeIntroduced !== 'boolean') errors.push('noDeadCodeIntroduced must be a boolean');

    if (obj.decision === 'REJECT') {
      if (!Array.isArray(obj.blockingIssues) || obj.blockingIssues.length === 0) {
        errors.push('A rejection must contain at least one blocking issue with concrete evidence');
      } else {
        for (let i = 0; i < obj.blockingIssues.length; i++) {
          const issue = obj.blockingIssues[i];
          if (!issue.description) errors.push(`blockingIssues[${i}] missing description`);
          if (!issue.evidence) errors.push(`blockingIssues[${i}] missing evidence`);
          if (!issue.affectedRequirement) errors.push(`blockingIssues[${i}] missing affectedRequirement`);
          if (!issue.requiredFix) errors.push(`blockingIssues[${i}] missing requiredFix`);
          if (!issue.verification) errors.push(`blockingIssues[${i}] missing verification`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      parsed: errors.length === 0 ? (obj as ReviewOutput) : undefined,
    };
  }
}
