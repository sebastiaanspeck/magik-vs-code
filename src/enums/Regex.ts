export class Regex {
	public static readonly Session = {
		Apropos: /(method|iter method|class constant|class variable|CORRUPT) ([\w?!(), <^\[\]]*?) in ([\w?]*)/gi,
		Error: /^\*\*\*\* error.*/gi,
		Warning: /^\*\*\*\* warning.*/gi,
		Global: /![\w?]*?!/g,
		GlobalCreationPrompt: /^(Global .* does not exist: create it\?) \(Y\)$/,
		String: /\".*?\"/g,
		Todo: /todo/gi,
		Traceback: /^---- traceback.*/gi,
		TracebackPath: /\(\s*[^()]+\s*:\s*\d+\s*\)/g
	} as const
	public static readonly ClassBrowser = {
		Topic: /^\x14(?<topic>.*)/,
		Method: /^(?<method>[\w?!(),<^\[\]]+) *IN *(?<package>[\w?!]+)?:?(?<class><?[\w?!]+>?) *(?<level1>A|B|Restr)? ?(?<subclassable>S)? ?(?<redefinable>Redef)? ?(?<level2>Depr|Debug)? ?(?<iterator>iter)? ?(?<private>private)? ?(?<type>classvar|classconst)? ?(?<topics>.+)?/,
		Comment: /\s*##.*/,
		ParameterComment: /^@param +{*(?<class>.*)?} +(?<parameter>[\w?!]*) *(?<description>[^\s].*)?/,
		ReturnComment: /^@return +{*(?<class>.*)?} *(?<description>[^\s].*)?/,
		Total: /^>?\d+$/,
		Info: /\s*\*\*\* .*/,
		Arguments: /^(?<required>.*?)(?:\s*OPT\s*(?<optional>.*?))?(?:\s*GATH\s*(?<gather>.*?))?$/,
		MethodResource: /^(?<path>[\w:$\/\\.]*.magik) (?<method>[\w?!(),<^\[\]]+) (?<package>[\w?!]+)?:?(?<class><?[\w?!]+>?)/
	} as const
}