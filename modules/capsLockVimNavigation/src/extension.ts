/// <reference types="vscode-framework" />
import { join } from 'path'
import * as vscode from 'vscode'
import { extensionCtx, getExtensionId } from 'vscode-framework'

export const activate = async () => {
    const monkeyPatch = vscode.extensions.getExtension('iocave.monkey-patch')

    await monkeyPatch?.activate()

    if (monkeyPatch === undefined) {
        void vscode.window.showWarningMessage('Monkey Patch extension is not installed. This patch will not work.')
        return
    }

    console.log('suggested copy:', extensionCtx.globalStoragePath)

    monkeyPatch.exports.contribute(getExtensionId(true), {
        folderMap: {
            'capslock-vim-patch': join(extensionCtx.extensionPath, ''),
        },
        browserModules: ['capslock-vim-patch/browser-patch'],
        mainProcessModules: [],
    })
}
