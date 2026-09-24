/**
 * JSON-RPC Message Framing for LSP and DAP (Section 11 & 13)
 * Implements Content-Length based protocol framing.
 */

const HEADER_TERMINATOR = Buffer.from('\r\n\r\n', 'utf8');

export function encodeJsonRpcMessage(payload: any): Buffer {
  const jsonStr = JSON.stringify(payload);
  const body = Buffer.from(jsonStr, 'utf8');
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8');
  return Buffer.concat([header, body]);
}

export class JsonRpcFramer {
  private buffer = Buffer.alloc(0);

  public push(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
  }

  public drain(): any[] {
    const messages: any[] = [];

    while (true) {
      const termIdx = this.buffer.indexOf(HEADER_TERMINATOR);
      if (termIdx === -1) break;

      const headerText = this.buffer.slice(0, termIdx).toString('utf8');
      const match = headerText.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Drop invalid header
        this.buffer = this.buffer.slice(termIdx + HEADER_TERMINATOR.length);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const messageStart = termIdx + HEADER_TERMINATOR.length;
      const messageEnd = messageStart + contentLength;

      if (this.buffer.length < messageEnd) {
        // Need more data
        break;
      }

      const messageBuf = this.buffer.slice(messageStart, messageEnd);
      this.buffer = this.buffer.slice(messageEnd);

      try {
        const parsed = JSON.parse(messageBuf.toString('utf8'));
        messages.push(parsed);
      } catch {
        // Drop corrupt payload
      }
    }

    return messages;
  }

  public clear(): void {
    this.buffer = Buffer.alloc(0);
  }
}
