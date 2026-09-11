/**
 * @file run-tests.ts
 * @description Comprehensive automated physics validation test suite for VVER-1200 simulation engine.
 * Covers all 16 acceptance criteria requested in the specification.
 */

import { ReactorEngine } from '../simulation/reactor-engine.js';
import { ControlInputs } from '../core/types.js';
import { ScenarioEngine } from '../scenarios/scenario-engine.js';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, message: string, details?: string) {
  results.push({
    name,
    passed: condition,
    message: condition ? 'PASSED' : `FAILED: ${message}`,
    details
  });
}

console.log('===============================================================');
console.log('  VVER-1200 SIMULATION ENGINE - AUTOMATED VALIDATION SUITE');
console.log('===============================================================\n');

// Helper to get nominal baseline inputs
function getNominalInputs(): ControlInputs {
  return {
    rodPositionTarget: 0.70,
    rodControlMode: 'MANUAL',
    boronInjectionRate: 0.0,
    boronPumpActive: false,
    pureWaterPumpActive: false,
    turbineValveTarget: 1.00,
    turbineStopValvesOpen: true,
    feedwaterControlMode: 'AUTO',
    feedwaterFlowTarget: 1773.25,
    pzrControlMode: 'AUTO',
    pzrSprayValveTarget: 0.0,
    pzrHeaterPowerTarget: 0.18,
    rcpActive: [true, true, true, true],
    rcpSpeedTarget: 1.0,
    bruKTarget: -1,
    bruATarget: -1,
    gridConnected: true,
    manualScram: false
  };
}

// -------------------------------------------------------------
// Test 1: Initial state validity & Nominal Ratings
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const state = engine.getState();
  const valid = engine.validateState();

  const isNominalPower = Math.abs(state.derived.Q_thermal - 3200.0) < 1.0;
  const isNominalPress = Math.abs(state.derived.P_prim_MPa - 16.20) < 0.1;
  const isNominalSteamP = Math.abs(state.derived.P_sec_MPa - 7.00) < 0.1;

  assert(
    valid.valid && isNominalPower && isNominalPress && isNominalSteamP,
    'Test 1: Initial State Validity & Nominal Ratings',
    `Initial state check failed: power=${state.derived.Q_thermal}, P_prim=${state.derived.P_prim_MPa}, P_sec=${state.derived.P_sec_MPa}`,
    `Q_th=3200 MW, P_prim=16.20 MPa, P_sec=7.00 MPa`
  );
}

// -------------------------------------------------------------
// Test 2: Positive Reactivity Response (Ramp & Doppler Counteraction)
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();

  // Run 5 seconds steady
  for (let t = 0; t < 50; t++) engine.step(0.1, inputs);
  const p0 = engine.getState().derived.Q_thermal;

  // Insert +15 pcm positive reactivity ramp over 2 seconds (realistic operational perturbation)
  engine.getScenarioEngine().setScenario((time) => {
    const elapsed = Math.max(0.0, time - 5.0);
    const ramp = Math.min(15e-5, (15e-5 / 2.0) * elapsed);
    return { externalReactivity: ramp };
  });

  // Run 10 seconds: power should rise, then Doppler feedback stabilizes
  for (let t = 0; t < 100; t++) engine.step(0.1, inputs);
  const p1 = engine.getState().derived.Q_thermal;
  const doppler = engine.getState().derived.reactivity_doppler_pcm;

  const powerIncreased = p1 > p0;
  const dopplerCounteracted = doppler < -5.0; // Doppler must become negative

  assert(
    powerIncreased && dopplerCounteracted,
    'Test 2: Positive Reactivity Response & Doppler Counteraction',
    `P0=${p0.toFixed(1)}, P1=${p1.toFixed(1)}, Doppler=${doppler.toFixed(1)} pcm`,
    `Power rose from ${p0.toFixed(1)} to ${p1.toFixed(1)} MW, Doppler feedback is ${doppler.toFixed(1)} pcm`
  );
}

