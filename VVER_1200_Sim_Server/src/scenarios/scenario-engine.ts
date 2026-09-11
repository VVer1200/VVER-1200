/**
 * @file scenario-engine.ts
 * @description External scenario perturbation generator.
 * Strictly isolated from physics: generates modifiers applied as boundary conditions.
 */

import { ControlInputs } from '../core/types.js';

export interface ScenarioModifiers {
  /** External reactivity offset [dk/k] */
  externalReactivity: number;
  /** Active primary coolant pump count override (0 to 4) */
  rcpCountOverride?: number;
  /** Forced feed water flow override [kg/s] */
  feedwaterFlowOverride?: number;
  /** Forced trip of generator grid breaker */
  forceGridTrip?: boolean;
}

export type ScenarioFunction = (time: number, inputs: ControlInputs) => ScenarioModifiers;

export class ScenarioEngine {
  private activeScenario: ScenarioFunction | null = null;

  setScenario(scenario: ScenarioFunction | null): void {
    this.activeScenario = scenario;
  }

  evaluate(time: number, inputs: ControlInputs): ScenarioModifiers {
    if (!this.activeScenario) {
      return { externalReactivity: 0.0 };
    }
    return this.activeScenario(time, inputs);
  }

  // Pre-configured standard benchmark scenarios:

  /**
   * Step Reactivity Insertion: +100 pcm step at t = tStart
   */
  static createStepReactivityScenario(
    delta_pcm: number = 100.0,
    tStart: number = 10.0
  ): ScenarioFunction {
    const delta_rho = delta_pcm * 1e-5;
    return (time: number) => {
      return {
        externalReactivity: time >= tStart ? delta_rho : 0.0
      };
    };
  }

  /**
   * Turbine Load Rejection / Grid Loss at t = tStart
   */
  static createLoadRejectionScenario(tStart: number = 10.0): ScenarioFunction {
    return (time: number) => {
      return {
        externalReactivity: 0.0,
        forceGridTrip: time >= tStart
      };
    };
  }

  /**
   * Trip of 1 Main Coolant Pump (4 -> 3 RCPs) at t = tStart
   */
  static createRcpTripScenario(tStart: number = 10.0): ScenarioFunction {
    return (time: number) => {
      return {
        externalReactivity: 0.0,
        rcpCountOverride: time >= tStart ? 3 : 4
      };
    };
  }
}
