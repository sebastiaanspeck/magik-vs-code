import * as vscode from 'vscode'

import { getState, setContext } from './state'
import { MagikCodeLensProvider } from './classes/MagikCodeLensProvider'
import { showGisAliasPicker, showGisVersionPicker, showLayeredProductPicker } from './user_interface'
import { pingSession, sendSectionToSession, sendToSession } from './magik_session'
import { ChildProcessWithoutNullStreams } from 'child_process'

export function activate(context: vscode.ExtensionContext) {
	setContext(context)
	registerDisposables(context)
}

export function deactivate() {
	// const magikSessionProcess = getState<ChildProcessWithoutNullStreams>("MAGIK_SESSION_PROCESS")
	// if (magikSessionProcess) {
	// 	magikSessionProcess.kill()
	// }
}

function registerDisposables(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.workspace.registerNotebookSerializer('magik-notebook', new MagikNotebookSerializer()),
		magikNotebookController,
		vscode.commands.registerCommand('magik-vs-code.startSession', showGisVersionPicker),
		vscode.commands.registerCommand('magik-vs-code.pingSession', pingSession),
		vscode.commands.registerCommand('magik-vs-code.selectLayeredProduct', showLayeredProductPicker),
		vscode.commands.registerCommand('magik-vs-code.selectGisAlias', showGisAliasPicker),
		// TODO: maybe use registerTextEditorCommand
		vscode.commands.registerCommand('magik-vs-code.sendSectionToSession', sendSectionToSession),
		vscode.languages.registerCodeLensProvider({
			scheme: 'file',
			language: 'magik'
		}, new MagikCodeLensProvider())
	)
}

class MagikNotebookSerializer implements vscode.NotebookSerializer {
	async deserializeNotebook(
		content: Uint8Array,
		_token: vscode.CancellationToken
	): Promise<vscode.NotebookData> {
		// TODO: Deserialize instead of creating new empty Magik notebook
		return new vscode.NotebookData([
			new vscode.NotebookCellData(vscode.NotebookCellKind.Code, [
				'_block',
				'\twrite("Hello (Small)world!")',
				'_endblock'
			].join('\n'), 'magik')
		]);
	}

	async serializeNotebook(
		data: vscode.NotebookData,
		_token: vscode.CancellationToken
	): Promise<Uint8Array> {
		// TODO: Serialize instead of just saving an empty string
		return new TextEncoder().encode('');
	}
}

const magikNotebookController = vscode.notebooks.createNotebookController('magik-notebook-kernel', 'magik-notebook', "Magik Notebook Kernel")
magikNotebookController.executeHandler = async (cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) => {
	cells.forEach(async cell => {
		const execution = magikNotebookController.createNotebookCellExecution(cell)
		execution.start(Date.now())
		
		const cellOutput = await sendToSession(cell.document.getText(), true)
		
		execution.replaceOutput([
			new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.text(cellOutput)])
		])

		execution.end(true, Date.now())
	})
}