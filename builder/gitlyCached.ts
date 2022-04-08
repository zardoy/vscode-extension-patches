import fs from 'fs'
import { join } from 'path'
import gitly from 'gitly'
import GitlyOptions from 'gitly/lib/interfaces/options'

interface GitlyCachedOptions extends GitlyOptions {
    ifExists?: {
        before?(cachedPath: string): unknown
        after?(cachedPath: string): unknown
    }
    ifNotExists?: {
        before?(downloadingPath: string): unknown
        after?(downloadingPath: string): unknown
    }
}

export const gitlyCached = async (cacheDir: string, repo: string, options: GitlyCachedOptions = {}) => {
    const cachedPath = join(cacheDir, repo)
    const exists = fs.existsSync(cachedPath)
    if (exists) options[exists ? 'ifExists' : 'ifNotExists']?.before?.(cachedPath)
    if (!exists) await gitly(repo, cachedPath, options)
    if (exists) options[exists ? 'ifExists' : 'ifNotExists']?.after?.(cachedPath)
    return {
        cachedPath,
        fromCache(...path: string[]) {
            return join(cachedPath, ...path)
        },
    }
}
