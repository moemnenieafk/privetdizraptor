import { exec } from 'child_process';
import readline from 'readline';
import { promisify } from 'util';

const execPromise = promisify(exec);

// --- Цвета для красивого вывода в консоль ---
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m"
};

// --- Файлы, которые мы отслеживаем ---
const DOC_FILES_TO_SYNC = [
    'README.md',
    'CHANGELOG.md',
    'PROJECT_STRUCTURE.md'
].join(' ');

/**
 * Выполняет shell-команду и выводит ее результат.
 * @param {string} command - Команда для выполнения.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function runCommand(command) {
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stderr && !command.startsWith('git commit')) {
        console.error(colors.red, `stderr: ${stderr}`, colors.reset);
    }
    return { stdout, stderr };
  } catch (error) {
    console.error(colors.red, `❌ Ошибка выполнения команды "${command}":\n${error.stderr || error.message}`, colors.reset);
    throw error;
  }
}

/**
 * Задает вопрос пользователю в консоли.
 * @param {string} query - Вопрос.
 * @returns {Promise<string>} - Ответ пользователя в нижнем регистре.
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim().toLowerCase());
  }));
}

/**
 * Основная функция скрипта.
 */
async function main() {
  // Проверяем, запущен ли скрипт в терминале VS Code
  if (!process.env.TERM_PROGRAM || process.env.TERM_PROGRAM !== 'vscode') {
    console.log(colors.red, '❌ ОШИБКА: Этот скрипт предназначен для запуска только из интегрированного терминала VS Code.');
    console.log(colors.yellow, 'Пожалуйста, откройте проект в VS Code и запустите команду оттуда.');
    return;
  }

  try {
    console.log(colors.cyan, '🚀 Запуск скрипта синхронизации документации...', colors.reset);

    console.log('Проверка изменений в файлах документации...');
    const { stdout: statusOutput } = await runCommand(`git status --porcelain ${DOC_FILES_TO_SYNC}`);

    if (!statusOutput.trim()) {
      console.log(colors.yellow, 'ℹ️ Нет изменений в файлах документации. Синхронизация не требуется.', colors.reset);
      return;
    }

    console.log(colors.green, '✅ Найдены изменения в следующих файлах:\n' + statusOutput, colors.reset);

    await runCommand(`git add ${DOC_FILES_TO_SYNC}`);
    console.log('Файлы добавлены в индекс Git.');

    const commitMessage = `docs: Обновление документации проекта`;
    await runCommand(`git commit -m "${commitMessage}"`);
    console.log(colors.green, `✅ Создан коммит: "${commitMessage}"`, colors.reset);

    const answer = await askQuestion(`\n❓ ${colors.yellow}Выполнить push в удаленный репозиторий? (y - обычный / f - force push / n - отмена): ${colors.reset}`);

    if (answer === 'y') {
      console.log('Выполняется push...');
      await runCommand('git push');
      console.log(colors.magenta, '✅ Push успешно выполнен!', colors.reset);
    } else if (answer === 'f') {
      console.log('Выполняется FORCE push...');
      await runCommand('git push --force');
      console.log(colors.magenta, '✅ Force push успешно выполнен!', colors.reset);
    } else {
      console.log(colors.cyan, 'ℹ️ Push отменен пользователем. Коммит создан локально.', colors.reset);
    }
  } catch (error) {
    console.error(colors.red, '\nСкрипт завершился с ошибкой.', colors.reset);
    process.exit(1);
  }
}

main();
