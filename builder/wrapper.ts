import * as vscode from 'vscode'

// actual code for every extension
export const activate = context => {
    const originalExtension = vscode.extensions.getExtension('ORIGINAL_EXTENSION_ID')
    // TODO wether to check isActive
    if (originalExtension) {
        void vscode.window.showErrorMessage('Disable original version in order this extension to work.')
        return
    }
    //INJECT_CODE
    require('ORIGINAL_ENTRYPOINT')
}
