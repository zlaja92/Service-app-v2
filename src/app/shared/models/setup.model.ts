export interface HeatPumpSetup {
  fuses: string;
  wiring: string;
  fid: string;
  modbusCable: string;
  coolingSystem: string;
  boiler: string;
  buffer: string;
  expansionTank: string;
  filter: string;
  pressure: string;
  vacuum: string;
  pipeLength: string;
  additionalFreon: string;
  waterPressure: string;
  temperatures: string;
  compressorData: string;
}

export interface GasBoilerSetup {
  gasType: string;
  voltage: string;
  pressureSettings: string;
  systemPressure: string;
  leakTested: boolean;
  installationVerified: boolean;
}
