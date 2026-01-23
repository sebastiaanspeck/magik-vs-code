import { Regex } from "../enums/Regex"

export class MagikClassBrowserMethod {
    package?: string
    class: string
    method: string
    level?: 'advanced' | 'basic' | 'restricted' | 'deprecated' | 'debug'
    type: 'method' | 'variable' | 'constant'
    private: boolean
    subclassable: boolean
    redefinable: boolean
    iterator: boolean
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
        const parsedMethod = Regex.ClassBrowser.Method.exec(rawMethod)!.groups!
        this.method = parsedMethod.method
        this.package = parsedMethod.package
        this.class = parsedMethod.class
        this.subclassable = parsedMethod.subclassable === 'S'
        this.redefinable = parsedMethod.redefinable === 'Redef'
        this.iterator = parsedMethod.iterator === 'iter'
        this.private = parsedMethod.private === 'private'
        this.topics = parsedMethod.topics?.trim().split(' ') ?? []
        switch(parsedMethod.level1 ?? parsedMethod.level2) {
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
        switch(parsedMethod.type) {
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

    appendComment(rawComment: string, showArgs?: boolean) {
        const comment = rawComment.replace('##', '').trim()
        
        const parsedParameterComment = Regex.ClassBrowser.ParameterComment.exec(comment)?.groups
        if(parsedParameterComment) {
            if(showArgs === false) {
                return
            }
            this.comments.push({
                type: 'parameter',
                class: parsedParameterComment.class,
                parameter: parsedParameterComment.parameter,
                description: parsedParameterComment.description
            })
            return 
        }
        
        const parsedReturnComment = Regex.ClassBrowser.ReturnComment.exec(comment)?.groups
        if(parsedReturnComment) {
            if(showArgs === false) {
                return
            }
            this.comments.push({
                type: 'return',
                class: parsedReturnComment.class,
                description: parsedReturnComment.description
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
        const parsedArguments = Regex.ClassBrowser.Arguments.exec(rawArguments.trim())!.groups!
        if(parsedArguments.required) {
            this.arguments.required = parsedArguments.required.split(' ')
        }
        if(parsedArguments.optional) {
            this.arguments.optional = parsedArguments.optional.split(' ')
        }
        this.arguments.gather = parsedArguments.gather
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