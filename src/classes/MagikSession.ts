import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { magikNotebookController, setMagikSession } from '../extension'
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
    codeLensProvider!: MagikCodeLensProvider

    constructor(gisVersionPath: string, gisAliasPath: string, gisAliasName: string, environmentPath?: string) {
        this.gisVersionPath = gisVersionPath
        this.gisAliasPath = gisAliasPath
        this.gisAliasName = gisAliasName
        this.environmentPath = environmentPath
        this.start()
        this.openNotebook()
        this.enableCommands()
    } 

    isActive() {
        return !this.process.killed
    }

    private start() {
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

    async kill() {
        if(!this.isActive()) {
            return vscode.window.showInformationMessage('Session has already been killed.')
        }

        const shouldKillProcess = await vscode.window.showQuickPick(['Yes', 'No'], {
            title: 'Kill the Magik process?'
        })

        if(shouldKillProcess === 'Yes') {
            this.process.kill()
        }
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
        this.codeLensProvider = new MagikCodeLensProvider()
        const context = getContext()
        context.subscriptions.push(
            vscode.commands.registerCommand('magik-vs-code.killSession', this.kill, this),
            vscode.commands.registerCommand('magik-vs-code.sendSectionToSession', this.sendSection, this),
            vscode.commands.registerTextEditorCommand('magik-vs-code.sendSectionAtCurrentPositionToSession', this.sendSectionAtCurrentPosition, this),
            vscode.commands.registerCommand('magik-vs-code.sendFileToSession', this.sendSection, this),
            vscode.commands.registerCommand('magik-vs-code.removeExemplar', this.removeExemplar, this),
            vscode.languages.registerCodeLensProvider({
                scheme: 'file',
                language: 'magik'
            }, this.codeLensProvider)
        )
    }

    async sendSectionAtCurrentPosition(editor: vscode.TextEditor) {
        const index = editor.selection.active.line
        const codeLens = this.codeLensProvider.codeLenses.find(codeLens => {
            return codeLens.range.contains(new vscode.Position(index, 0))
        })

        if(!codeLens) {
            return vscode.window.showWarningMessage('Not within range of item to send.')
        }

        await vscode.commands.executeCommand('magik-vs-code.sendSectionToSession', ...codeLens.command!.arguments ?? [])

        // DEBUG: Highlight code lens range
        // editor.setDecorations(vscode.window.createTextEditorDecorationType({
        //     backgroundColor: '#ee3355ff'
        // }), [codeLens.range])
    }

    async sendSection(range: vscode.Range) {
        const editor = vscode.window.activeTextEditor
        if(!editor) {
            return 
        }
    
        const text = editor.document.getText(range)
        const tempFilePath = path.join(os.tmpdir(), 'sessionBuffer.magik')
        fs.writeFileSync(tempFilePath, text, { encoding: 'utf8' })
        await this.send(`load_file("${tempFilePath}")`)
    }

    async removeExemplar(exemplarName: string) {
        await this.send(`remex(${exemplarName})`)
    }

    async send(text: string, cell?: vscode.NotebookCell): Promise<void> {
        return new Promise((resolve, reject) => {
            if(!this.isActive()) {
                vscode.window.showErrorMessage('Session no longer active.')
                return reject()
            }

            cell = cell ?? this.lastExecutedCell!
            const execution = magikNotebookController.createNotebookCellExecution(cell)
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

    private async processLine(line: string, execution: vscode.NotebookCellExecution) {
        const trimmed = line.trim()
    
        if(['Magik>', '.', 'True 0'].includes(trimmed) || trimmed.startsWith('Loading ')) { return }
    
        const globalCreationMatch = trimmed.match(Regex.GlobalCreationPrompt)
        if(globalCreationMatch) {
            const shouldCreateGlobal = await vscode.window.showQuickPick(['Yes', 'No'], {
                title: globalCreationMatch[1]
            })
            
            return this.process.stdin.write(`${shouldCreateGlobal === 'Yes' ? 'y' : 'n'}\r\n`)
        }
    
        line = line.replaceAll(Regex.Error, error => applyStyle(error, Style.White, Style.RedBackground))

        line = line.replaceAll(Regex.Traceback, traceback => applyStyle(traceback, Style.Red))
        
        line = line.replaceAll(Regex.Warning, warning => applyStyle(warning, Style.Black, Style.YellowBackground))

        line = line.replaceAll(Regex.Global, global => applyStyle(global, Style.Green))
    
        line = line.replaceAll(Regex.String, string => applyStyle(string, Style.Yellow))
    
        line = line.replaceAll(Regex.Apropos, (_, type: string, name: string, className: string) => {		
            const styledName = name
                .replace(/^[\w?!\[\]]*/g, name => applyStyle(name, Style.Yellow))
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