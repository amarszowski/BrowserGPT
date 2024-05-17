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
  const maxRetries = 3;
  let attempt = 0;
  let success = false;

  while (attempt < maxRetries && !success) {
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
        success = true;
      } else {
        results.push({
          task,
          criteria: verificationCriteria,
          status: 'Nie zaliczony',
          details: verificationResult.reason,
        });
        success = true;
      }
    } catch (e) {
      attempt += 1;
      console.log(`Wykonanie nieudane, próba ${attempt} z ${maxRetries}`);
      console.log(e);

      if (attempt >= maxRetries) {
        results.push({
          task,
          criteria: verificationCriteria,
          status: 'Nie zaliczony',
          details: 'Wystąpił błąd',
        });
        throw new Error('Błąd w przetwarzaniu kroku testowego');
      }
    }
  }
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
