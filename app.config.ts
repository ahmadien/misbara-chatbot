import { createApp } from 'vinxi'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default createApp({
  tsr: {
    appDirectory: 'src',
  },
  server: {
    preset: 'node',
  },
  vite: {
    plugins: [
      // this is the plugin that enables path aliases
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
    ],
  },
})
