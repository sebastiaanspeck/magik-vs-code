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
	const runaliasArgs = ['-a', gisAliasPath]
	if(environmentPath) {
		runaliasArgs.push('-e', environmentPath)
	}
	runaliasArgs.push(gisAliasName)

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

	vscode.window.showInformationMessage('Successfully sent to session')
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
	
	if(['Magik>', '.', 'True 0'].includes(trimmed) || trimmed.startsWith('Loading ')) { return }

	const globalCreationMatch = trimmed.match(REGEX.GLOBAL_CREATION_PROMPT)
	if(globalCreationMatch) {
		const selected = await vscode.window.showQuickPick(['Yes', 'No'], {
			title: globalCreationMatch[1]
		})
		
		return magikSessionProcess.stdin.write(`${selected === 'Yes' ? 'y' : 'n'}\r\n`)
	}

	line = line.replace(REGEX.ERROR, error => style(error, RED, UNDERLINE))

	line = line.replace(REGEX.TRACEBACK, traceback => style(traceback, RED))

	line = line.replaceAll(REGEX.GLOBAL, global => style(global, GREEN))

	line = line.replaceAll(REGEX.STRING, string => style(string, YELLOW))

	line = line.replace(REGEX.APROPOS, (_, type: string, name: string, className: string) => {		
		const styledName = name
			.replace(/^[a-z0-9_?!\[\]]*/gi, name => style(name, YELLOW))
			.replace(' optional ', style(' optional ', CYAN))
			.replace(' gather ', style(' gather ', CYAN))

		return `${style(type, type === 'CORRUPT' ? RED : BLUE)} ${styledName} ${style('in', GREY)} ${style(className, GREEN)}`
	})

	line = line.replaceAll(REGEX.TRACEBACK_PATH, tracebackPath => style(tracebackPath, GREY))

	line = line.replaceAll(REGEX.TODO, todo => style(todo, RED))

	magikSessionAppendOutput(line, execution)
}

function magikSessionAppendOutput(line: string, execution: vscode.NotebookCellExecution) {
	execution.appendOutput([
		new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.stdout(line)])
	])
}

const UNDERLINE = 4
const RED = 31
const GREEN = 32
const YELLOW = 33
const BLUE = 34
const CYAN = 36
const GREY = 90

const REGEX = {
	APROPOS: /(method|iter method|class constant|class variable|CORRUPT) ([a-z0-9_?!(), <^\[\]]*?) in ([a-z0-9_]*)/gi,
	ERROR: /^\*\*\*\* Error.*/g,
	GLOBAL: /![a-z0-9_?]*?!/gi,
	GLOBAL_CREATION_PROMPT: /^(Global .* does not exist: create it\?) \(Y\)$/,
	STRING: /\".*?\"/g,
	TODO: /todo/gi,
	TRACEBACK: /^---- Traceback.*/g,
	TRACEBACK_PATH: /\(\s*[^()]+\s*:\s*\d+\s*\)/g
}

function style(text: string, ...styleCodes: number[]) {
	return `\x1b[${styleCodes.join(';')}m${text}\x1b[0m`
}