import { Regex } from "../enums/Regex"

export class MagikClassBrowserMethod {
    method: string
    package: string
    class: string
    level?: MethodClassifyLevel
    isSubclassable: boolean
    isPrivate: boolean
    type?: MethodType
    topics: string[]
    comments: string[] = []
    arguments = {
        required: [] as string[],
        optional: [] as string[],
        gather: undefined as string | undefined
    }

    constructor(rawMethod: string) {
        const parsed = Regex.ClassBrowser.Method.exec(rawMethod)!
        this.method = parsed[1]
        this.package = parsed[2]
        this.class = parsed[3]
        this.level = parsed[4] as MethodClassifyLevel ?? parsed[6] as MethodClassifyLevel
        this.isSubclassable = parsed[5] === 'S'
        this.isPrivate = parsed[7] === 'private'
        this.type = parsed[8] as MethodType
        this.topics = parsed[9]?.trim().split(' ') ?? []
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

type MethodClassifyLevel = 'A' | 'B' | 'Restr' | 'Depr' | 'Debug'
type MethodType = 'classvar' | 'classconst'