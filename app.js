// Wrapper dinâmico para plataformas de hospedagem PaaS na Nuvem, como Hostinger, Heroku Vanilla e Passenger
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
  require('./dist/server.cjs');
} catch (err) {
  console.error("Erro crítico: O build (dist/server.cjs) não foi encontrado. Você executou o comando 'npm run build' primeiramente?", err);
  process.exit(1);
}
