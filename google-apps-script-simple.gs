/**
 * Google Apps Script - Claude API Proxy for Monthly Ledger OCR
 * Simple version - no unnecessary headers
 */

const CLAUDE_MODEL = 'claude-opus-4.5';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return send({success: false, error: 'No data received'});
    }

    const payload = JSON.parse(e.postData.contents);

    if (!payload.imageBase64 || !payload.month || !payload.year || !payload.apiKey) {
      return send({success: false, error: 'Missing: imageBase64, month, year, apiKey'});
    }

    Logger.log('Processing: ' + payload.month + '/' + payload.year);

    const result = callClaudeAPI(
      payload.imageBase64,
      payload.month,
      payload.year,
      payload.apiKey
    );

    return send({success: true, data: result});

  } catch (error) {
    Logger.log('Error: ' + error);
    return send({success: false, error: error.toString()});
  }
}

function callClaudeAPI(imageBase64, month, year, apiKey) {
  const payload = {
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBase64
            }
          },
          {
            type: 'text',
            text: getPrompt(month, year)
          }
        ]
      }
    ]
  };

  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  Logger.log('Calling Claude...');
  const response = UrlFetchApp.fetch(CLAUDE_ENDPOINT, options);
  const result = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    throw new Error('Claude Error ' + response.getResponseCode() + ': ' + (result.error?.message || 'Unknown'));
  }

  const content = result.content[0].text;

  try {
    return JSON.parse(content);
  } catch (e) {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Invalid Claude response');
  }
}

function getPrompt(month, year) {
  return `Extract monthly ledger data and return ONLY valid JSON:
{
  "month": ${month},
  "year": ${year},
  "daysProcessed": <number>,
  "confidence": "<high|medium|low>",
  "issuesDetected": [],
  "entries": [
    {
      "date": "YYYY-MM-DD",
      "openingBalance": <number>,
      "totalCredits": <number>,
      "totalDebits": <number>,
      "closingBalance": <number>,
      "details": {
        "Value Payable/COD": 0,
        "Register/Speed Post": 0,
        "Recurring Deposit": 0,
        "Saving Bank Deposit": 0,
        "Postal Life Insurance": 0,
        "Rural Postal Life Insurance": 0,
        "Sukanya Samriddhi Yojana": 0,
        "IPPB Deposit": 0,
        "Time Deposit": 0,
        "Child Enrollment": 0,
        "Other Credits": 0,
        "Cash Deposit to Sub PO": 0,
        "Saving Bank Withdrawal": 0,
        "IPPB Withdrawal": 0,
        "Commission/Other": 0,
        "RSAO Online Debit": 0
      }
    }
  ]
}`;
}

function send(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
