import {parseSite} from '../util/index.js';
import {retry} from '@lifeomic/attempt';
import {HumanMessage, SystemMessage} from 'langchain/schema';

export async function findInPage(page, chatApi, task) {
  const systemPrompt = `
Jesteś programistą i Twoim zadaniem jest wybieranie informacji z kodu dla kierownika projektu. Pracujesz nad plikiem HTML. Wyciągniesz niezbędne treści z dostarczonych informacji.

Kontekst:
Twój komputer to Mac. Cmd to klawisz meta, META.
Przeglądarka jest już otwarta.
Aktualny adres URL strony to ${await page.evaluate('location.href')}.
Aktualny tytuł strony to ${await page.evaluate('document.title')}.

Oto przegląd strony. Format jest w HTML:
\`\`\`
${await parseSite(page)}
\`\`\`
`;

  const completion = await retry(async () =>
    chatApi.call([new SystemMessage(systemPrompt), new HumanMessage(task)])
  );
  console.log('Found on page'.green);
  console.log(completion.text);
  console.log('EOF'.green);
  return completion.text;
}
