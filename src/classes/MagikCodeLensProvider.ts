import * as vscode from 'vscode'

export class MagikCodeLensProvider implements vscode.CodeLensProvider {
    codeLenses: vscode.CodeLens[] = []

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        this.codeLenses = []

        this.codeLenses.push(
            new vscode.CodeLens(new vscode.Range(0,0,0,0), {
                title: 'Send File to Session',
                tooltip: 'Send entire file to the Magik session',
                command: 'magik-vs-code.sendFileToSession'
            })
        )
        const lines = document.getText().split('\n')

        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri)
        symbols.forEach(symbol => {
            // Avoid duplicate code lenses (e.g. for shared variables)
            if(this.codeLenses.some(codeLens => codeLens.range.contains(symbol.range))) {
                return
            }
            const symbolStartIndex = symbol.range.start.line
            const linesFromSymbolReversed = lines.slice(0, symbolStartIndex).reverse()
            const distanceToPragma = linesFromSymbolReversed.slice(0, linesFromSymbolReversed.findIndex(line => line.trim() === '$')).findIndex(line => line.startsWith('_pragma'))

            const startIndex = distanceToPragma >= 0 ? symbolStartIndex - distanceToPragma - 1 : symbolStartIndex
            const endIndex = lines.slice(symbolStartIndex).findIndex(line => line.trim() === '$') + symbolStartIndex
            const range = new vscode.Range(startIndex, 0, endIndex, 1)

            this.codeLenses.push(
                new vscode.CodeLens(range, {
                        title: 'Send to Session',
                        tooltip: 'Send this section to the Magik session',
                        command: 'magik-vs-code.sendSectionToSession',
                        arguments: [range]
                    })
            )

            if(symbol.kind === vscode.SymbolKind.Class) {
                const className = symbol.name.slice(symbol.name.indexOf(':'))
                this.codeLenses.push(
                    new vscode.CodeLens(new vscode.Range(startIndex, 0, startIndex, 0), {
                        title: 'Remove Exemplar',
                        tooltip: `Remove exemplar from session, shortcut for remex(${className})`,
                        command: 'magik-vs-code.removeExemplar',
                        arguments: [className]
                    })
                )
            }
        })

        return this.codeLenses
    }
}