// -------------------------------------------------------------
// Test 3: Negative Reactivity Response (Insert Control Rods)
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();

  for (let t = 0; t < 20; t++) engine.step(0.1, inputs);
  const p0 = engine.getState().derived.Q_thermal;

  // Move rods from 70% to 50%
  inputs.rodPositionTarget = 0.50;
  for (let t = 0; t < 150; t++) engine.step(0.1, inputs);
  const p1 = engine.getState().derived.Q_thermal;

  assert(
    p1 < p0,
    'Test 3: Negative Reactivity Response (Rod Insertion)',
    `Power did not drop: P0=${p0.toFixed(1)}, P1=${p1.toFixed(1)}`,
    `Power decreased from ${p0.toFixed(1)} to ${p1.toFixed(1)} MW`
  );
}

// -------------------------------------------------------------
// Test 4: Power Increase Maneuver
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();
  inputs.rodPositionTarget = 0.72; // slight withdrawal
  for (let t = 0; t < 100; t++) engine.step(0.1, inputs);
  const state = engine.getState();

  assert(
    state.derived.Q_thermal > 3200.0 && state.derived.T_fuel_C > 600.0,
    'Test 4: Power Increase Maneuver',
    `Fuel temp did not rise with power: Tf=${state.derived.T_fuel_C}`,
    `Q_th=${state.derived.Q_thermal.toFixed(1)} MW, Tf=${state.derived.T_fuel_C.toFixed(1)} °C`
  );
}

// -------------------------------------------------------------
// Test 5: Power Decrease Maneuver
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();
  inputs.rodPositionTarget = 0.60; // insert rods
  for (let t = 0; t < 150; t++) engine.step(0.1, inputs);
  const state = engine.getState();

  assert(
    state.derived.Q_thermal < 3200.0 && state.derived.T_fuel_C < 600.0,
    'Test 5: Power Decrease Maneuver',
    `Expected power drop, got Q_th=${state.derived.Q_thermal.toFixed(1)}`,
    `Q_th=${state.derived.Q_thermal.toFixed(1)} MW, Tf=${state.derived.T_fuel_C.toFixed(1)} °C`
  );
}

// -------------------------------------------------------------
// Test 6: Heat Removal Change (Turbine Valve Step)
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();

  // Run initial stabilization
  for (let t = 0; t < 20; t++) engine.step(0.1, inputs);
  const P_sec_0 = engine.getState().derived.P_sec_MPa;

  // Partially close turbine valve to 90%
  inputs.turbineValveTarget = 0.90;
  for (let t = 0; t < 50; t++) engine.step(0.1, inputs);
  const P_sec_1 = engine.getState().derived.P_sec_MPa;

  assert(
    P_sec_1 > P_sec_0,
    'Test 6: Heat Removal Change (Steam Pressure Response)',
    `P_sec did not rise when throttling: P0=${P_sec_0.toFixed(2)}, P1=${P_sec_1.toFixed(2)}`,
    `Closing turbine valve caused secondary steam pressure to rise from ${P_sec_0.toFixed(2)} to ${P_sec_1.toFixed(2)} MPa`
  );
}

// -------------------------------------------------------------
// Test 7: Coolant Temperature Response & Moderator Feedback
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();
  // Heatup primary by reducing heat removal
  inputs.turbineValveTarget = 0.85;
  for (let t = 0; t < 100; t++) engine.step(0.1, inputs);
  const state = engine.getState();

  assert(
    state.derived.reactivity_coolant_pcm < 0.0,
    'Test 7: Coolant Temperature & Moderator Feedback',
    `Coolant reactivity is not negative upon heatup: ${state.derived.reactivity_coolant_pcm}`,
    `Coolant reactivity feedback is ${state.derived.reactivity_coolant_pcm.toFixed(1)} pcm (negative)`
  );
}

// -------------------------------------------------------------
// Test 8: Steam Generator Mass & Level Response
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();
  // Inject excess feedwater in MANUAL mode
  inputs.feedwaterControlMode = 'MANUAL';
  inputs.feedwaterFlowTarget = 2100.0; // higher than steam generation
  for (let t = 0; t < 100; t++) engine.step(0.1, inputs);
  const state = engine.getState();

  assert(
    state.derived.level_sg_m > 2.40,
    'Test 8: Steam Generator Level Response',
    `SG level did not rise with excess feedwater: L=${state.derived.level_sg_m.toFixed(2)} m`,
    `SG level increased to ${state.derived.level_sg_m.toFixed(2)} m`
  );
}

