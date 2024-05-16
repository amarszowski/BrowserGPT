import fs from 'fs';
import csv from 'csv-parser';
import delay from 'delay';
import {interactWithPage} from '../actions/index.js';
import {logPageScreenshot} from './index.js';
import {verifyPage} from '../actions/verifyPage.js';

export async function processTask(
  task,
  verificationCriteria,
  page,
  chatApi,
  options,
  results
) {
  try {
    await interactWithPage(chatApi, page, task, options);

    if (options.headless) {
      await logPageScreenshot(page);
    }

    await delay(2000); // Wait 2 seconds before verifying

    const verificationResult = await verifyPage(
      chatApi,
      page,
      verificationCriteria
    );
    if (verificationResult.passed) {
      results.push({
        task,
        criteria: verificationCriteria,
        status: 'Zaliczony',
        details: '',
      });
    } else {
      results.push({
        task,
        criteria: verificationCriteria,
        status: 'Nie zaliczony',
        details: verificationResult.reason,
      });
    }
  } catch (e) {
    console.log('Wykonanie nieudane');
    console.log(e);
    results.push({
      task,
      criteria: verificationCriteria,
      status: 'Nie zaliczony',
      details: 'Wystąpił błąd',
    });
    throw new Error('Błąd w przetwarzaniu kroku testowego');
  }
}

export async function writeResultsToFile(filePath, results) {
  const headers = [
    'Krok testowy',
    'Kryteria akceptacji',
    'Status',
    'Szczegóły',
  ];
  const csvContent = [
    headers.join(';'),
    ...results.map((result) =>
      [result.task, result.criteria, result.status, result.details].join(';')
    ),
  ].join('\n');

  fs.writeFileSync(filePath, csvContent);
  console.log(`Wyniki zapisane w ${filePath}`);
}

export async function processCSVTasks(
  csvFilePath,
  page,
  chatApi,
  options,
  results
) {
  return new Promise((resolve, reject) => {
    const tasks = [];
    fs.createReadStream(csvFilePath)
      .pipe(csv({separator: ';'}))
      .on('data', (row) => {
        tasks.push({
          task: row['Krok testowy'],
          criteria: row['Kryteria akceptacji'],
        });
      })
      .on('end', async () => {
        try {
          console.log('Plik CSV przetworzony pomyślnie');
          for (const {task, criteria} of tasks) {
            await processTask(task, criteria, page, chatApi, options, results);
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

export async function processPromptTasks(
  prompt,
  page,
  chatApi,
  options,
  results
) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const {task, criteria} = await prompt.get({
      properties: {
        task: {
          message: 'Wprowadź krok testowy\n',
          required: false,
        },
        criteria: {
          message: 'Wprowadź kryteria akceptacji\n',
          required: false,
        },
      },
    });

    if (task === '') {
      console.log(
        'Proszę wprowadzić krok testowy lub nacisnąć CTRL+C, aby zakończyć'.red
      );
    } else {
      await processTask(task, criteria, page, chatApi, options, results);
    }
  }
}
