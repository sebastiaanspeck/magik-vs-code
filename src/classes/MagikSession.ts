import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { magikNotebookController } from '../extension'
import * as vscode from 'vscode'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { Style } from '../enums/Style'
import { Regex } from '../enums/Regex'
import { getContext } from '../utils/state'
import { MagikCodeLensProvider } from './MagikCodeLensProvider'

export class MagikSession {
    gisVersionPath: string
    gisAliasPath: string
    gisAliasName: string
    environmentPath: string | undefined
    process!: ChildProcessWithoutNullStreams
    notebook!: vscode.NotebookDocument
    lastExecutedCell: vscode.NotebookCell | undefined

    constructor(gisVersionPath: string, gisAliasPath: string, gisAliasName: string, environmentPath?: string) {
        this.gisVersionPath = gisVersionPath
        this.gisAliasPath = gisAliasPath
        this.gisAliasName = gisAliasName
        this.environmentPath = environmentPath
        this.startSession()
        this.openNotebook()
        this.enableCommands()
    } 

    private startSession() {
        const runaliasPath = `${this.gisVersionPath}\\bin\\x86\\runalias.exe`
        const runaliasArgs = ['-a', this.gisAliasPath]
        if(this.environmentPath) {
            runaliasArgs.push('-e', this.environmentPath)
        }
        runaliasArgs.push(this.gisAliasName)

        const startSessionCommand = `${runaliasPath} ${runaliasArgs.join(' ')}`
        this.process = spawn(startSessionCommand, {
            shell: true
        })
    }

    private async openNotebook() {
        this.notebook = await vscode.workspace.openNotebookDocument(magikNotebookController.notebookType)
        await vscode.window.showNotebookDocument(this.notebook)
        await vscode.commands.executeCommand('notebook.cell.execute', {
            ranges: [new vscode.NotebookRange(0, 1)],
            document: this.notebook.uri
        })
    }

    private enableCommands() {
        const context = getContext()
        context.subscriptions.push(
            vscode.commands.registerCommand('magik-vs-code.sendSectionToSession', this.sendSection, this),
            vscode.languages.registerCodeLensProvider({
                scheme: 'file',
                language: 'magik'
            }, new MagikCodeLensProvider()
        ))
    }

    async sendSection(range: vscode.Range) {
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
        await this.send(`load_file("${tempFilePath}")`)
    
        vscode.window.showInformationMessage('Successfully sent to session')
    }

    async send(text: string, cell?: vscode.NotebookCell): Promise<void> {
        return new Promise((resolve, reject) => {
            this.lastExecutedCell = cell ?? this.lastExecutedCell
            const execution = magikNotebookController.createNotebookCellExecution(cell ?? this.lastExecutedCell!)
            execution.start(Date.now())

            this.process.stdin.write(`${text}\r`)

            const onSessionOutput = async(chunk: Buffer) => {
                const lines = chunk.toString().split('\r\n')
                lines.forEach(async line => {
                    await this.processLine(line, execution)
        
                    if(line.startsWith('Magik>')) {
                        this.appendToNotebook('\n', execution)
                        this.process.stdout.off('data', onSessionOutput)
                        execution.end(true, Date.now())
                        resolve()
                    }
                });
            }

            this.process.stdout.on('data', onSessionOutput)
        })
    }

    async processLine(line: string, execution: vscode.NotebookCellExecution) {
        const trimmed = line.trim()
    
        if(['Magik>', '.', 'True 0'].includes(trimmed) || trimmed.startsWith('Loading ')) { return }
    
        const globalCreationMatch = trimmed.match(Regex.GlobalCreationPrompt)
        if(globalCreationMatch) {
            const selected = await vscode.window.showQuickPick(['Yes', 'No'], {
                title: globalCreationMatch[1]
            })
            
            return this.process.stdin.write(`${selected === 'Yes' ? 'y' : 'n'}\r\n`)
        }
    
        line = line.replaceAll(Regex.Error, error => applyStyle(error, Style.Red, Style.Underline))

        line = line.replaceAll(Regex.Traceback, traceback => applyStyle(traceback, Style.Red))
    
        line = line.replaceAll(Regex.Global, global => applyStyle(global, Style.Green))
    
        line = line.replaceAll(Regex.String, string => applyStyle(string, Style.Yellow))
    
        line = line.replaceAll(Regex.Apropos, (_, type: string, name: string, className: string) => {		
            const styledName = name
                .replace(/^[a-z0-9_?!\[\]]*/gi, name => applyStyle(name, Style.Yellow))
                .replace(' optional ', applyStyle(' optional ', Style.Cyan))
                .replace(' gather ', applyStyle(' gather ', Style.Cyan))
    
            return `${applyStyle(type, type === 'CORRUPT' ? Style.Red : Style.Blue)} ${styledName} ${applyStyle('in', Style.Grey)} ${applyStyle(className, Style.Green)}`
        })
    
        line = line.replaceAll(Regex.TracebackPath, tracebackPath => applyStyle(tracebackPath, Style.Grey))
    
        line = line.replaceAll(Regex.Todo, todo => applyStyle(todo, Style.Red))
    
        this.appendToNotebook(line, execution)
    }

    private appendToNotebook(line: string, execution: vscode.NotebookCellExecution) {
        execution.appendOutput([
            new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.stdout(line)])
        ])
    }
}

export function applyStyle(text: string, ...styleCodes: number[]) {
	return `\x1b[${Style.Reset}m\x1b[${styleCodes.join(';')}m${text}\x1b[${Style.Reset}m`
}