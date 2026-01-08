import * as vscode from 'vscode'
import { getContext } from '../utils/state'

export class MagikClassBrowser implements vscode.WebviewViewProvider {
    context: vscode.ExtensionContext
    view?: vscode.WebviewView
    searchParameters = {
        class: '',
        method: '',
        local: false,
        args: false,
        comments: false
    }

    constructor() {
        this.context = getContext()
        this.enableCommands()   
    }

    private enableCommands() {
        this.context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('magik-vs-code.classBrowser', this),
            vscode.commands.registerCommand('magik-vs-code.showClassBrowser', this.show, this),
            vscode.commands.registerCommand('magik-vs-code.searchClassBrowser', this.search, this)
        )
    }

    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
        this.view = webviewView
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        }
        webviewView.webview.html = this.htmlForWebview(webviewView.webview)

        webviewView.webview.onDidReceiveMessage(message => {
            let name

            switch(message.type) {
                case 'ready':
                    webviewView.webview.postMessage({
                        type: 'enableSearch',
                        enabled: true
                    })
                    // TODO: start/connect to class browser process 
                    break     
                case 'textfield': 
                    name = message.name as 'class' | 'method'
                    this.searchParameters[name] = message.value
                    webviewView.webview.postMessage({
                        type: 'updateTextfield',
                        name,
                        value: message.value
                    })
                    this.search()
                    break           
                case 'button':
                    name = message.name as 'local' | 'args' | 'comments' | 'connect'
                    if(name === 'connect') {
                        break
                    }
                    this.searchParameters[name] = !this.searchParameters[name]
                    webviewView.webview.postMessage({
                        type: 'updateButton',
                        name,
                        selected: this.searchParameters[name]
                    })
                    break
            }
        })
    }

    show() {
        this.view?.show(false)
        this.focus()
    }

    focus(input?: 'class' | 'method') {
        this.view?.webview.postMessage({
            type: 'focus',
            input
        })
    }

    search() {
        console.log('Searching with params', this.searchParameters)
    }

    private htmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src/webviews/class_browser/main.js'))
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src/webviews/class_browser/reset.css'))
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src/webviews/class_browser/vscode.css'))
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src/webviews/class_browser/main.css'))
        const iconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules/@vscode/codicons/dist/codicon.css'))
        const fontUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules/@vscode/codicons/dist/codicon.ttf'))
        /*html*/
        return `
        <!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

                <meta font-src ${webview.cspSource} ${iconsUri}; style-src ${webview.cspSource} ${fontUri};>

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

                <link href="${styleResetUri}" rel="stylesheet"/>
				<link href="${styleVSCodeUri}" rel="stylesheet"/>
				<link href="${styleUri}" rel="stylesheet"/>

				<title>Magik Class Browser</title>
			</head>
			<body>
				<div class="search-container">
                    <input id="classInput" name="class" class="search-input" placeholder="Class name" disabled/>
                    <input id="methodInput" name="method" class="search-input" placeholder="Method name" disabled/>
                    <button id="localButton" name="local" class="info-button" disabled>Local</button>
                    <button id="argsButton" name="args" class="info-button" disabled>Args</button>
                    <button id="commentsButton" name="comments" class="info-button" disabled>Comments</button>
                </div>
                <div>
                    <span class="results-length"></span>
                </div>
				<ul class="results-list">
				</ul>
                <script src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}