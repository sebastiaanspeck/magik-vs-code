export class Regex {
	public static readonly Apropos = /(method|iter method|class constant|class variable|CORRUPT) ([\w?!(), <^\[\]]*?) in ([\w?]*)/gi
	public static readonly Error = /^\*\*\*\* error.*/gi
	public static readonly Warning = /^\*\*\*\* warning.*/gi
	public static readonly Global = /![\w?]*?!/g
	public static readonly GlobalCreationPrompt = /^(Global .* does not exist: create it\?) \(Y\)$/
	public static readonly String = /\".*?\"/g
	public static readonly Todo = /todo/gi
	public static readonly Traceback = /^---- traceback.*/gi
	public static readonly TracebackPath = /\(\s*[^()]+\s*:\s*\d+\s*\)/g
	public static readonly Method = /^(_private\s*)?_method\s*[\w?]+\..*/
	public static readonly DefSlottedExemplar = /^def_slotted_exemplar\((:[\w?]+),/
	public static readonly DefineSlotAccess = /[\w?]+.define_slot_access\(:[\w?]+,\s*:(readable|read|writable|write)(,\s*(:public|:private|:read_only|_true|_false))?(,\s*:[\w?]+)?\)/
	public static readonly DefineSharedConstant = /^[\w?]+.define_shared_constant\(:[\w?]+,/
	public static readonly DefineSharedVariable = /^[\w?]+.define_shared_variable\(:[\w?]+,/
	public static readonly Constant = /^(_global\s*)?_constant/
	public static readonly ClassBrowser = {
		Topic: /^\x14.*/,
		Method: /^([\w?!(),<^\[\]]*) *IN *([\w?!]*):?([\w?!]*) *(A|B|Restr)? ?(S)? ?(Depr|Debug)? ?(iter)? ?(private)? ?(classvar|classconst)? ?(.+)?/,
		Comment: /\s*##.*/,
		Total: /^>?\d+$/,
		Info: /\s*\*\*\* .*/,
		Arguments: /^(.*?)(?:\s*OPT\s*(.*?))?(?:\s*GATH\s*(.*?))?$/
	} as const
}