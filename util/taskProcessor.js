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

  console.log(`\nRozpoczęcie przetwarzania zadania: ${task}`.cyan);

  while (attempt < maxRetries && !success) {
    try {
      console.log(`\nPróba ${attempt + 1} z ${maxRetries}...`.yellow);

      await interactWithPage(chatApi, page, task, options);
      console.log('Interakcja ze stroną zakończona pomyślnie'.green);

      if (options.headless) {
        await logPageScreenshot(page);
        console.log('Zrzut ekranu zapisany'.magenta);
      }

      await delay(2000); // Wait 2 seconds before verifying
      console.log('Oczekiwanie 2 sekundy przed weryfikacją...'.gray);

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
        console.log(`Zadanie "${task}" zaliczone`.bold.green);
        success = true;
      } else {
        results.push({
          task,
          criteria: verificationCriteria,
          status: 'Nie zaliczony',
          details: verificationResult.reason,
        });
        console.log(
          `Zadanie "${task}" nie zaliczone: ${verificationResult.reason}`.bold
            .red
        );
        success = true;
      }
    } catch (e) {
      attempt += 1;
      console.log(
        `Wykonanie nieudane, próba ${attempt} z ${maxRetries}`.bold.red
      );
      console.log(e.message.red);

      if (attempt >= maxRetries) {
        results.push({
          task,
          criteria: verificationCriteria,
          status: 'Nie zaliczony',
          details: 'Wystąpił błąd',
        });
        console.log(
          'Przekroczono maksymalną liczbę prób. Błąd w przetwarzaniu kroku testowego'
            .bold.red
        );
        throw new Error('Błąd w przetwarzaniu kroku testowego');
      }
    }
  }

  console.log(`Zakończono przetwarzanie zadania: ${task}`.cyan);
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
      console.log(`Przetwarzanie zadania: ${task}`.cyan);
      await processTask(task, criteria, page, chatApi, options, results);
    }
  }
}
