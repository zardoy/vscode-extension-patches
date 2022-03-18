/* eslint-disable unicorn/no-abusive-eslint-disable */
/* eslint-disable */
import * as vscode from 'vscode'

declare const __ORIGINAL_EXTENSION_ID__: string
declare const __INJECT__ENTRYPOINT__: string
declare const __ORIGINAL_ENTRYPOINT__: string

// actual code for every extension
export const activate = context => {
    const originalExtension = vscode.extensions.getExtension(__ORIGINAL_EXTENSION_ID__)
    // TODO wether to check isActive
    if (originalExtension) {
        void vscode.window.showErrorMessage('Disable original version in order this extension to work.')
        return
    }

    __INJECT__ENTRYPOINT__ && require(__INJECT__ENTRYPOINT__)
    require(__ORIGINAL_ENTRYPOINT__)
}
