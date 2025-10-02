/*
 * Author: Houston Zhang
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import fetch from 'node-fetch';
import * as p from '@clack/prompts';
import * as yaml from 'js-yaml';
import { GUIAgent } from '../sdk/gui-agent';
import { getAndroidDeviceId, AdbOperator } from '../operators/adb';

export interface CliOptions {
  presets?: string;
  query?: string;
  baseURL?: string;
  apiKey?: string;
  model?: string;
  device?: string;
}

export const start = async (options: CliOptions) => {
  const CONFIG_PATH = path.join(process.cwd(), 'ui-tars-cli.config.json');

  // Read or initialize config
  let config = {
    baseURL: '',
    apiKey: '',
    model: '',
  };

  if (options.presets) {
    const response = await fetch(options.presets);
    if (!response.ok) {
      throw new Error(`Failed to fetch preset: ${response.status}`);
    }

    const yamlText = await response.text();
    const preset = yaml.load(yamlText) as any;

    config.apiKey = preset?.vlmApiKey || preset?.apiKey;
    config.baseURL = preset?.vlmBaseUrl || preset?.baseURL;
    config.model = preset?.vlmModelName || preset?.model;
  } else if (fs.existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch (error) {
      console.warn('Warning: Failed to read config file', error);
    }
  }

  // Override with command line options
  if (options.baseURL) config.baseURL = options.baseURL;
  if (options.apiKey) config.apiKey = options.apiKey;
  if (options.model) config.model = options.model;

  // Prompt for missing required config
  if (!config.baseURL || !config.apiKey || !config.model) {
    console.log('🤖 UI-TARS ADB Agent Configuration');
    console.log('Please provide the required model configuration:');
    
    const configAnswers = await p.group(
      {
        baseURL: () => config.baseURL ? undefined : p.text({ 
          message: 'Model API Base URL:',
          placeholder: 'https://api.openai.com/v1'
        }),
        apiKey: () => config.apiKey ? undefined : p.text({ 
          message: 'Model API Key:',
          placeholder: 'your-api-key-here'
        }),
        model: () => config.model ? undefined : p.text({ 
          message: 'Model Name:',
          placeholder: 'gpt-4-vision-preview'
        }),
      },
      {
        onCancel: () => {
          p.cancel('Operation cancelled');
          process.exit(0);
        },
      },
    );

    // Update config with provided values
    Object.assign(config, configAnswers);

    // Save config to file
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      console.log(`✅ Configuration saved to: ${CONFIG_PATH}`);
    } catch (error) {
      console.error('⚠️  Failed to save configuration:', error);
    }
  }

  // Get Android device
  console.log('📱 Detecting Android devices...');
  let deviceId = options.device;
  
  if (!deviceId) {
    deviceId = await getAndroidDeviceId();
    if (!deviceId) {
      console.error('❌ No Android devices found.');
      console.error('Please ensure:');
      console.error('1. Your Android device is connected via USB');
      console.error('2. USB debugging is enabled');
      console.error('3. ADB is installed and accessible');
      process.exit(1);
    }
  }

  console.log(`✅ Using Android device: ${deviceId}`);

  // Create ADB operator
  const adbOperator = new AdbOperator(deviceId!);

  // Get user instruction
  let instruction = options.query;
  if (!instruction) {
    const result = await p.group(
      {
        instruction: () => p.text({ 
          message: 'What would you like the agent to do on your Android device?',
          placeholder: 'e.g., Open WhatsApp and send a message to John'
        }),
      },
      {
        onCancel: () => {
          p.cancel('Operation cancelled');
          process.exit(0);
        },
      },
    );
    instruction = result.instruction;
  }

  if (!instruction) {
    console.error('❌ No instruction provided');
    process.exit(1);
  }

  console.log('🚀 Starting UI-TARS ADB Agent...');
  console.log(`📋 Task: ${instruction}`);

  const abortController = new AbortController();
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping agent...');
    abortController.abort();
  });

  const guiAgent = new GUIAgent({
    model: {
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      model: config.model,
    },
    operator: adbOperator,
    signal: abortController.signal,
    onData: ({ data }) => {
      // Log agent progress
      if (data.conversations && data.conversations.length > 0) {
        const lastConv = data.conversations[data.conversations.length - 1];
        if (lastConv.from === 'gpt') {
          console.log(`🤖 Agent: ${lastConv.value}`);
        } else if (lastConv.from === 'human' && lastConv.value !== '<!-- IMAGE -->') {
          console.log(`👤 User: ${lastConv.value}`);
        } else if (lastConv.screenshotBase64) {
          console.log('📸 Taking screenshot...');
        }
      }
      
      if (data.status === 'end') {
        console.log('✅ Task completed successfully!');
      } else if (data.status === 'call_user') {
        console.log('🤝 Agent needs user assistance');
      }
    },
    onError: ({ error }) => {
      console.error('❌ Agent error:', error.message);
    },
    logger: {
      info: (msg, ...args) => console.log(`ℹ️  ${msg}`, ...args),
      warn: (msg, ...args) => console.warn(`⚠️  ${msg}`, ...args),
      error: (msg, ...args) => console.error(`❌ ${msg}`, ...args),
      debug: (msg, ...args) => console.log(`🐛 ${msg}`, ...args),
    }
  });

  try {
    await guiAgent.run(instruction);
  } catch (error) {
    console.error('❌ Agent execution failed:', error);
    process.exit(1);
  }
}; 