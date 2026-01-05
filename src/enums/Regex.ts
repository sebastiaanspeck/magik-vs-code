export class Regex {
	public static readonly Apropos = /(method|iter method|class constant|class variable|CORRUPT) ([a-z0-9_?!(), <^\[\]]*?) in ([a-z0-9_]*)/gi
	public static readonly Error = /^\*\*\*\* error.*/gi
	public static readonly Global = /![a-z0-9_?]*?!/gi
	public static readonly GlobalCreationPrompt = /^(Global .* does not exist: create it\?) \(Y\)$/
	public static readonly String = /\".*?\"/g
	public static readonly Todo = /todo/gi
	public static readonly Traceback = /^---- traceback.*/gi
	public static readonly TracebackPath = /\(\s*[^()]+\s*:\s*\d+\s*\)/g
}