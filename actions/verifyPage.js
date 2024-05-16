import {retry} from '@lifeomic/attempt';
import {HumanMessage, SystemMessage} from 'langchain/schema';
import {parseSite} from '../util/index.js';

async function verifyPageStepByStep(chatApi, page, verificationGuidelines) {
  const systemPrompt = `
Jesteś starszym inżynierem ds. testów automatycznych (Senior SDET) i Twoim zadaniem jest weryfikacja wyników kroków testowych podjętych na stronie internetowej. Otrzymasz zawartość bieżącej strony oraz kryteria akceptacji kroku testowego. Na podstawie tych informacji, przeanalizuj krok po kroku, czy kryteria akceptacji są spełnione, i dostarcz szczegółowy wynik w formie tekstowej.

Kontekst:
- Twój komputer to Mac. Cmd to klawisz meta, META.
- Przeglądarka jest już otwarta.
- Aktualny adres URL strony: ${await page.evaluate('location.href')}.
- Aktualny tytuł strony: ${await page.evaluate('document.title')}.
- Przegląd strony w formacie HTML:
\`\`\`
${await parseSite(page)}
\`\`\`

Kluczowe Punkty:
- Dokładnie przeanalizuj dostarczoną zawartość strony oraz kryteria akceptacji krok po kroku.
- Bierz pod uwagę tylko wytyczne zawarte bezpośrednio w kryteriach akceptacji. Jeśli jakakolwiek informacja nie jest zawarta w kryteriach akceptacji, nie bierz jej pod uwagę.
- Dostarcz szczegółowy wynik w formie tekstowej, wskazując, czy każda część kryteriów jest spełniona oraz wszelkie znalezione problemy.

Kryteria akceptacji: ${verificationGuidelines}
`;

  const completion = await retry(async () =>
    chatApi.call([
      new SystemMessage(systemPrompt),
      new HumanMessage(
        'Proszę zweryfikować zawartość strony na podstawie dostarczonych kryteriów krok po kroku i zwrócić szczegółowy wynik w formie tekstowej.'
      ),
    ])
  );

  console.log(completion.text);

  return completion.text;
}

async function verifyPageBoolean(chatApi, verificationResultText) {
  const systemPrompt = `
Jesteś starszym inżynierem ds. testów automatycznych (Senior SDET) i Twoim zadaniem jest określenie, czy kryteria akceptacji kroku testowego zostały spełnione na podstawie szczegółowego wyniku weryfikacji w formie tekstowej. Otrzymasz szczegółowy wynik w formie tekstowej i musisz zwrócić pojedynczą wartość logiczną wskazującą, czy kryteria akceptacji zostały spełnione.

Kluczowe Punkty:
- Dokładnie przeanalizuj dostarczony wynik w formie tekstowej.
- Twoja odpowiedź musi zawierać jedynie pojedynczą wartość logiczną, nie może zawierać nic innego.
- Zwróć 'true', jeśli kryteria akceptacji są spełnione, w przeciwnym razie zwróć 'false'.

Szczegółowy Wynik Weryfikacji: ${verificationResultText}
`;

  const completion = await retry(async () =>
    chatApi.call([
      new SystemMessage(systemPrompt),
      new HumanMessage(
        'Proszę przeanalizować szczegółowy wynik w formie tekstowej i zwrócić pojedynczą wartość logiczną wskazującą, czy kryteria weryfikacji są spełnione.'
      ),
    ])
  );

  let verificationResult = false;
  try {
    verificationResult = JSON.parse(completion.text);
    console.log('Wynik weryfikacji:', verificationResult);
  } catch (e) {
    console.log('Nie udało się odczytać wyniku weryfikacji:', e);
  }

  return verificationResult;
}

async function verificationFailureReason(chatApi, verificationResultText) {
  const systemPrompt = `
Jesteś starszym inżynierem ds. testów automatycznych (Senior SDET) i Twoim zadaniem jest dostarczenie krótkiego opisu, dlaczego kryteria akceptacji kroku testowego nie zostały spełnione, na podstawie szczegółowego wyniku weryfikacji w formie tekstowej. Otrzymasz szczegółowy wynik w formie tekstowej i musisz zwrócić krótki opis znalezionych problemów.

Kluczowe Punkty:
- Dokładnie przeanalizuj dostarczony wynik w formie tekstowej.
- Podaj krótki opis (maksymalnie 200 znaków) znalezionych problemów, które spowodowały niepowodzenie weryfikacji.

Szczegółowy Wynik Weryfikacji: ${verificationResultText}
`;

  const completion = await retry(async () =>
    chatApi.call([
      new SystemMessage(systemPrompt),
      new HumanMessage(
        'Proszę przeanalizować szczegółowy wynik w formie tekstowej i podać krótki opis, dlaczego kryteria akceptacji nie zostały spełnione.'
      ),
    ])
  );

  return completion.text;
}

export async function verifyPage(chatApi, page, verificationGuidelines) {
  const verificationResultText = await verifyPageStepByStep(
    chatApi,
    page,
    verificationGuidelines
  );
  const verificationPassed = await verifyPageBoolean(
    chatApi,
    verificationResultText
  );

  if (!verificationPassed) {
    const failureReason = await verificationFailureReason(
      chatApi,
      verificationResultText
    );
    console.log(
      'Kryteria akceptacji nie zostały spełnione. Powód:',
      failureReason
    );
    return {
      passed: false,
      reason: failureReason,
    };
  } else {
    console.log('Kryteria akceptacji zostały spełnione.');
    return {
      passed: true,
      reason: null,
    };
  }
}
