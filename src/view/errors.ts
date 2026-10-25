/** Keeps query failures separate from publication and Worker failures. */
export interface QueryIdentity {
  id: number;
  epoch: number;
  generation: number;
}

export class SearchErrors {
  private readonly element: HTMLElement;
  private query: (QueryIdentity & { message: string }) | undefined;
  private operation = "";

  constructor(element: HTMLElement) {
    this.element = element;
  }

  queryFailed(message: string, identity: QueryIdentity) {
    this.query = { ...identity, message };
    this.render();
  }

  operationFailed(message: string) {
    this.operation = message;
    this.render();
  }

  /** Only a newer adopted result from this Worker can resolve a query failure. */
  accept(identity: QueryIdentity) {
    const failure = this.query;
    if (
      failure &&
      identity.generation === failure.generation &&
      identity.epoch >= failure.epoch &&
      identity.id > failure.id
    ) {
      this.query = undefined;
      this.render();
    }
  }

  clearOperation() {
    this.operation = "";
    this.render();
  }

  clear() {
    this.query = undefined;
    this.clearOperation();
  }

  private render() {
    this.element.textContent = [this.operation, this.query?.message]
      .filter(Boolean)
      .join("\n");
  }
}
