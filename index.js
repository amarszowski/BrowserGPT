import dotenv from 'dotenv';
import {chromium} from 'playwright';
import prompt from 'prompt';
import {Command} from 'commander';
import fs from 'fs';
import csv from 'csv-parser';
import delay from 'delay';

import {ChatOpenAI} from 'langchain/chat_models/openai';
import {doActionWithAutoGPT} from './autogpt/index.js';
import {interactWithPage} from './actions/index.js';
import {createTestFile, gracefulExit, logPageScreenshot} from './util/index.js';
import {verifyPage} from './actions/verifyPage.js';

dotenv.config();

async function processTask(task, verificationCriteria, page, chatApi, options) {
  try {
    if (options.autogpt) {
      await doActionWithAutoGPT(page, chatApi, task, options);
    } else {
      await interactWithPage(chatApi, page, task, options);
    }
    if (options.headless) {
      await logPageScreenshot(page);
    }

    await delay(3000); // Wait for 3 seconds before verification

    const verificationResult = await verifyPage(
      chatApi,
      page,
      verificationCriteria
    );
    if (!verificationResult.passed) {
      console.log('Verification failed:', verificationResult.reason);
    } else {
      console.log('Verification passed');
    }
  } catch (e) {
    console.log('Execution failed');
    console.log(e);
  }
}

async function main(options) {
  const url = options.url;
  const browser = await chromium.launch({headless: options.headless});

  // Parse the viewport option
  const [width, height] = options.viewport.split(',').map(Number);

  const browserContext = await browser.newContext({
    viewport: {width, height},
  });

  const page = await browserContext.newPage();
  await page.goto(url);

  prompt.message = 'BrowserGPT'.green;
  const promptOptions = [];
  if (options.autogpt) {
    promptOptions.push('+AutoGPT');
  }
  if (options.headless) {
    promptOptions.push('+headless');
  }
  if (promptOptions.length > 0) {
    prompt.message += ` (${promptOptions.join(' ')})`.green;
  }
  prompt.delimiter = '>'.green;

  prompt.start();

  const chatApi = new ChatOpenAI({
    temperature: 0.0,
    modelName: options.model ? options.model : 'gpt-4o',
  });

  if (options.outputFilePath) {
    createTestFile(options.outputFilePath);
  }

  process.on('exit', () => {
    gracefulExit(options);
  });

  // Read instructions from the CSV file if specified
  if (options.csvFilePath) {
    const tasks = [];

    fs.createReadStream(options.csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        tasks.push({
          task: row['Krok testowy'],
          criteria: row['Kryteria akceptacji'],
        });
      })
      .on('end', async () => {
        console.log('CSV file successfully processed');
        for (const {task, criteria} of tasks) {
          await processTask(task, criteria, page, chatApi, options);
        }
        await browser.close();
      });
  } else {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const {task, criteria} = await prompt.get({
        properties: {
          task: {
            message: ' Input a task\n',
            required: false,
          },
          criteria: {
            message: ' Input verification criteria\n',
            required: false,
          },
        },
      });

      if (task === '') {
        console.log('Please input a task or press CTRL+C to exit'.red);
      } else {
        await processTask(task, criteria, page, chatApi, options);
      }
    }
  }
}

const program = new Command();

program
  .option('-a, --autogpt', 'run with autogpt', false)
  .option('-m, --model <model>', 'openai model to use', 'gpt-4-1106-preview')
  .option('-o, --outputFilePath <outputFilePath>', 'path to store test code')
  .option('-u, --url <url>', 'url to start on', 'http://172.30.0.120')
  .option('-v, --viewport <viewport>', 'viewport size to use', '1280,720')
  .option('-h, --headless', 'run in headless mode', false)
  .option(
    '-c, --csvFilePath <csvFilePath>',
    'path to the CSV file with instructions'
  );

program.parse();

main(program.opts());
