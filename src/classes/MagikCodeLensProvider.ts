import * as vscode from 'vscode'
import { Regex } from '../enums/Regex'

export class MagikCodeLensProvider implements vscode.CodeLensProvider {
    codeLenses: vscode.CodeLens[] = []

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        this.codeLenses = []

        this.codeLenses.push(
            new vscode.CodeLens(new vscode.Range(0,0,0,0), {
                title: 'Send File to Session',
                tooltip: 'Send entire file to the Magik session',
                command: 'magik-vs-code.sendFileToSession'
            })
        )

        const lines = document.getText().split('\n')
        lines.forEach((line, index) => {
            if(!isSectionStart(line)) {
                return
            }

            const relativeEndIndex = lines.slice(index).findIndex(nextLine => nextLine.trim() === '$')
            if(!relativeEndIndex) { 
                return 
            }
            
            const endIndex = relativeEndIndex + index
            const endline = lines[endIndex]
            const startIndex = index !== 0 && lines[index - 1].startsWith('_pragma') ? index - 1 : index
            const range = new vscode.Range(new vscode.Position(startIndex, 0), new vscode.Position(endIndex, 1))

            this.codeLenses.push(
                new vscode.CodeLens(new vscode.Range(startIndex, 0, endIndex, endline.length), {
                        title: 'Send to Session',
                        tooltip: 'Send this section to the Magik session',
                        command: 'magik-vs-code.sendSectionToSession',
                        arguments: [range]
                    })
            )

            const defSlottedExemplarMatch = line.match(Regex.Code.DefSlottedExemplar)
            if(defSlottedExemplarMatch) {
                const exemplarName = defSlottedExemplarMatch[1]
                this.codeLenses.push(
                    new vscode.CodeLens(new vscode.Range(startIndex, 0, startIndex, line.length), {
                        title: 'Remove Exemplar',
                        tooltip: `Remove exemplar from session, shortcut for remex(${exemplarName})`,
                        command: 'magik-vs-code.removeExemplar',
                        arguments: [exemplarName]
                    })
                )
            }
        })

        return this.codeLenses
    }
}

function isSectionStart(line: string) {
    return [
        Regex.Code.DefSlottedExemplar,
        Regex.Code.DefineSlotAccess,
        Regex.Code.Method,
        Regex.Code.Constant,
        Regex.Code.DefineSharedConstant,
        Regex.Code.DefineSharedVariable
    ].some(regex => regex.test(line))
}