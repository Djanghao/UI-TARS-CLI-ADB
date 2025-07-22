/*
 * Author: Houston Zhang
 * SPDX-License-Identifier: Apache-2.0
 */

import { PredictionParsed, StatusEnum, GUIAgentData, GUIAgentError } from '../shared/types';

export interface ScreenshotOutput {
  base64: string;
  scaleFactor: number;
}

export interface ExecuteParams {
  prediction: string;
  parsedPrediction: PredictionParsed;
  screenWidth: number;
  screenHeight: number;
  scaleFactor: number;
  factors: [number, number];
}

export interface ExecuteOutput {
  status?: StatusEnum;
}

export interface Logger {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

export abstract class Operator {
  static MANUAL?: {
    ACTION_SPACES: string[];
  };

  abstract screenshot(): Promise<ScreenshotOutput>;
  abstract execute(params: ExecuteParams): Promise<ExecuteOutput>;
}

export interface RetryConfig {
  maxRetries?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export interface ModelConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  useResponsesApi?: boolean;
}

export interface GUIAgentConfig<TOperator extends Operator> {
  operator: TOperator;
  model: ModelConfig | UITarsModel;
  systemPrompt?: string;
  signal?: AbortSignal;
  onData?: (params: { data: GUIAgentData }) => void;
  onError?: (params: { data: GUIAgentData; error: GUIAgentError }) => void;
  logger?: Logger;
  retry?: {
    model?: RetryConfig;
    screenshot?: RetryConfig;
    execute?: RetryConfig;
  };
  maxLoopCount?: number;
  loopIntervalInMs?: number;
}

export class UITarsModel {
  public factors: [number, number] = [1000, 1000];
  public modelName: string;
  
  constructor(public modelConfig: ModelConfig) {
    this.modelName = modelConfig.model;
  }

  async invoke(params: any): Promise<any> {
    // This will be implemented in the full model class
    throw new Error('UITarsModel.invoke not implemented');
  }

  reset(): void {
    // Reset model state if needed
  }
} 