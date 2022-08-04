/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-await-in-loop */
import { join } from 'path'
import fs from 'fs'
import { mergeDeepRight } from 'rambda'
import { ManifestType } from 'vscode-manifest'
import { SetRequired } from 'type-fest'
import parseArgv from 'minimist'
import { trueCasePath } from 'true-case-path'
import { assignDefined } from '@zardoy/utils'
import execa, { Options as ExecaOptions } from 'execa'
import fsExtra from 'fs-extra'
import { modifyPackageJsonFile } from 'modify-json-file'
import { readJsonFile, readPackageJsonFile } from 'typed-jsonfile'
import dedent from 'string-dedent'
import globby from 'globby'
import { build } from 'esbuild'
import { parsePatchFile } from './patch-package/types/patch/parse'
import { executeEffects } from './patch-package/types/patch/apply'
import { gitlyCached } from './gitlyCached'

// git diff --cached > mypatch.patch

export interface AnyLevelMetadata {
    build: string
    precommand: string
    postfixDisplayName: string
    packageJson?: Record<string, any>
    skipPrepublish?: boolean
    esbuildOptions?: Record<string, any>
}

export interface MetadataJson extends Partial<AnyLevelMetadata> {
    repo: string
    location?: string
    clipDir?: boolean
    skip?: true
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
    const globalLevelMetadata = await readJsonFile<GlobalMetadataJson>(join(extensionsPath, '../metadata.jsonc'))
    const argv = parseArgv<{
        // extensions only
        ext: string
        dev: boolean
        release: boolean
        noClean: boolean
    }>(process.argv.slice(2))

    // Stage: preparing
    await fs.promises.rename(pnpmWorkspaceFile[0], pnpmWorkspaceFile[1])

    const cachePath = join(basePath, 'source-cache')

