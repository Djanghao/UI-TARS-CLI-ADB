/*
 * Author: Houston Zhang
 * SPDX-License-Identifier: Apache-2.0
 */

import { program } from 'commander';
import { version } from '../../package.json';
import { start, CliOptions } from './start';

export const run = () => {
  program.name('ui-tars-adb').usage('<command> [options]').version(version);

  program
    .command('start')
    .description('Start UI-TARS agent with ADB operator for Android device automation')
    .option('-p, --presets <url>', 'Model Config Presets (URL to YAML config)')
    .option('-q, --query <query>', "User's automation query/instruction")
    .option('--baseURL <url>', 'Model API base URL')
    .option('--apiKey <key>', 'Model API key')
    .option('--model <model>', 'Model name')
    .option('--device <deviceId>', 'Specific Android device ID to use')
    .action(async (options: CliOptions) => {
      try {
        await start(options);
      } catch (err) {
        console.error('Failed to start UI-TARS ADB agent');
        console.error(err);
        process.exit(1);
      }
    });

  program.parse();
}; 