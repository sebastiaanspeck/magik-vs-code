import * as vscode from 'vscode'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getState, setState } from './state'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'

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
	
	// magikSessionProcess.stdout.on('data', (data: Buffer)=> console.log(data.toString()))
}

export function sendSectionToSession(range: vscode.Range) {
	if(range === undefined) {
		return
	}

	const editor = vscode.window.activeTextEditor
	if(!editor) {
		return 
	}

	const text = editor.document.getText(range)
	sendToSession(text)
	// const workspaceFolders = vscode.workspace.workspaceFolders
	// if (!workspaceFolders || workspaceFolders.length === 0) {
	// 	vscode.window.showErrorMessage('Unable to find workspace folder.')
	// 	return
	// }

}

export async function sendToSession(text: string, execution?: vscode.NotebookCellExecution): Promise<string>{
	return new Promise((resolve, reject) => {
		const tempFilePath = path.join(os.tmpdir(), 'sessionBuffer.magik')
		fs.writeFileSync(tempFilePath, text, { encoding: 'utf8' })
		magikSessionProcess.stdin.write(`load_file("${tempFilePath}")\r`)
	
		let output: string[] = []
	
		const onStdout = (chunk: Buffer) => {
			const line = chunk.toString()
			output.push(line)
			if(line.startsWith('Magik> ')) {
				magikSessionProcess.stdout.off('data', onStdout)

				if(config.get('sanitizeSessionOutput') as Boolean) {
					output = output.filter(line => !['Magik> ', `Loading ${tempFilePath}\r\n`, 'True 0 \r\n'].includes(line))
				}
				
				resolve(output.join(''))
			}
		}
	
		magikSessionProcess.stdout.on("data", onStdout)
	})
}