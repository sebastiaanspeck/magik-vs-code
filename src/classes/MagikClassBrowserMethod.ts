import { Regex } from "../enums/Regex"

export class MagikClassBrowserMethod {
    package?: string
    class: string
    method: string
    level?: 'advanced' | 'basic' | 'restricted' | 'deprecated' | 'debug'
    type: 'method' | 'variable' | 'constant'
    isPrivate: boolean
    isSubclassable: boolean
    isRedefinable: boolean
    isIterator: boolean
    topics: string[]
    comments: Comment[] = []
    arguments = {
        required: [] as string[],
        optional: [] as string[],
        gather: undefined as string | undefined
    }
    raw: string

    constructor(rawMethod: string) {
        this.raw = rawMethod
        const methodMatch = Regex.ClassBrowser.Method.exec(rawMethod)!
        this.method = methodMatch[1]
        this.package = methodMatch[2]
        this.class = methodMatch[3]
        this.isSubclassable = methodMatch[5] === 'S'
        this.isRedefinable = methodMatch[6] === 'Redef'
        this.isIterator = methodMatch[8] === 'iter'
        this.isPrivate = methodMatch[9] === 'private'
        this.topics = methodMatch[11]?.trim().split(' ') ?? []
        switch(methodMatch[4] ?? methodMatch[7]) {
            case 'A':
                this.level = 'advanced'
                break
            case 'B':
                this.level = 'basic'
                break
            case 'Restr':
                this.level = 'restricted'
                break
            case 'Depr':
                this.level = 'deprecated'
                break
            case 'Debug':
                this.level = 'debug'
                break
        }
        switch(methodMatch[10]) {
            case 'classvar':
                this.type = 'variable'
                break
            case 'classconst':
                this.type = 'constant'
                break
            default:
                this.type = 'method'
        }
    }

    appendComment(rawComment: string) {
        const comment = rawComment.replace('##', '').trim()
        
        const parameterCommentMatch = Regex.ClassBrowser.ParameterComment.exec(comment)
        if(parameterCommentMatch) {
            this.comments.push({
                type: 'parameter',
                class: parameterCommentMatch[1],
                parameter: parameterCommentMatch[2],
                description: parameterCommentMatch[3]
            })
            return 
        }
        
        const returnCommentMatch = Regex.ClassBrowser.ReturnComment.exec(comment)
        if(returnCommentMatch) {
            this.comments.push({
                type: 'return',
                class: returnCommentMatch[1],
                description: returnCommentMatch[2]
            })
            return
        }

        // If none of the above, regard as text regular text comment
        this.comments.push({
            type: "text",
            text: comment
        })
    }

    setArguments(rawArguments: string) {
        const [_, rawRequired, rawOptional, gather] = Regex.ClassBrowser.Arguments.exec(rawArguments.trim())!
        if(rawRequired) {
            this.arguments.required = rawRequired.split(' ')
        }
        if(rawOptional) {
            this.arguments.optional = rawOptional.split(' ')
        }
        this.arguments.gather = gather
    }
}

type Comment = TextComment | ParameterComment | ReturnComment

type TextComment = {
    type: 'text',
    text: string
}

type ParameterComment = {
    type: 'parameter',
    class: string,
    parameter: string,
    description?: string
}

type ReturnComment = {
    type: 'return'
    class: string,
    description?: string
}