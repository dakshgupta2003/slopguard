import { checkPackages } from "../src/engine.js";
import { loadDataset } from "../src/dataset.js";

const NPM_TOP = `react react-dom lodash express axios chalk commander debug typescript eslint prettier vite
webpack rollup esbuild jest vitest mocha chai zod yup dayjs moment uuid nanoid classnames clsx
tailwindcss postcss autoprefixer next nuxt vue svelte solid-js redux zustand immer rxjs
node-fetch undici got ws socket.io cors helmet dotenv fs-extra glob rimraf minimist yargs
semver picocolors kleur ora inquirer prompts execa cross-env husky lint-staged
@types/node @types/react graphql apollo-server prisma drizzle-orm knex sequelize mongoose pg mysql2
sqlite3 redis ioredis bull nodemailer stripe firebase openai anthropic langchain puppeteer playwright
cheerio jsdom marked highlight.js sharp canvas pdfkit archiver form-data qs body-parser`
  .split(/\s+/)
  .filter(Boolean);

const pip = loadDataset<{ packages: string[] }>("popular-pypi.json").packages.slice(0, 2000);

for (const [ecosystem, names] of [
  ["pip", pip],
  ["npm", NPM_TOP],
] as const) {
  const results = await checkPackages(ecosystem, names);
  const flagged = results.filter((r) => r.level !== "allow");
  for (const r of flagged) {
    console.log(r.level, r.name, r.risk, r.signals.map((s) => s.reason).join(" | "));
  }
  console.log(`${ecosystem}: ${flagged.length} flagged of ${results.length}`);
}
