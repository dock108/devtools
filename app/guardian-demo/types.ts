/**
 * Represents a single event in a fraud scenario
 */
export type ScenarioEvent = {
  /** Milliseconds to wait after the previous event before firing this one */
  delayMs: number;
  
  /** Stripe event type */
  type: string;
  
  /** Event payload data (Stripe object) */
  payload: {
    id: string;
    object: string;
    [key: string]: any;
  };
};

/**
 * A complete fraud scenario consisting of a sequence of events
 */
export type Scenario = ScenarioEvent[]; 