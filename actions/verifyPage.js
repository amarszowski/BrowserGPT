import {retry} from '@lifeomic/attempt';
import {HumanMessage, SystemMessage} from 'langchain/schema';
import {parseSite} from '../util/index.js';

async function verifyPageStepByStep(chatApi, page, verificationGuidelines) {
  const systemPrompt = `
You are a Senior SDET tasked with verifying the results of specific actions taken on a webpage. You will receive the current page content and the verification guidelines. Based on this information, analyze step by step whether the verification criteria are met and provide a detailed text result.

Context:
- Your computer is a Mac. Cmd is the meta key, META.
- The browser is already open.
- Current page URL: ${await page.evaluate('location.href')}.
- Current page title: ${await page.evaluate('document.title')}.
- Overview of the site in HTML format:
\`\`\`
${await parseSite(page)}
\`\`\`

Key Points:
- Carefully analyze the provided page content and the verification guidelines step by step.
- Provide a detailed text result indicating whether each part of the guidelines is met and any issues found.

Verification Guidelines: ${verificationGuidelines}
`;

  const completion = await retry(async () =>
    chatApi.call([
      new SystemMessage(systemPrompt),
      new HumanMessage(
        'Please verify the page content based on the provided guidelines step by step and return a detailed text result.'
      ),
    ])
  );

  return completion.text;
}

async function verifyPageBoolean(chatApi, verificationResultText) {
  const systemPrompt = `
You are a Senior SDET tasked with determining whether the verification guidelines have been met based on the detailed text result of the verification process. You will receive the detailed text result and you need to return a single boolean value indicating whether the verification criteria are met.

Key Points:
- Carefully analyze the provided text result.
- Return 'true' if the verification criteria are met, otherwise return 'false'.

Detailed Text Result: ${verificationResultText}
`;

  const completion = await retry(async () =>
    chatApi.call([
      new SystemMessage(systemPrompt),
      new HumanMessage(
        'Please analyze the detailed text result and return a single boolean value indicating whether the verification criteria are met.'
      ),
    ])
  );

  let verificationResult = false;
  try {
    verificationResult = JSON.parse(completion.text);
    console.log('Verification Boolean Result:', verificationResult);
  } catch (e) {
    console.log('Failed to parse verification boolean result:', e);
  }

  return verificationResult;
}

async function verificationFailureReason(chatApi, verificationResultText) {
  const systemPrompt = `
You are a Senior SDET tasked with providing a short description of why the verification guidelines have not been met based on the detailed text result of the verification process. You will receive the detailed text result and you need to return a short description of the issues found.

Key Points:
- Carefully analyze the provided text result.
- Provide a short description of the issues found that caused the verification to fail.

Detailed Text Result: ${verificationResultText}
`;

  const completion = await retry(async () =>
    chatApi.call([
      new SystemMessage(systemPrompt),
      new HumanMessage(
        'Please analyze the detailed text result and provide a short description of why the verification guidelines have not been met.'
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
    console.log('Verification failed:', failureReason);
    return {
      passed: false,
      reason: failureReason,
    };
  } else {
    console.log('Verification passed');
    return {
      passed: true,
      reason: null,
    };
  }
}
