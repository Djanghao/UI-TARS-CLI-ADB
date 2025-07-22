/*
 * Author: Houston Zhang
 * SPDX-License-Identifier: Apache-2.0
 */

import { Jimp } from 'jimp';
import asyncRetry from 'async-retry';
import { 
  GUIAgentConfig, 
  Operator, 
  UITarsModel, 
  Logger,
  ModelConfig 
} from './types';
import { UITarsModelImpl, InvokeParams } from './model';
import {
  GUIAgentData,
  StatusEnum,
  ShareVersion,
  ErrorStatusEnum,
  GUIAgentError,
  Message,
  Conversation,
  PredictionParsed,
} from '../shared/types';
import { 
  IMAGE_PLACEHOLDER, 
  MAX_LOOP_COUNT, 
  DEFAULT_FACTORS 
} from '../shared/constants';
import { sleep } from '../shared/utils';

const SYSTEM_PROMPT_TEMPLATE = `You are a GUI agent. You are given a task and your action history, with screenshots. You need to perform the next action to complete the task.

## Output Format
\`\`\`
Thought: ...
Action: ...
\`\`\`

## Action Space
{{action_spaces_holder}}

## Note
- Write a small plan and finally summarize your next action (with its target element) in one sentence in \`Thought\` part.

## User Instruction
`;

const SYSTEM_PROMPT = `You are a GUI agent. You are given a task and your action history, with screenshots. You need to perform the next action to complete the task.

## Output Format
\`\`\`
Thought: ...
Action: ...
\`\`\`

## Action Space
click(start_box='[x1, y1, x2, y2]')
type(content='')
scroll(start_box='[x1, y1, x2, y2]', direction='down or up or right or left')
wait()
finished()
call_user()

## Note
- Write a small plan and finally summarize your next action (with its target element) in one sentence in \`Thought\` part.

## User Instruction
`;

const INTERNAL_ACTION_SPACES_ENUM = {
  FINISHED: 'finished',
  CALL_USER: 'call_user',
  ERROR_ENV: 'error_env',
  MAX_LOOP: 'max_loop',
};

const MAX_SNAPSHOT_ERR_CNT = 3;

export class GUIAgent<T extends Operator> {
  private readonly operator: T;
  private readonly model: UITarsModelImpl;
  private readonly logger: Logger;
  private systemPrompt: string;
  private isPaused = false;
  private isStopped = false;

  constructor(private config: GUIAgentConfig<T>) {
    this.operator = config.operator;
    
    this.model = config.model instanceof UITarsModel 
      ? config.model as UITarsModelImpl
      : new UITarsModelImpl(config.model as ModelConfig);
      
    this.logger = config.logger || console;
    this.systemPrompt = config.systemPrompt || this.buildSystemPrompt();
  }

