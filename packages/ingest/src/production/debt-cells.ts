import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/** Independent PDFMiner table decoding; deliberately no generator imports. */
export function verifyDebtCells(document: unknown, source: string, root: string): void {
  execFileSync(
    process.env.PYTHON312 ?? 'python3',
    [join(root, 'pipeline/budget_pipeline/validate/debt_cells.py'), source],
    { input: JSON.stringify(document), stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 },
  );
}
