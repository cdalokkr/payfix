import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function executableLines(script) {
  return script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function sectionContents(config, sectionName) {
  const section = config.match(
    new RegExp(`(?:^|\\n)\\[${sectionName}\\]\\s*\\n?([\\s\\S]*?)(?=\\n\\[|$)`),
  );
  return section ? section[1] : null;
}

function commandArray(section, commandName) {
  const assignment = section.match(
    new RegExp(`^\\s*${commandName}\\s*=\\s*\\[([^\\]]*)\\]`, 'm'),
  );
  if (!assignment) {
    return null;
  }

  return [...assignment[1].matchAll(/"([^"]*)"|'([^']*)'/g)].map(
    ([, doubleQuoted, singleQuoted]) => doubleQuoted ?? singleQuoted,
  );
}

function validateDeploymentPackageManager(replitConfig) {
  const deployment = sectionContents(replitConfig, 'deployment');
  if (deployment === null) {
    return [];
  }

  const failures = [];
  for (const commandName of ['build', 'run']) {
    const command = commandArray(deployment, commandName);
    if (!command || command[0] !== 'pnpm') {
      const actual = command?.[0] ?? 'no command';
      failures.push(
        `[deployment].${commandName} must invoke pnpm, the repository's canonical package manager; found ${actual}.`,
      );
    }
  }
  return failures;
}

function packageManagerDeclaration(packageJson) {
  if (!packageJson) {
    return null;
  }

  let parsedPackageJson;
  try {
    parsedPackageJson = JSON.parse(packageJson);
  } catch {
    return null;
  }

  if (
    typeof parsedPackageJson.packageManager !== 'string' ||
    !/^pnpm@[^@\s]+$/.test(parsedPackageJson.packageManager)
  ) {
    return null;
  }

  const declaredVersion = parsedPackageJson.packageManager.slice('pnpm@'.length);
  return {
    declaration: parsedPackageJson.packageManager,
    version: declaredVersion.split('+', 1)[0],
  };
}

function validatePackageManagerDeclaration(packageJson) {
  if (!packageJson) {
    return [];
  }

  if (!packageManagerDeclaration(packageJson)) {
    let parsedPackageJson;
    try {
      parsedPackageJson = JSON.parse(packageJson);
    } catch {
      return ['package.json must be valid JSON before its package-manager policy can be checked.'];
    }

    if (
      typeof parsedPackageJson.packageManager !== 'string' ||
      !/^pnpm@[^@\s]+$/.test(parsedPackageJson.packageManager)
    ) {
      return [
        'package.json must declare a pnpm packageManager because pnpm-lock.yaml is the canonical dependency graph.',
      ];
    }
  }

  return [];
}

function workflowSteps(workflow) {
  const lines = workflow.split(/\r?\n/);
  const stepStarts = lines.reduce((starts, line, index) => {
    if (/^\s*-\s/.test(line)) {
      starts.push(index);
    }
    return starts;
  }, []);

  return stepStarts.map((stepStart) => {
    const indent = lines[stepStart].match(/^(\s*)-\s/)[1].length;
    let stepEnd = stepStart + 1;
    while (stepEnd < lines.length) {
      const nextStep = lines[stepEnd].match(/^(\s*)-\s/);
      if (nextStep && nextStep[1].length === indent) {
        break;
      }
      stepEnd += 1;
    }
    return lines.slice(stepStart, stepEnd);
  });
}

