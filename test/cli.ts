import { readdirSync } from 'fs';
import path from 'path'
import { run } from './test'

async function cli() {
  let files = process.argv.filter(file => /\.ts$/.test(file))
  if (files.length < 2) {
    files = readdirSync(path.resolve(process.cwd(), 'src'))
      .map(file => path.resolve('src', file));
  }

  for (const file of files) {
    await import(path.resolve(process.cwd(), file))
      .then(run);
  }


  if (process.argv.includes('-w')) {
    ;(async () => {
      const fs = await import ('fs');
      for (const file of files) {
        fs.watchFile(file, async () => {
          delete require.cache[file]
          await import(file)
          await run()
        })
      }
    })()
  }
}

cli()