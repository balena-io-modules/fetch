import path from 'path'
import { run } from './test'

async function cli() {
  const files = process.argv.filter(file => /\.ts$/.test(file))
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