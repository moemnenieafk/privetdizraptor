Коротко: в Claude Code мультиагентность уже есть, но не в виде "постоянных агентов". Вот как это работает и что реально сделать для CTA:

Уровень 1 — прямо сейчас, ничего не настраивать
Параллельные Agent-вызовы (что я уже делаю):

Я могу запустить 3–5 агентов одновременно в одном ответе
Каждый получает свою специализацию через промпт
Результаты объединяю сам
Пример: "разработай спринт → дизайнер-агент придумывает макет, архитектор-агент выбирает файлы, ревьюер-агент проверяет существующий код" — всё параллельно за один тур.

Ограничение: они живут только в рамках одного запроса, "памяти" между вызовами нет.

Уровень 2 — скилы как специализация
У тебя уже настроены скилы как "роли":

/cta-design-ui → дизайнер
/tarkov-api → data-engineer
/nightfall → UI-ревьюер
/scaffold + /refactor → имплементатор + QA
Это не агенты, но каждый скил загружает нужный контекст и меняет "режим работы".

Уровень 3 — настоящий мультиагент через API (нужно написать)
Это реальная многоагентная система. Нужен оркестратор — небольшой скрипт:


cta-project/
└── agents/
    ├── orchestrator.ts     ← главный, раздаёт задачи
    ├── design-agent.ts     ← получает задачу, думает о UI
    ├── impl-agent.ts       ← пишет код
    ├── review-agent.ts     ← ревьюит результат
    └── shared/
        └── context.md      ← общий контекст проекта
orchestrator.ts — вызывает остальных через @anthropic-ai/sdk, передаёт результат одного как контекст следующему:


import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const AGENTS = {
  design: { model: 'claude-sonnet-4-6', system: 'Ты UI/UX дизайнер CTA...' },
  impl:   { model: 'claude-sonnet-4-6', system: 'Ты senior frontend dev CTA...' },
  review: { model: 'claude-opus-4-8',   system: 'Ты code reviewer...' },
};

async function runPipeline(task: string) {
  // 1. Дизайнер
  const design = await client.messages.create({
    model: AGENTS.design.model,
    system: AGENTS.design.system,
    messages: [{ role: 'user', content: task }],
    max_tokens: 2048,
  });
  
  // 2. Имплементатор получает результат дизайнера
  const impl = await client.messages.create({
    model: AGENTS.impl.model,
    system: AGENTS.impl.system,
    messages: [{ role: 'user', content: `Дизайн:\n${design.content}\n\nЗадача: ${task}` }],
    max_tokens: 8096,
  });

  // 3. Ревьюер проверяет код
  const review = await client.messages.create({ ... });
}
Что реально нужно для CTA
Вариант A (минимум): продолжать как сейчас — говоришь мне "запусти агентов параллельно для X", я делаю это в одном туре. Работает, бесплатно.

Вариант B (автономные агенты): создать agents/orchestrator.ts и запускать через npx ts-node agents/orchestrator.ts "задача". Тогда ты даёшь задачу в терминале, агенты отрабатывают сами, результат — готовые файлы.

Вариант C (cloud scheduled): /schedule скилл — запустить агента по расписанию (например, "каждое утро проверять что сломалось").

Мой совет: для CTA сейчас достаточно Варианта A + правильно сформулированных запросов. Если хочешь Вариант B — скажи, напишу orchestrator.ts под твой проект за один присест.