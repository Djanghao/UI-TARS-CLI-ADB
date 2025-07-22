/*
 * Author: Houston Zhang
 * SPDX-License-Identifier: Apache-2.0
 */

import OpenAI from 'openai';
import { UITarsModel, ModelConfig } from './types';
import { actionParser } from '../action-parser';
import { DEFAULT_FACTORS } from '../shared/constants';
import { PredictionParsed, UITarsModelVersion } from '../shared/types';

export interface InvokeParams {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  images: string[];
  screenContext: {
    width: number;
    height: number;
  };
  scaleFactor: number;
  uiTarsVersion?: UITarsModelVersion;
  headers?: Record<string, string>;
  previousResponseId?: string;
}

export class UITarsModelImpl extends UITarsModel {
  private client: OpenAI;
  private maxTokens = 2048;
  private temperature = 0.0;

  constructor(modelConfig: ModelConfig) {
    super(modelConfig);
    
    this.client = new OpenAI({
      apiKey: modelConfig.apiKey,
      baseURL: modelConfig.baseURL,
    });
  }

  async invoke(params: InvokeParams): Promise<{
    prediction: string;
    parsedPredictions: PredictionParsed[];
    costTime?: number;
    costTokens?: number;
    responseId?: string;
  }> {
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: this.modelConfig.model,
        messages: params.messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      const prediction = response.choices[0]?.message?.content || '';
      
      // Parse the prediction using action parser
      const { parsed: parsedPredictions } = actionParser({
        prediction,
        factor: this.factors,
        screenContext: params.screenContext,
        scaleFactor: params.scaleFactor,
        modelVer: params.uiTarsVersion,
      });

      const costTime = Date.now() - startTime;
      const costTokens = response.usage?.total_tokens || 0;

      return {
        prediction,
        parsedPredictions,
        costTime,
        costTokens,
        responseId: response.id,
      };
    } catch (error) {
      console.error('Model invoke error:', error);
      throw error;
    }
  }
} 