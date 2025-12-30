import * as vscode from 'vscode'

import { setContext } from './state'
import { MagikCodeLensProvider } from './classes/MagikCodeLensProvider'
import { showGisAliasPicker, showGisVersionPicker, showLayeredProductPicker } from './user_interface'
import { pingSession, sendSectionToSession, sendToSession } from './magik_session'

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
			new vscode.NotebookCellData(vscode.NotebookCellKind.Code, '', 'magik')
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

export const magikNotebookController = vscode.notebooks.createNotebookController('magik-notebook-kernel', 'magik-notebook', "Magik Notebook Kernel")
magikNotebookController.executeHandler = async (cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) => {
	for(const cell of cells) {
		const execution = controller.createNotebookCellExecution(cell)
		execution.start(Date.now())
		await sendToSession(cell.document.getText(), execution)

		execution.end(true, Date.now())

		if (cell.index === notebook.cellCount - 1) {
			const newCell = new vscode.NotebookCellData(vscode.NotebookCellKind.Code, cell.document.getText(), 'magik')
			const edit = new vscode.WorkspaceEdit()
			edit.set(notebook.uri, [
				vscode.NotebookEdit.insertCells(notebook.cellCount, [newCell])
			])
			await vscode.workspace.applyEdit(edit)
			await vscode.commands.executeCommand('notebook.focusBottom')
			await vscode.commands.executeCommand('notebook.cell.edit')
		}
	}
}