// -------------------------------------------------------------
// Test 9: Turbine Trip / Load Rejection Response
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();
  for (let t = 0; t < 20; t++) engine.step(0.1, inputs);

  // Grid breaker open (Load rejection)
  inputs.gridConnected = false;
  for (let t = 0; t < 50; t++) engine.step(0.1, inputs);
  const state = engine.getState();

  assert(
    state.derived.P_electric === 0.0 && state.derived.frequency_Hz > 49.0,
    'Test 9: Turbine Trip / Load Rejection',
    `Electrical power did not drop to zero or turbine stopped: Pel=${state.derived.P_electric}, f=${state.derived.frequency_Hz}`,
    `P_electric dropped to 0.0 MW, shaft frequency=${state.derived.frequency_Hz.toFixed(1)} Hz`
  );
}

// -------------------------------------------------------------
// Test 10: Self-Regulation: Return Toward Equilibrium
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();

  // Run 5 seconds steady
  for (let t = 0; t < 50; t++) engine.step(0.1, inputs);

  // Small perturbation of steam valve: open by 3%
  inputs.turbineValveTarget = 1.03;
  for (let t = 0; t < 300; t++) engine.step(0.1, inputs);
  const state = engine.getState();

  // The reactor self-regulates: derivatives decay and system settles into a stable equilibrium
  assert(
    Math.abs(state.diagnostics.maxDerivativeNorm) < 0.05 && state.derived.Q_thermal > 3100.0,
    'Test 10: Self-Regulation & Equilibrium Convergence',
    `System failed to reach self-regulated state: Q=${state.derived.Q_thermal.toFixed(1)}, norm=${state.diagnostics.maxDerivativeNorm}`,
    `Q_th smoothly settled at ${state.derived.Q_thermal.toFixed(1)} MW with derivative norm ${state.diagnostics.maxDerivativeNorm.toFixed(6)}`
  );
}

// -------------------------------------------------------------
// Test 11: Energy Balance Conservation Test
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();
  let maxRelEnergyError = 0.0;

  for (let t = 0; t < 100; t++) {
    const state = engine.step(0.1, inputs);
    if (state.diagnostics.energyBalanceRelPercent > maxRelEnergyError) {
      maxRelEnergyError = state.diagnostics.energyBalanceRelPercent;
    }
  }

  assert(
    maxRelEnergyError < 0.5,
    'Test 11: Conservation of Energy Check',
    `Energy discrepancy exceeded 0.5%: max error = ${maxRelEnergyError.toFixed(3)}%`,
    `Maximum relative energy error = ${maxRelEnergyError.toFixed(4)}% (< 0.5% threshold)`
  );
}

// -------------------------------------------------------------
// Test 12: Conservation of Mass Check
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();
  let maxPrimaryDrift = 0.0;

  for (let t = 0; t < 100; t++) {
    const state = engine.step(0.1, inputs);
    if (Math.abs(state.diagnostics.primaryMassDriftKg) > maxPrimaryDrift) {
      maxPrimaryDrift = Math.abs(state.diagnostics.primaryMassDriftKg);
    }
  }

  assert(
    maxPrimaryDrift === 0.0,
    'Test 12: Conservation of Mass Check (Primary Circuit)',
    `Primary coolant leaked or created: drift = ${maxPrimaryDrift} kg`,
    `Primary mass drift = 0.000 kg (perfect hermetic seal)`
  );
}

// -------------------------------------------------------------
// Test 13: Robustness: No NaN / No Infinity under Hard Inputs
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();
  inputs.manualScram = true; // drop scram rods
  inputs.turbineValveTarget = 0.0; // slam turbine valve shut
  inputs.pzrSprayValveTarget = 1.0; // full spray
  inputs.feedwaterFlowTarget = 0.0; // trip feedwater

  let hadNaNorInf = false;
  for (let t = 0; t < 100; t++) {
    const state = engine.step(0.05, inputs);
    if (!state.diagnostics.numericalStable || !state.diagnostics.physicalBoundsPassed) {
      hadNaNorInf = true;
      break;
    }
  }

  assert(
    !hadNaNorInf,
    'Test 13: Numerical Robustness (No NaN, No Inf under Severe Trip)',
    `Encountered NaN, Inf or physical bounds violation during crash transient`,
    `System safely withstood scram, valve closure, and spray without numerical explosion`
  );
}

