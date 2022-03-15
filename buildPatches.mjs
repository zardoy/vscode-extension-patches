//@ts-check

import { build } from 'esbuild'
import fs from 'fs'
import { posix as pathPosix } from 'path'

import { globby } from 'globby'
import { fileURLToPath } from 'url'

const { dirname, join, extname } = pathPosix
;(async () => {
    // @ts-ignore
    const __dirname = dirname(fileURLToPath(import.meta.url))

    const fromModules = (...p) => join(__dirname, 'modules', ...p)

    const browserModulePaths = await globby(fromModules('*/browser-patch'), { onlyDirectories: true })
    const mainModulePaths = await globby(fromModules('*/main-patch'), { onlyDirectories: true })
    const devMode = process.argv[2] === 'dev'

    /** @type {import('esbuild').BuildOptions} */
    const sharedEsbuildConfig = {
        define: {
            __DEV__: `${devMode}`,
        },
        watch: devMode,
        logLevel: 'info',
        outdir: '.',
    }
    await build({
        ...sharedEsbuildConfig,
        platform: 'browser',
        // format: 'cjs',
        entryPoints: Object.fromEntries(
            browserModulePaths.map(browserModule => {
                return [join(browserModule, `../out/browser-patch`), join(browserModule, 'index.ts')]
            }),
        ),
    })
    // await build({
    //     ...sharedEsbuildConfig,
    //     platform: 'node',
    //     format: 'cjs',
    //     entryPoints: Object.fromEntries(
    //         mainModulePaths.map(mainModule => {
    //             return [join(mainModule, `../out/main-patch.js`), join(mainModule, 'index.ts')]
    //         }),
    //     ),
    // })
})().catch(err => {
    console.error(err)
    process.exit(1)
})