  async run(
    instruction: string,
    historyMessages?: Message[],
    remoteModelHdrs?: Record<string, string>,
  ): Promise<void> {
    const { operator, model, logger } = this;
    const {
      signal,
      onData,
      onError,
      retry = {},
      maxLoopCount = MAX_LOOP_COUNT,
    } = this.config;

    const currentTime = Date.now();
    const data: GUIAgentData = {
      version: ShareVersion.V1,
      systemPrompt: this.systemPrompt,
      instruction,
      modelName: this.model.modelName,
      status: StatusEnum.INIT,
      logTime: currentTime,
      conversations: [
        {
          from: 'human',
          value: instruction,
          timing: {
            start: currentTime,
            end: currentTime,
            cost: 0,
          },
        },
      ],
    };

    logger.info(
      `[GUIAgent] run:\nsystem prompt: ${this.systemPrompt},\nmodel config: ${JSON.stringify(this.model.modelConfig)}`,
    );

    let loopCnt = 0;
    let snapshotErrCnt = 0;
    let totalTokens = 0;
    let totalTime = 0;
    let previousResponseId: string | undefined;

    // Start running agent
    data.status = StatusEnum.RUNNING;
    await onData?.({ data: { ...data, conversations: [] } });

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        logger.info('[GUIAgent] loopCnt:', loopCnt);

        if (
          this.isStopped ||
          data.status !== StatusEnum.RUNNING ||
          signal?.aborted
        ) {
          signal?.aborted && (data.status = StatusEnum.USER_STOPPED);
          break;
        }

        if (loopCnt >= maxLoopCount) {
          Object.assign(data, {
            status: StatusEnum.ERROR,
            error: this.guiAgentErrorParser(
              ErrorStatusEnum.REACH_MAXLOOP_ERROR,
            ),
          });
          break;
        }

        if (snapshotErrCnt >= MAX_SNAPSHOT_ERR_CNT) {
          Object.assign(data, {
            status: StatusEnum.ERROR,
            error: this.guiAgentErrorParser(
              ErrorStatusEnum.SCREENSHOT_RETRY_ERROR,
            ),
          });
          break;
        }

        loopCnt += 1;
        const start = Date.now();

        const snapshot = await asyncRetry(() => operator.screenshot(), {
          retries: retry?.screenshot?.maxRetries ?? 0,
          minTimeout: 5000,
          onRetry: retry?.screenshot?.onRetry,
        });

        const { width, height, mime } = await Jimp.fromBuffer(
          Buffer.from(this.replaceBase64Prefix(snapshot.base64), 'base64'),
        ).catch((e) => {
          logger.error('[GUIAgent] screenshot error', e);
          return {
            width: null,
            height: null,
            mime: '',
          };
        });

        const isValidImage = !!(snapshot?.base64 && width && height);

        if (!isValidImage) {
          loopCnt -= 1;
          snapshotErrCnt += 1;
          await sleep(1000);
          continue;
        }

        let end = Date.now();

        if (isValidImage) {
          data.conversations.push({
            from: 'human',
            value: IMAGE_PLACEHOLDER,
            screenshotBase64: snapshot.base64,
            screenshotContext: {
              size: {
                width,
                height,
              },
              mime,
              scaleFactor: snapshot.scaleFactor,
            },
            timing: {
              start,
              end,
              cost: end - start,
            },
          });
          await onData?.({
            data: {
              ...data,
              conversations: data.conversations.slice(-1),
            },
          });
        }

        // Convert conversations to model format
        const modelFormat = this.toVlmModelFormat({
          historyMessages: historyMessages || [],
          conversations: data.conversations,
          systemPrompt: data.systemPrompt,
        });

        // Process VLM params
        const vlmParams: InvokeParams = {
          ...this.processVlmParams(modelFormat.conversations, modelFormat.images),
          screenContext: {
            width,
            height,
          },
          scaleFactor: snapshot.scaleFactor,
          headers: {
            ...remoteModelHdrs,
          },
          previousResponseId,
        };

        const {
          prediction,
          parsedPredictions,
          costTime,
          costTokens,
          responseId,
        } = await asyncRetry(
          async (bail) => {
            try {
              const result = await model.invoke(vlmParams);
              return result;
            } catch (error: unknown) {
              if (
                error instanceof Error &&
                (error?.name === 'APIUserAbortError' ||
                  error?.message?.includes('aborted'))
              ) {
                bail(error as unknown as Error);
                return {
                  prediction: '',
                  parsedPredictions: [],
                };
              }

              Object.assign(data, {
                status: StatusEnum.ERROR,
                error: this.guiAgentErrorParser(
                  ErrorStatusEnum.INVOKE_RETRY_ERROR,
                  error as Error,
                ),
              });
              throw error;
            }
          },
          {
            retries: retry?.model?.maxRetries ?? 0,
            minTimeout: 1000 * 30,
            onRetry: retry?.model?.onRetry,
          },
        );

        if (responseId) {
          previousResponseId = responseId;
        }

        totalTokens += costTokens || 0;
        totalTime += costTime || 0;

        logger.info(
          `[GUIAgent] consumes: >>> costTime: ${costTime}, costTokens: ${costTokens} <<<`,
        );
        logger.info('[GUIAgent] Response:', prediction);
        logger.info(
          '[GUIAgent] Parsed Predictions:',
          JSON.stringify(parsedPredictions),
        );

        if (!prediction) {
          logger.error('[GUIAgent] Response Empty:', prediction);
          continue;
        }

        const predictionSummary = this.getSummary(prediction);

        end = Date.now();
        data.conversations.push({
          from: 'gpt',
          value: predictionSummary,
          timing: {
            start,
            end,
            cost: end - start,
          },
          screenshotContext: {
            size: {
              width,
              height,
            },
            scaleFactor: snapshot.scaleFactor,
          },
          predictionParsed: parsedPredictions,
        });
        await onData?.({
          data: {
            ...data,
            conversations: data.conversations.slice(-1),
          },
        });

        // Execute actions
        for (const parsedPrediction of parsedPredictions) {
          const actionType = parsedPrediction.action_type;

          logger.info('[GUIAgent] Action:', actionType);

          // Handle internal action spaces
          if (actionType === INTERNAL_ACTION_SPACES_ENUM.ERROR_ENV) {
            Object.assign(data, {
              status: StatusEnum.ERROR,
              error: this.guiAgentErrorParser(
                ErrorStatusEnum.ENVIRONMENT_ERROR,
              ),
            });
            break;
          } else if (actionType === INTERNAL_ACTION_SPACES_ENUM.MAX_LOOP) {
            Object.assign(data, {
              status: StatusEnum.ERROR,
              error: this.guiAgentErrorParser(
                ErrorStatusEnum.REACH_MAXLOOP_ERROR,
              ),
            });
            break;
          }

          if (!signal?.aborted && !this.isStopped) {
            logger.info(
              '[GUIAgent] Action Inputs:',
              parsedPrediction.action_inputs,
              parsedPrediction.action_type,
            );

            const executeOutput = await asyncRetry(
              () =>
                operator.execute({
                  prediction,
                  parsedPrediction,
                  screenWidth: width,
                  screenHeight: height,
                  scaleFactor: snapshot.scaleFactor,
                  factors: this.model.factors,
                }),
              {
                retries: retry?.execute?.maxRetries ?? 0,
                minTimeout: 5000,
                onRetry: retry?.execute?.onRetry,
              },
            ).catch((e) => {
              logger.error('[GUIAgent] execute error', e);
              Object.assign(data, {
                status: StatusEnum.ERROR,
                error: this.guiAgentErrorParser(
                  ErrorStatusEnum.EXECUTE_RETRY_ERROR,
                  e,
                ),
              });
            });

            if (executeOutput && executeOutput?.status) {
              data.status = executeOutput.status;
            }
          }

          // Action types that break the loop
          if (actionType === INTERNAL_ACTION_SPACES_ENUM.CALL_USER) {
            data.status = StatusEnum.CALL_USER;
            break;
          } else if (actionType === INTERNAL_ACTION_SPACES_ENUM.FINISHED) {
            data.status = StatusEnum.END;
            break;
          }
        }

        if (this.config.loopIntervalInMs && this.config.loopIntervalInMs > 0) {
          await sleep(this.config.loopIntervalInMs);
        }
      }
    } catch (error) {
      logger.error('[GUIAgent] Catch error', error);
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message?.includes('aborted'))
      ) {
        logger.info('[GUIAgent] Catch: request was aborted');
        data.status = StatusEnum.USER_STOPPED;
        return;
      }

      data.status = StatusEnum.ERROR;
      data.error = this.guiAgentErrorParser(
        ErrorStatusEnum.UNKNOWN_ERROR,
        error as Error,
      );
    } finally {
      logger.info('[GUIAgent] Finally: status', data.status);

      this.model?.reset();

      if (data.status === StatusEnum.USER_STOPPED) {
        await operator.execute({
          prediction: '',
          parsedPrediction: {
            action_inputs: {},
            reflection: null,
            action_type: 'user_stop',
            thought: '',
          },
          screenWidth: 0,
          screenHeight: 0,
          scaleFactor: 1,
          factors: [0, 0],
        });
      }

      await onData?.({ data: { ...data, conversations: [] } });

      if (data.status === StatusEnum.ERROR) {
        onError?.({
          data,
          error:
            data.error ||
            new GUIAgentError(
              ErrorStatusEnum.UNKNOWN_ERROR,
              'Unknown error occurred',
            ),
        });
      }

      logger.info(
        `[GUIAgent] >>> totalTokens: ${totalTokens}, totalTime: ${totalTime}, loopCnt: ${loopCnt} <<<`,
      );
    }
  }

  stop(): void {
    this.isStopped = true;
  }

  private buildSystemPrompt(): string {
    const actionSpaces = (this.operator.constructor as typeof Operator)?.MANUAL
      ?.ACTION_SPACES;

    return actionSpaces == null || actionSpaces.length === 0
      ? SYSTEM_PROMPT
      : SYSTEM_PROMPT_TEMPLATE.replace(
          '{{action_spaces_holder}}',
          actionSpaces.join('\n'),
        );
  }

  private guiAgentErrorParser(
    type: ErrorStatusEnum,
    error?: Error,
  ): GUIAgentError {
    this.logger.error('[GUIAgent] guiAgentErrorParser:', error);

    return new GUIAgentError(type, error?.message || 'Unknown error', error?.stack);
  }

  private replaceBase64Prefix(base64: string): string {
    return base64.replace(/^data:image\/[^;]+;base64,/, '');
  }

  private getSummary(prediction: string): string {
    return prediction.length > 200 ? prediction.substring(0, 200) + '...' : prediction;
  }

  private toVlmModelFormat(params: {
    historyMessages: Message[];
    conversations: Conversation[];
    systemPrompt: string;
  }): {
    conversations: any[];
    images: string[];
  } {
    const { conversations, systemPrompt } = params;
    
    const messages: any[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    const images: string[] = [];

    for (const conv of conversations) {
      if (conv.from === 'human') {
        if (conv.screenshotBase64) {
          messages.push({
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${conv.screenshotBase64}`,
                },
              },
            ],
          });
          images.push(conv.screenshotBase64);
        } else {
          messages.push({
            role: 'user',
            content: conv.value,
          });
        }
      } else if (conv.from === 'gpt') {
        messages.push({
          role: 'assistant',
          content: conv.value,
        });
      }
    }

    return {
      conversations: messages,
      images,
    };
  }

  private processVlmParams(conversations: any[], images: string[]): {
    messages: any[];
    images: string[];
  } {
    // Keep only the last 5 images to avoid token limit
    const maxImages = 5;
    const recentImages = images.slice(-maxImages);
    
    // Filter conversations to match recent images
    const filteredConversations = conversations.filter((conv, index) => {
      if (conv.role === 'system') return true;
      if (conv.role === 'user' && conv.content && typeof conv.content === 'string') return true;
      if (conv.role === 'assistant') return true;
      if (conv.role === 'user' && Array.isArray(conv.content)) {
        // This is an image message, only keep if in recent images
        const imageContent = conv.content.find((c: any) => c.type === 'image_url');
        if (imageContent) {
          const base64 = imageContent.image_url.url.replace('data:image/png;base64,', '');
          return recentImages.includes(base64);
        }
      }
      return false;
    });

    return {
      messages: filteredConversations,
      images: recentImages,
    };
  }
} 