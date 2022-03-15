/* eslint-disable unicorn/filename-case */
/* eslint-disable no-await-in-loop */
import { join } from 'path'
import fs from 'fs'
import { SetRequired } from 'type-fest'
import parseArgv from 'minimist'
import { trueCasePath } from 'true-case-path'
import { assignDefined } from '@zardoy/utils'
import execa, { Options as ExecaOptions } from 'execa'
import fsExtra from 'fs-extra'
import { modifyPackageJsonFile } from 'modify-json-file'
import gitly from 'gitly'
import { readJsonFile } from 'typed-jsonfile'
import dedent from 'string-dedent'
import globby from 'globby'
import { parsePatchFile } from './patch-package/types/patch/parse'
import { executeEffects } from './patch-package/types/patch/apply'

// git diff --cached > mypatch.patch

export interface AnyLevelMetadata {
    packageJson?: Record<string, any>
    build: string
    precommand: string
    postfixDisplayName: string
}

export interface MetadataJson extends Partial<AnyLevelMetadata> {
    repo: string
    location?: string
    // only
    // postfixDisplayName?: string
}
export interface GlobalMetadataJson extends AnyLevelMetadata {
    // only
}
// files dir

/** Should be safe */
const execute = async (cmd: string, options: SetRequired<ExecaOptions, 'cwd'>) => {
    // weird workaround
    const subcommands = cmd.split('&&')
    for (const command of subcommands) {
        const parts = command.trim().split(' ')
        await execa(parts[0]!, parts.slice(1), {
            stdio: 'inherit',
            env: {
                NPM_TOKEN: undefined,
                GITHUB_TOKEN: undefined,
                OVSX_PAT: undefined,
                VSCE_PAT: undefined,
            } as any,
            ...options,
        })
    }
}

const pnpmWorkspaceFile = [join(__dirname, '../pnpm-workspace.yaml'), join(__dirname, '../pnpm-workspace.old.yaml')] as const

const main = async () => {
    const basePath = join(__dirname, '..')
    const extensionsPath = join(basePath, 'extended-extensions/extensions')
    const extensionsList = await fs.promises.readdir(extensionsPath)
    const globalLevelMetadata = await readJsonFile<GlobalMetadataJson>(join(__dirname, './metadata.json'))
    const argv = parseArgv<{
        // extensions only
        ext: string
        dev: boolean
        release: boolean
    }>(process.argv.slice(2))

    // Stage: preparing
    await fs.promises.rename(pnpmWorkspaceFile[0], pnpmWorkspaceFile[1])

    for (const extension of argv.ext ?? extensionsList) {
        const fromSource = (...path: string[]) => join(extensionsPath, extension, ...path)
        if (!fs.lstatSync(fromSource()).isDirectory()) continue
        const localLevelMetadata = await readJsonFile<MetadataJson>(fromSource('metadata.jsonc'))
        const mergedMetadata: AnyLevelMetadata = { ...globalLevelMetadata, ...localLevelMetadata }
        mergedMetadata.packageJson = { ...globalLevelMetadata.packageJson, ...localLevelMetadata.packageJson }

        const fromCache = (...path: string[]) => join(basePath, 'source-cache', extension, ...path)
        const fromDest = (...path: string[]) => join(basePath, 'dest', extension, ...path)
        const fromDestExtension = (...path: string[]) => fromDest(localLevelMetadata.location ?? '', ...path)

        console.log('Extension target:', fromDestExtension())
        if (!fs.existsSync(fromCache())) await gitly(localLevelMetadata.repo, fromCache(), {})
        if (fs.existsSync(fromDest())) await fsExtra.rm(fromDest(), { recursive: true })
        await fsExtra.copy(fromCache(), fromDest())
        // TODO make pkg from release-action

        let manifest
        let originalFullId: string
        await modifyPackageJsonFile({ dir: fromDestExtension() }, manifestUntyped => {
            originalFullId = `${manifest.publisher}.${manifest.name}`
            manifest = manifestUntyped as any
            manifest.originalDisplayName = manifest.displayName
            if (!manifest.main) throw new Error('No main script')
            manifest.originalMain = manifest.main
            assignDefined(manifest, {
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                displayName: manifest.displayName + mergedMetadata.postfixDisplayName,
            })
            // TODO restore browser field
            Object.assign(manifest, { /* main: './main.js', */ browser: undefined, icon: undefined, ...mergedMetadata.packageJson })
            return manifest
        })
        // TODO
        // await fs.promises.writeFile(fromDestExtension('./main.js'), `module.exports = require('./${manifest.originalMain}')`)
        const originalReadmePath = await trueCasePath('readme.md', fromDestExtension())
        // const readmeContents = await fs.promises.readFile(originalReadmePath, 'utf-8')
        // ensure readme is always in lowercase
        const newReadmeContents = await fs.promises.readFile(fromSource('readme.md'), 'utf-8')
        await fs.promises.unlink(originalReadmePath)
        await fs.promises.writeFile(
            fromDestExtension('README.MD'),
            dedent`
              # ${manifest.displayName}
              ❗❗❗ This is extended version of [${manifest.originalDisplayName}](https://marketplace.visualstudio.com/items?itemName=${originalFullId}). You need to disable original extension in order this extension to work!
              ${newReadmeContents}
            `,
        )
        // process.chdir(fromDestExtension())
        // apply patches (experimental)
        const patches = await globby('**/*.patch', { ignore: ['**/*.ignore.patch'], absolute: true, cwd: fromSource() })
        for (const patchPath of patches) {
            console.log('Applying patch', patchPath)
            const patch = parsePatchFile(await fs.promises.readFile(patchPath, 'utf-8')).map(patch => {
                if ('path' in patch) patch.path = fromDest(patch.path)
                return patch
            })
            executeEffects(patch, { dryRun: false })
        }

        if (mergedMetadata.precommand) await execute(mergedMetadata.precommand, { cwd: fromDest() })
        // if (argv.dev)
        await execute(mergedMetadata.build, { cwd: fromDestExtension() })

        if (argv.release) {
            const vsixPath = fromDest('output.vsix')
            // TODO change path to more safe
            // skipping ovsx just for now
            await execa('vsce', ['package', '--out', vsixPath], { stdio: 'inherit', cwd: fromDestExtension() })
            if (process.env.CI) await execa('vsce', ['publish', '--packagePath', vsixPath], { stdio: 'inherit', cwd: fromDestExtension() })
        }
    }
}

main()
    .finally(() => {
        if (fs.existsSync(pnpmWorkspaceFile[1])) fs.renameSync(pnpmWorkspaceFile[1], pnpmWorkspaceFile[0])
    })
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
