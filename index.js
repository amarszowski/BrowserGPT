import dotenv from 'dotenv';
import {chromium} from 'playwright';
import prompt from 'prompt';
import {Command} from 'commander';
import {ChatOpenAI} from '@langchain/openai';
import {createTestFile, gracefulExit} from './util/index.js';
import {processPromptTasks} from './util/taskProcessor.js';
import {writeResultsToFile, processExcelTasks} from './util/excelUtils.js';

dotenv.config();

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

  prompt.message = 'ScenarioAI'.green;
  const promptOptions = [];
  if (options.autogpt) {
    promptOptions.push('+AutoGPT');
  }
  if (options.headless) {
    promptOptions.push('+tryb headless');
  }
  if (promptOptions.length > 0) {
    prompt.message += ` (${promptOptions.join(' ')})`.green;
  }
  prompt.delimiter = '>'.green;

  prompt.start();

  const chatApi = new ChatOpenAI({
    temperature: 0.1,
    modelName: options.model ? options.model : 'gpt-4o',
  });

  if (options.outputFilePath) {
    createTestFile(options.outputFilePath);
  }

  process.on('exit', () => {
    gracefulExit(options);
  });

  // Store the results
  const results = [];

  try {
    if (options.excelFilePath) {
      await processExcelTasks(
        options.excelFilePath,
        page,
        chatApi,
        options,
        results
      );
    } else {
      await processPromptTasks(prompt, page, chatApi, options, results);
    }
  } catch (error) {
    console.log('Przerwano przetwarzanie z powodu błędu:', error.message);
  } finally {
    await browser.close();
    if (options.resultFilePath) {
      await writeResultsToFile(options.resultFilePath, results);
    }
  }
}

const program = new Command();

program
  .option('-m, --model <model>', 'używany model openai', 'gpt-4o')
  .option(
    '-o, --outputFilePath <outputFilePath>',
    'ścieżka do zapisania kodu testu'
  )
  .option(
    '-r, --resultFilePath <resultFilePath>',
    'ścieżka do zapisania wyników scenariusza testowego'
  )
  .option('-u, --url <url>', 'adres URL do rozpoczęcia', 'http://172.30.0.120')
  .option('-v, --viewport <viewport>', 'rozmiar viewport', '1280,720')
  .option('-h, --headless', 'uruchom w trybie headless', false)
  .option(
    '-e, --excelFilePath <excelFilePath>',
    'ścieżka do pliku Excel ze scenariuszem testowym'
  );

program.parse();

main(program.opts());