// -------------------------------------------------------------
// Test 14: Deterministic Simulation Reproducibility
// -------------------------------------------------------------
{
  const engine1 = new ReactorEngine();
  const engine2 = new ReactorEngine();
  const inputs = getNominalInputs();
  inputs.rodPositionTarget = 0.65;

  for (let t = 0; t < 100; t++) {
    engine1.step(0.05, inputs);
    engine2.step(0.05, inputs);
  }

  const s1 = engine1.getState();
  const s2 = engine2.getState();
  const identical = s1.internal.n === s2.internal.n &&
                    s1.internal.T_fuel === s2.internal.T_fuel &&
                    s1.internal.P_prim === s2.internal.P_prim;

  assert(
    identical,
    'Test 14: Deterministic Simulation Reproducibility',
    `Engines diverged on identical seed and inputs: n1=${s1.internal.n}, n2=${s2.internal.n}`,
    `Exact bit-level state reproduction achieved across independent engine runs`
  );
}

// -------------------------------------------------------------
// Test 15: Timestep Sensitivity Verification (dt=0.01s vs dt=0.05s)
// -------------------------------------------------------------
{
  const engineSmallDt = new ReactorEngine();
  const engineLargeDt = new ReactorEngine();
  const inputs = getNominalInputs();

  // Run 10 seconds simulation time
  for (let t = 0; t < 1000; t++) engineSmallDt.step(0.01, inputs);
  for (let t = 0; t < 200; t++) engineLargeDt.step(0.05, inputs);

  const p_small = engineSmallDt.getState().derived.Q_thermal;
  const p_large = engineLargeDt.getState().derived.Q_thermal;
  const relativeDiff = Math.abs(p_small - p_large) / p_small;

  assert(
    relativeDiff < 0.005, // < 0.5% difference
    'Test 15: Timestep Sensitivity Check (0.01s vs 0.05s)',
    `Timestep sensitivity exceeded 0.5%: diff=${(relativeDiff * 100).toFixed(3)}%`,
    `Thermal power discrepancy between dt=0.01s and dt=0.05s is ${(relativeDiff * 100).toFixed(4)}% (< 0.5%)`
  );
}

// -------------------------------------------------------------
// Test 16: Primary Coolant Pump Trip (4 -> 3 RCPs)
// -------------------------------------------------------------
{
  const engine = new ReactorEngine();
  const inputs = getNominalInputs();
  for (let t = 0; t < 20; t++) engine.step(0.1, inputs);
  const w0 = engine.getState().internal.W_prim;

  // Trip 1 pump
  engine.getScenarioEngine().setScenario(() => ({ externalReactivity: 0.0, rcpCountOverride: 3 }));
  for (let t = 0; t < 100; t++) engine.step(0.1, inputs);
  const w1 = engine.getState().internal.W_prim;

  assert(
    w1 < w0 && w1 > 0.70 * w0,
    'Test 16: RCP Trip Dynamic Flow Decrease (4 -> 3 Pumps)',
    `Flow did not drop realistically: W0=${w0.toFixed(0)}, W1=${w1.toFixed(0)}`,
    `Flow dropped from ${w0.toFixed(0)} kg/s (100%) to ${w1.toFixed(0)} kg/s (~${((w1 / w0) * 100).toFixed(1)}%)`
  );
}

// -------------------------------------------------------------
// SUMMARY DISPLAY
// -------------------------------------------------------------
let allPassed = true;
console.log('Test Results:');
for (const res of results) {
  const symbol = res.passed ? '✓' : '✗';
  console.log(` ${symbol} [${res.passed ? 'PASS' : 'FAIL'}] ${res.name}`);
  if (res.details) {
    console.log(`     Details: ${res.details}`);
  }
  if (!res.passed) {
    allPassed = false;
    console.log(`     Error: ${res.message}`);
  }
}

console.log('\n===============================================================');
if (allPassed) {
  console.log(`  ALL ${results.length} TESTS PASSED SUCCESSFULLY!`);
  console.log('  Engine is verified against mathematical specification.');
} else {
  console.log('  TEST SUITE COMPLETED WITH FAILURES.');
  process.exit(1);
}
console.log('===============================================================\n');
