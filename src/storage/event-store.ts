import * as fs from 'node:fs';
import * as path from 'node:path';
import { SleekdoEvent, EventType, EventId, TaskId } from '../types/domain.js';

export class EventStore {
  private readonly eventsPath: string;

  constructor(workspaceDir: string) {
    const sleekdoDir = path.join(workspaceDir, '.sleekdo');
    if (!fs.existsSync(sleekdoDir)) {
      fs.mkdirSync(sleekdoDir, { recursive: true });
    }
    this.eventsPath = path.join(sleekdoDir, 'events.jsonl');
  }

  public appendEvent(
    revision: number,
    type: EventType,
    actor: 'ORCHESTRATOR' | 'A1' | 'A2' | 'A3' | 'USER' | 'SYSTEM',
    data: Record<string, unknown> = {},
    taskId?: TaskId
  ): SleekdoEvent {
    const event: SleekdoEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      revision,
      timestamp: Date.now(),
      type,
      actor,
      taskId,
      data,
    };

    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(this.eventsPath, line, 'utf8');
    return event;
  }

  public getEvents(filter?: { taskId?: TaskId; type?: EventType }): SleekdoEvent[] {
    if (!fs.existsSync(this.eventsPath)) {
      return [];
    }

    const content = fs.readFileSync(this.eventsPath, 'utf8');
    const lines = content.trim().split('\n');
    const events: SleekdoEvent[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line) as SleekdoEvent;
        if (filter?.taskId && ev.taskId !== filter.taskId) continue;
        if (filter?.type && ev.type !== filter.type) continue;
        events.push(ev);
      } catch {
        // Skip malformed individual line in append-only log
      }
    }

    return events;
  }

  public getLatestEvent(): SleekdoEvent | null {
    const events = this.getEvents();
    return events.length > 0 ? events[events.length - 1] : null;
  }
}