    for (const extension of argv.ext ?? extensionsList) {
        const fromSource = (...path: string[]) => join(extensionsPath, extension, ...path)
        if (!fs.lstatSync(fromSource()).isDirectory()) continue
        const localLevelMetadata = await readJsonFile<MetadataJson>(fromSource('metadata.jsonc'))
        if (localLevelMetadata.skip) continue
        const mergedMetadata: AnyLevelMetadata = { ...globalLevelMetadata, ...localLevelMetadata }
        mergedMetadata.packageJson = { ...globalLevelMetadata.packageJson, ...localLevelMetadata.packageJson }

        const fromDest = (...path: string[]) => join(basePath, 'dest', extension, ...path)
        const fromDestExtension = (...path: string[]) => (localLevelMetadata.clipDir ? fromDest(...path) : fromDest(localLevelMetadata.location ?? '', ...path))
        const fromTemp = (...path: string[]) => join(basePath, 'temp', extension, ...path)

        console.log('Extension target:', fromDestExtension())
        const { cachedPath } = await gitlyCached(cachePath, localLevelMetadata.repo, {
            ifNotExists: {
                before() {
                    console.log('Downloading', localLevelMetadata.repo)
                },
            },
        })
        if (fs.existsSync(fromDest())) await fsExtra.rm(fromDest(), { recursive: true })
        await fsExtra.copy(cachedPath, localLevelMetadata.clipDir ? fromDest(localLevelMetadata.location ?? '') : fromDest())
        // TODO make pkg from release-action

        const newEntrypoint = 'main.js'
        const conflictingFiles = [newEntrypoint].filter(path => fs.existsSync(fromDestExtension(path)))
        if (conflictingFiles.length > 0) throw new Error(`Conflicting file(s) in ext dir: ${conflictingFiles.join(', ')}`)
        // const vscIgnoreFile = fromDestExtension('.vscodeignore')
        // if (fs.existsSync(vscIgnoreFile)) {
        //     let oldIgnore = await fs.promises.readFile(vscIgnoreFile, 'utf-8')
        //     oldIgnore += '\n!main.js'
        //     await fs.promises.writeFile(vscIgnoreFile, oldIgnore, 'utf-8')
        // }

        let manifest!: ManifestType
        let originalManifest!: ManifestType
        let originalFullId!: string
        const mainScriptOverride = mergedMetadata.packageJson?.main
        await modifyPackageJsonFile({ dir: fromDestExtension() }, manifestUntyped => {
            manifest = manifestUntyped as any
            originalManifest = { ...manifest }
            originalFullId = `${manifest.publisher}.${manifest.name}`
            assignDefined(manifest, {
                displayName: manifest.displayName + mergedMetadata.postfixDisplayName,
            })
            // TODO restore browser field
            Object.assign(
                manifest,
                mergeDeepRight(manifest, {
                    browser: undefined,
                    // I don't mind of leaving it as is, but it can confuse people
                    sponsor: undefined,
                    main: newEntrypoint,
                    repository: process.env.GITHUB_REPOSITORY ?? 'd/d',
                    icon: undefined,
                    ...mergedMetadata.packageJson,
                }),
            )

            return manifest
        })
        const originalReadmePath = await trueCasePath('readme.md', fromDestExtension())
        // const readmeContents = await fs.promises.readFile(originalReadmePath, 'utf-8')
        // ensure readme is always in lowercase
        const newReadmeContents = await fs.promises.readFile(fromSource('readme.md'), 'utf-8')
        await fs.promises.unlink(originalReadmePath)
        await fs.promises.writeFile(
            fromDestExtension('README.MD'),
            dedent`
              # ${manifest.displayName}
              ❗❗❗ This is extended version of [${originalManifest.displayName}](https://marketplace.visualstudio.com/items?itemName=${originalFullId}). You need to disable original extension in order this extension to work!
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

        // eslint-disable-next-line sonarjs/no-duplicate-string
        const prepublishScriptContents = originalManifest.scripts?.['vscode:prepublish']
        if (prepublishScriptContents) {
            await modifyPackageJsonFile({ dir: fromDestExtension() }, pkg => {
                pkg.scripts!['vscode:prepublish'] = undefined
                return pkg
            })
            if (mergedMetadata.skipPrepublish !== false) {
                await execute(prepublishScriptContents, { cwd: fromDestExtension() })
                if (!mainScriptOverride) originalManifest.main = (await readPackageJsonFile({ dir: fromDestExtension() })).main
            }
        }

        await fsExtra.emptyDir(fromTemp())

        // const entrypoint = fromTemp('entrypoint.ts');
        // await fsExtra.copyFile(join(__dirname, 'wrapper.ts'), entrypoint)

        let originalEntrypoint = mainScriptOverride ?? originalManifest.main!
        if (!originalEntrypoint.startsWith('./')) originalEntrypoint = `./${originalEntrypoint}`

        if (!originalEntrypoint) throw new Error('No main entry in package.json')
        // if (!fs.existsSync(originalEntrypoint)) throw new Error("Entrypoint doesn't exist")

        await build({
            bundle: true,
            // entryPoints: [entrypoint],
            entryPoints: [join(__dirname, 'wrapper.ts')],
            outfile: fromDestExtension(newEntrypoint),
            platform: 'node',
            target: 'node16',
            // minify:true,
            // metafile: true,
            format: 'cjs',
            external: [originalEntrypoint, 'vscode'],
            define: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                __ORIGINAL_EXTENSION_ID__: `"${originalFullId}"`,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                __INJECT__ENTRYPOINT__: 'null',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                __ORIGINAL_ENTRYPOINT__: `"${originalEntrypoint}"`,
            },
            ...mergedMetadata.esbuildOptions,
        })

        if (argv.release) {
            const vsixPath = fromTemp('output.vsix')
            // TODO change path to more safe
            // skipping ovsx just for now
            await execa('vsce', ['package', '--out', vsixPath], { stdio: 'inherit', cwd: fromDestExtension() })
            if (process.env.CI) await execa('vsce', ['publish', '--packagePath', vsixPath], { stdio: 'inherit', cwd: fromDestExtension() })
        }

        if (prepublishScriptContents)
            await modifyPackageJsonFile({ dir: fromDestExtension() }, pkg => {
                pkg.scripts!['vscode:prepublish'] = prepublishScriptContents
                return pkg
            })
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
