// Helper de teste: lê .xlsx com SheetJS (npm) e devolve abas no formato do parser.
import { readFileSync } from 'node:fs';
import XLSX from 'xlsx';
export function lerXlsx(caminho) {
  const wb = XLSX.read(readFileSync(caminho), { type: 'buffer', cellDates: true });
  return wb.SheetNames.map((nome) => ({
    nome,
    linhas: XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null, blankrows: true }),
  }));
}
