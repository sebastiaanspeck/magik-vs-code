import { Regex } from "../enums/Regex"

export class MagikClassBrowserMethod {
    package: string
    class: string
    method: string
    level?: 'advanced' | 'basic' | 'restricted' | 'deprecated' | 'debug'
    type: 'method' | 'variable' | 'constant'
    isPrivate: boolean
    isSubclassable: boolean
    isIterator: boolean
    topics: string[]
    comments: string[] = []
    arguments = {
        required: [] as string[],
        optional: [] as string[],
        gather: undefined as string | undefined
    }
    raw: string

    constructor(rawMethod: string) {
        this.raw = rawMethod
        const parsed = Regex.ClassBrowser.Method.exec(rawMethod)!
        this.method = parsed[1]
        this.package = parsed[2]
        this.class = parsed[3]
        this.isSubclassable = parsed[5] === 'S'
        this.isIterator = parsed[7] === 'iter'
        this.isPrivate = parsed[8] === 'private'
        this.topics = parsed[10]?.trim().split(' ') ?? []
        switch(parsed[4] ?? parsed[6]) {
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
        switch(parsed[9]) {
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
        this.comments.push(rawComment)
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