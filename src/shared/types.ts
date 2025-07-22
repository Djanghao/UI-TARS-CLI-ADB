/*
 * Author: Houston Zhang
 * SPDX-License-Identifier: Apache-2.0
 */


export enum StatusEnum {
  INIT = 'init',
  RUNNING = 'running',
  END = 'end',
  ERROR = 'error',
  MAX_LOOP = 'max_loop',
  USER_STOPPED = 'user_stopped',
  PAUSE = 'pause',
  CALL_USER = 'call_user',
}

export enum ErrorStatusEnum {
  UNKNOWN_ERROR = 'unknown_error',
  REACH_MAXLOOP_ERROR = 'reach_maxloop_error',
  SCREENSHOT_RETRY_ERROR = 'screenshot_retry_error',
  INVOKE_RETRY_ERROR = 'invoke_retry_error',
  EXECUTE_RETRY_ERROR = 'execute_retry_error',
  ENVIRONMENT_ERROR = 'environment_error',
  MODEL_SERVICE_ERROR = 'model_service_error',
}

export enum UITarsModelVersion {
  V1_0 = 'v1.0',
  V1_5 = 'v1.5',
}

export enum ShareVersion {
  V1 = 'v1',
}

export interface ActionInputs {
  start_box?: string;
  end_box?: string;
  start_coords?: [number, number];
  end_coords?: [number, number];
  content?: string;
  text?: string;
  key?: string;
  direction?: string;
  [key: string]: any;
}

export interface PredictionParsed {
  action_type: string;
  action_inputs: ActionInputs;
  reflection: string | null;
  thought: string;
}

export interface ScreenshotContext {
  size: {
    width: number;
    height: number;
  };
  mime?: string;
  scaleFactor: number;
}

export interface Timing {
  start: number;
  end: number;
  cost: number;
}

export interface Conversation {
  from: 'human' | 'gpt';
  value: string;
  timing: Timing;
  screenshotBase64?: string;
  screenshotContext?: ScreenshotContext;
  predictionParsed?: PredictionParsed[];
}

export interface GUIAgentData {
  version: ShareVersion;
  systemPrompt: string;
  instruction: string;
  modelName: string;
  status: StatusEnum;
  logTime: number;
  conversations: Conversation[];
  error?: GUIAgentError;
}

export class GUIAgentError extends Error {
  public type: ErrorStatusEnum;
  public details?: string;

  constructor(type: ErrorStatusEnum, message: string, details?: string) {
    super(message);
    this.type = type;
    this.details = details;
    this.name = 'GUIAgentError';
  }
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Constants
export const MAX_RATIO = 5000;
export const IMAGE_FACTOR = 1000;
export const MIN_PIXELS = 224;
export const MAX_PIXELS_V1_5 = 1344; 