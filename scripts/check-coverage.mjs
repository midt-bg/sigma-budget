import { readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function checkCoverage(
  baseline,
  reports,
  exceptions,
  today = new Date().toISOString().slice(0, 10),
) {
  const failures = [];
  if (baseline.tolerance !== 0.5) throw new Error('Coverage tolerance must remain 0.5pp');
  for (const e of exceptions) {
    if (
      !baseline.workspaces[e.workspace] ||
      !['lines', 'branches'].includes(e.metric) ||
      !Number.isFinite(e.minimum) ||
      e.minimum < 0 ||
      e.minimum > 100 ||
      !e.reason?.trim() ||
      !/^https:\/\/github.com\/midt-bg\/sigma-budget\/pull\/\d+$/.test(e.review) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.expires) ||
      !Number.isFinite(Date.parse(e.expires)) ||
      new Date(e.expires).toISOString().slice(0, 10) !== e.expires ||
      e.expires < today
    ) {
      throw new Error('Invalid or expired reviewed coverage exception');
    }
  }
  for (const [workspace, targets] of Object.entries(baseline.workspaces)) {
    const total = reports[workspace]?.total;
    for (const metric of ['lines', 'branches', 'functions', 'statements']) {
      const actual = total?.[metric]?.pct;
      if (!Number.isFinite(actual) || actual < 0 || actual > 100) {
        failures.push(`${workspace}: missing/invalid ${metric} report`);
        continue;
      }
      if (!['lines', 'branches'].includes(metric)) continue;
      const target = targets[metric];
      if (!Number.isFinite(target) || target < 0 || target > 100)
        throw new Error(`Invalid baseline: ${workspace}/${metric}`);
      const exception = exceptions.filter((e) => e.workspace === workspace && e.metric === metric);
      if (exception.length > 1) throw new Error('Duplicate coverage exception');
      const minimum = exception[0]?.minimum ?? target - baseline.tolerance;
      if (actual < minimum) failures.push(`${workspace}: ${metric} ${actual}% < ${minimum}%`);
    }
  }
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseline = JSON.parse(readFileSync('coverage-baseline.json', 'utf8'));
  const exceptions = JSON.parse(readFileSync('coverage-exceptions.json', 'utf8'));
  const workspaces = ['apps', 'packages']
    .flatMap((dir) => readdirSync(dir).map((name) => `${dir}/${name}`))
    .filter((dir) => {
      try {
        return JSON.parse(readFileSync(`${dir}/package.json`)).scripts?.test;
      } catch {
        return false;
      }
    });
  if (
    workspaces.some((w) => !baseline.workspaces[w]) ||
    Object.keys(baseline.workspaces).some((w) => !workspaces.includes(w))
  ) {
    throw new Error('Baseline must list every test-bearing workspace');
  }
  const reports = Object.fromEntries(
    workspaces.map((w) => [
      w,
      JSON.parse(readFileSync(`${w}/coverage/coverage-summary.json`, 'utf8')),
    ]),
  );
  if (process.argv.includes('--update')) {
    for (const w of workspaces)
      baseline.workspaces[w] = Object.fromEntries(
        ['lines', 'branches'].map((m) => [m, reports[w].total[m].pct]),
      );
    writeFileSync('coverage-baseline.json', JSON.stringify(baseline, null, 2) + '\n');
  }
  const failures = checkCoverage(baseline, reports, exceptions);
  const summary =
    '# Покритие на Node тестовете\n\n| Workspace | Lines | Branches | Functions | Statements |\n| --- | ---: | ---: | ---: | ---: |\n' +
    workspaces
      .map(
        (w) =>
          `| ${w} | ` +
          ['lines', 'branches', 'functions', 'statements']
            .map((m) => `${reports[w].total[m].pct}%`)
            .join(' | ') +
          ' |',
      )
      .join('\n') +
    '\n\nНачална измерена база; регресионният праг е по workspace за lines и branches, с толеранс 0.5 процентни пункта.\n' +
    (failures.length ? '\n' + failures.join('\n') : '\nПроверка: PASS.') +
    '\n';
  writeFileSync('coverage-summary.md', summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);
  if (failures.length) process.exitCode = 1;
}