function validateCiPackageManager(ciWorkflow, packageManager, workflowPath, requireSetup = false) {
  if (!ciWorkflow || !packageManager) {
    return [];
  }

  const setupSteps = workflowSteps(ciWorkflow).filter((step) =>
    /^\s*uses:\s*pnpm\/action-setup@/m.test(step.join('\n')),
  );

  if (setupSteps.length === 0) {
    if (!requireSetup) {
      return [];
    }
    return [
      `CI must configure pnpm/action-setup so it uses package.json's declared ${packageManager.declaration}.`,
    ];
  }

  return setupSteps.flatMap((setupStep) => {
    const setupStepText = setupStep.join('\n');
    const versionMatch = setupStepText.match(
      /^\s*version:\s*["']?([^"'#\s]+)["']?\s*(?:#.*)?$/m,
    );
    if (!versionMatch) {
      return [
        `CI's pnpm/action-setup version in ${workflowPath} must match package.json's declared ${packageManager.declaration}; no CI version was found.`,
      ];
    }

    const ciVersion = versionMatch[1];
    if (ciVersion !== packageManager.version) {
      return [
        `pnpm version mismatch: package.json declares ${packageManager.declaration}, but ${workflowPath} configures pnpm/action-setup with version ${ciVersion}.`,
      ];
    }

    return [];
  });
}

function ciWorkflowEntries({ ciWorkflow, ciWorkflows }) {
  if (ciWorkflows !== undefined) {
    if (Array.isArray(ciWorkflows)) {
      return ciWorkflows
        .filter((workflow) => workflow && typeof workflow.content === 'string')
        .map((workflow) => ({
          path:
            typeof workflow.path === 'string'
              ? workflow.path
              : '.github/workflows/unknown.yml',
          content: workflow.content,
          requireSetup: false,
        }));
    }

    if (ciWorkflows && typeof ciWorkflows === 'object') {
      return Object.entries(ciWorkflows)
        .filter(([, content]) => typeof content === 'string')
        .map(([path, content]) => ({
          path,
          content,
          requireSetup: false,
        }));
    }
  }

  if (ciWorkflow) {
    return [
      {
        path: '.github/workflows/saas-ci.yml',
        content: ciWorkflow,
        requireSetup: true,
      },
    ];
  }

  return [];
}

export function validatePostMergeSetup({
  postMergeScript,
  pnpmLockfile,
  replitConfig = '',
  packageJson = '',
  ciWorkflow = '',
  ciWorkflows,
}) {
  const failures = [];
  const lines = executableLines(postMergeScript);
  const installLines = lines.filter((line) => /\b(?:pnpm|npm|yarn|bun)\s+(?:install|ci)\b/.test(line));
  const pnpmInstallLine = installLines.find((line) => /\bpnpm\s+install\b/.test(line));
  const packageManager = packageManagerDeclaration(packageJson);

  failures.push(...validatePackageManagerDeclaration(packageJson));
  failures.push(...validateDeploymentPackageManager(replitConfig));
  for (const workflow of ciWorkflowEntries({ ciWorkflow, ciWorkflows })) {
    failures.push(
      ...validateCiPackageManager(
        workflow.content,
        packageManager,
        workflow.path,
        workflow.requireSetup,
      ),
    );
  }

  if (!pnpmInstallLine) {
    failures.push(
      'scripts/post-merge.sh must run `pnpm install`; npm, yarn, and bun installs are not supported for post-merge setup.',
    );
  }

  if (installLines.some((line) => /\b(?:npm|yarn|bun)\s+(?:install|ci)\b/.test(line))) {
    failures.push(
      'scripts/post-merge.sh must not run npm, yarn, or bun install/ci; pnpm-lock.yaml is the canonical post-merge lockfile.',
    );
  }

  if (pnpmInstallLine && !/(?:^|\s)--frozen-lockfile(?:\s|$)/.test(pnpmInstallLine)) {
    failures.push(
      'The post-merge pnpm install must include --frozen-lockfile so dependency resolution cannot drift.',
    );
  }

  if (pnpmInstallLine && /package-lock\.json/.test(pnpmInstallLine)) {
    failures.push(
      'The post-merge pnpm install must resolve against pnpm-lock.yaml, not package-lock.json.',
    );
  } else if (
    pnpmInstallLine &&
    /(?:^|\s)--lockfile(?:=|\s+)/.test(pnpmInstallLine) &&
    !/(?:^|\s)--lockfile=pnpm-lock\.yaml(?:\s|$)/.test(pnpmInstallLine)
  ) {
    failures.push(
      'The post-merge pnpm install must resolve against pnpm-lock.yaml when an explicit lockfile is provided.',
    );
  }

  if (!pnpmLockfile.trim()) {
    failures.push('pnpm-lock.yaml is missing or empty; post-merge setup cannot verify the dependency graph.');
  } else {
    if (!/^\s*lockfileVersion\s*:/m.test(pnpmLockfile)) {
      failures.push('pnpm-lock.yaml does not look like a pnpm lockfile (missing lockfileVersion).');
    }
    if (!/^\s*importers\s*:/m.test(pnpmLockfile)) {
      failures.push('pnpm-lock.yaml does not contain pnpm importer metadata.');
    }
  }

  if (!replitConfig || !/\[postMerge\][\s\S]*?path\s*=\s*"scripts\/post-merge\.sh"/.test(replitConfig)) {
    failures.push('.replit must wire the [postMerge] hook to scripts/post-merge.sh.');
  }

  return failures;
}

async function readProjectFile(relativePath) {
  try {
    return await readFile(join(projectRoot, relativePath), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

async function readCiWorkflows() {
  let entries;
  try {
    entries = await readdir(join(projectRoot, '.github/workflows'), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && /\.(?:yml|yaml)$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) => {
        const path = `.github/workflows/${entry.name}`;
        return { path, content: await readProjectFile(path) };
      }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [postMergeScript, pnpmLockfile, replitConfig, packageJson, ciWorkflows] = await Promise.all([
    readProjectFile('scripts/post-merge.sh'),
    readProjectFile('pnpm-lock.yaml'),
    readProjectFile('.replit'),
    readProjectFile('package.json'),
    readCiWorkflows(),
  ]);
  const failures = validatePostMergeSetup({
    postMergeScript,
    pnpmLockfile,
    replitConfig,
    packageJson,
    ciWorkflows,
  });

  if (failures.length > 0) {
    console.error('Post-merge dependency setup validation failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      'Repository dependency setup and deployment are wired to pnpm with a frozen pnpm-lock.yaml.',
    );
  }
}