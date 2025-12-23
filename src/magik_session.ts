import * as vscode from 'vscode'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getState, setState } from './state'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { magikNotebookController } from './extension'

let magikSessionProcess: ChildProcessWithoutNullStreams

const config = vscode.workspace.getConfiguration('magik-vs-code')

export function pingSession() {
	magikSessionProcess.stdin.write('write("Pinging...")\r')
}

export async function startMagikSession(gisVersionPath: string, gisAliasPath: string, gisAliasName: string, environmentPath?: string) {
	const runaliasPath = `${gisVersionPath}\\bin\\x86\\runalias.exe`
	const runaliasArgs = ['-a', `${gisAliasPath}`, `${gisAliasName}`]
	if(environmentPath) {
		runaliasArgs.push('-e', environmentPath)
	}

	const startSessionCommand = `${runaliasPath} ${runaliasArgs.join(' ')}`

	magikSessionProcess = spawn(startSessionCommand, {
		shell: true
	})
	
	const magikSessionNotebook = await vscode.workspace.openNotebookDocument(magikNotebookController.notebookType)
	await vscode.window.showNotebookDocument(magikSessionNotebook)
	await vscode.commands.executeCommand('notebook.cell.execute', {
		ranges: [new vscode.NotebookRange(0, 1)],
		document: magikSessionNotebook.uri
	})
}

export async function sendSectionToSession(range: vscode.Range) {
	if(range === undefined) {
		return
	}

	const editor = vscode.window.activeTextEditor
	if(!editor) {
		return 
	}

	const text = editor.document.getText(range)
	const tempFilePath = path.join(os.tmpdir(), 'sessionBuffer.magik')
	fs.writeFileSync(tempFilePath, text, { encoding: 'utf8' })
	await sendToSession(`load_file("${tempFilePath}")`)

	vscode.window.showInformationMessage('Successfully sent to buffer')
}

export async function sendToSession(text: string, execution?: vscode.NotebookCellExecution): Promise<void>{
	return new Promise((resolve, reject) => {
		magikSessionProcess.stdin.write(`${text}\r`)

		const onStdout = async(chunk: Buffer) => {
			const lines = chunk.toString().split('\r\n')
			lines.forEach(async line => {
				await handleSessionLine(line, execution!)
	
				if(line.startsWith('Magik>')) {
					magikSessionAppendOutput('\n', execution!)
					magikSessionProcess.stdout.off('data', onStdout)
					resolve()
				}
			});
		}

		if(!execution) {
			resolve()
		}
		else {
			magikSessionProcess.stdout.on('data', onStdout)
		}
	})
}

async function handleSessionLine(line: string, execution: vscode.NotebookCellExecution) {
	const trimmed = line.trim()
	if(
		trimmed === 'Magik>' ||
		trimmed === '.' ||
		trimmed === 'True 0' ||
		trimmed.startsWith('Loading ') 
	) {
		return
	}

	if(trimmed.startsWith('Global ') && trimmed.endsWith(' does not exist: create it? (Y)')) {
		const selected = await vscode.window.showQuickPick(['Yes', 'No'], {
			title: trimmed.replace('(Y)', '')
		})
		
		return magikSessionProcess.stdin.write(`${selected === 'Yes' ? 'y' : 'n'}\r\n`)
	}

	if(trimmed.startsWith('**** Error')) {
		line = `\x1b[31;4m${line}\x1b[0m`
	}
	
	if(trimmed.startsWith("---- traceback")) {
		line = `\x1b[31m${line}\x1b[0m`
	}

	// Globals
	line = line.replaceAll(/![a-z0-9_?]*?!/gi, substring => `\x1b[32m${substring}\x1b[0m`)

	// Strings
	line = line.replaceAll(/\".*?\"/g, substring => `\x1b[33m${substring}\x1b[0m`)

	const filepathRegex = /\(\s*[^()]+\s*:\s*\d+\s*\)/g
	line = line.replaceAll(filepathRegex, substring => `\x1b[90m${substring}\x1b[0m`)

	const todoRegex = /todo/ig
	line = line.replaceAll(todoRegex, substring => `\x1b[31m${substring}\x1b[0m`)

	magikSessionAppendOutput(line, execution)
}

function magikSessionAppendOutput(line: string, execution: vscode.NotebookCellExecution) {
	execution.appendOutput([
		new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.stdout(line)])
	])
}