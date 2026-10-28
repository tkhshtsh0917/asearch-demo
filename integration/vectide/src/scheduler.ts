/** Yields bounded tasks without nested-timer clamping and closes every owned port. */
export class TurnScheduler {
  private readonly channel =
    typeof MessageChannel === "function" ? new MessageChannel() : undefined;
  private readonly pending: (() => void)[] = [];
  private closed = false;
  constructor() {
    if (this.channel)
      this.channel.port1.onmessage = () => this.pending.shift()?.();
  }
  turn(): Promise<void> {
    if (this.closed) return Promise.reject(new Error("Scheduler disposed"));
    if (!this.channel) return new Promise((resolve) => setTimeout(resolve, 0));
    if (this.pending.length >= 2)
      return Promise.reject(new Error("Scheduler queue limit"));
    return new Promise((resolve) => {
      this.pending.push(resolve);
      this.channel?.port2.postMessage(null);
    });
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.channel?.port1.close();
    this.channel?.port2.close();
    for (const resolve of this.pending.splice(0)) resolve();
  }
}
