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

    console.log(extensionCtx.globalStorageUri.fsPath)

    // monkeyPatch.exports.contribute(getExtensionId(true), {
    //     folderMap: {
    //         'my-custom-modules': join(extensionCtx.extensionPath, 'custom-modules'),
    //     },
    //     browserModules: ['my-custom-modules/browser1'],
    //     mainProcessModules: ['my-custom-modules/mainProcess1'],
    // })
}
