import XLSX from 'xlsx-style';
import {processTask} from './taskProcessor.js';

export function writeResultsToFile(filePath, results) {
  const headers = [
    'Krok testowy',
    'Kryteria akceptacji',
    'Status',
    'Szczegóły',
  ];

  const data = [
    headers,
    ...results.map((result) => [
      result.task,
      result.criteria,
      result.status,
      result.details,
    ]),
  ];

  // Create a new worksheet
  const worksheet = {};
  data.forEach((row, rowIndex) => {
    row.forEach((cellValue, colIndex) => {
      const cellAddress = XLSX.utils.encode_cell({r: rowIndex, c: colIndex});
      worksheet[cellAddress] = {v: cellValue};
    });
  });

  // Calculate the range of the worksheet
  const range = XLSX.utils.decode_range(`A1:D${data.length}`);
  worksheet['!ref'] = XLSX.utils.encode_range(range);

  worksheet['!cols'] = [
    {wch: 50}, // Width of column A
    {wch: 70}, // Width of column B
    {wch: 15}, // Width of column C
    {wch: 150}, // Width of column D
  ];

  // Define styles
  const headerStyle = {
    font: {bold: true, color: {rgb: 'FFFFFF'}},
    fill: {fgColor: {rgb: '4F81BD'}},
    alignment: {horizontal: 'center', vertical: 'center'},
    border: {
      top: {style: 'thin', color: {rgb: '000000'}},
      bottom: {style: 'thin', color: {rgb: '000000'}},
      left: {style: 'thin', color: {rgb: '000000'}},
      right: {style: 'thin', color: {rgb: '000000'}},
    },
  };

  const passedStyle = {
    fill: {fgColor: {rgb: 'C6EFCE'}},
    font: {color: {rgb: '006100'}},
  };

  const failedStyle = {
    fill: {fgColor: {rgb: 'FFC7CE'}},
    font: {color: {rgb: '9C0006'}},
  };

  const defaultStyle = {
    alignment: {vertical: 'center'},
  };

  // Apply styles to headers
  for (let C = 0; C < headers.length; ++C) {
    const cellAddress = XLSX.utils.encode_cell({r: 0, c: C});
    if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
    Object.assign(worksheet[cellAddress].s, headerStyle);
  }

  // Apply styles to data rows
  for (let R = 1; R < data.length; ++R) {
    const statusCell = worksheet[XLSX.utils.encode_cell({r: R, c: 2})];
    const status = statusCell.v;

    for (let C = 0; C < headers.length; ++C) {
      const cellAddress = XLSX.utils.encode_cell({r: R, c: C});
      if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
      if (status === 'Zaliczony') {
        Object.assign(worksheet[cellAddress].s, defaultStyle, passedStyle);
      } else if (status === 'Nie zaliczony') {
        Object.assign(worksheet[cellAddress].s, defaultStyle, failedStyle);
      } else {
        Object.assign(worksheet[cellAddress].s, defaultStyle);
      }
    }
  }

  // Create a new workbook and append the worksheet
  const workbook = {SheetNames: ['Wyniki'], Sheets: {Wyniki: worksheet}};

  // Write the workbook to file
  XLSX.writeFile(workbook, filePath);

  console.log(`Wyniki zapisane w ${filePath}`);
}

export async function processExcelTasks(
  excelFilePath,
  page,
  chatApi,
  options,
  results
) {
  const workbook = XLSX.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, {header: 1});

  const tasks = data.slice(1).map((row) => ({
    task: row[0],
    criteria: row[1],
  }));

  try {
    console.log('Plik Excel przetworzony pomyślnie');
    for (const {task, criteria} of tasks) {
      await processTask(task, criteria, page, chatApi, options, results);
    }
  } catch (error) {
    throw new Error('Błąd w przetwarzaniu zadań z pliku Excel');
  }
}
