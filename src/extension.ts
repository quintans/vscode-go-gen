// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "gog domain" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('quintans-gog.domain', () => {
		// check file is open
		var editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage("No file open")
			return;
		}

		// check we have a go file open
		if (!editor.document.fileName.endsWith(".go")) {
			vscode.window.showErrorMessage("File is not a Go file")
			return;
		}

		const name = structNameAt(editor)
		if (name === "") {
			return
		}

		// get all text in file
		var file_text = editor.document.getText()


		// look for structs
		var struct_dictionary = getStructs(file_text)
		// populate methods
		struct_dictionary = getMethods(struct_dictionary, file_text)
		const funcs = getFuncs(file_text)
		const struct = struct_dictionary.get(name)
		if (!struct) {
			return
		}
		createDomain(funcs, struct)
		editor.document.save()
	});

	context.subscriptions.push(disposable);
}

function structNameAt(editor: vscode.TextEditor): string {
	const reStructName = /type +([^ ]+) +struct {/gs;

	const position = editor?.selection.active;
	var line = editor?.document.lineAt(position.line)
	var all_matched = [...line.text.matchAll(reStructName)]
	if (all_matched.length === 0) {
		vscode.window.showErrorMessage("Cursor is not positioned in a struct definition")
		return "";
	}
	const name = all_matched[0][1];
	return name;
}

function createDomain(funcs: Map<string, Func>, struct: Struct) {
	var text = "";
	if (!funcs.has('New' + struct.name)) {
		text = text.concat(createConstructor(struct.name, struct.fields))
	}

	struct.fields.forEach(element => {
		if (!struct.methods.has(capitalize(element.name))) {
			text = text.concat(createGetter(struct, element))
		}
	});

	if (!struct.methods.has('IsZero')) {
		text = text.concat(createIsZero(struct))
	}

	if (!funcs.has('Hydrate' + struct.name)) {
		text = text.concat(createHydration(struct.name, struct.fields))
	}
	insertText(text);
}

function createConstructor(object_name: string, field_dict: Map<string, Field>) {
	var params = ""
	var inits = ""
	field_dict.forEach(element => {
		params = params.concat(element.name).concat(" ").concat(element.type).concat(", ")
		inits = inits.concat(element.name).concat(": ").concat(element.name).concat(",\n")
	});

	return `

	func New${object_name}(${params}) *${object_name} {
		return &${object_name}{
			${inits}
		}
	}`
}

function createHydration(object_name: string, field_dict: Map<string, Field>) {
	var params = ""
	var inits = ""
	field_dict.forEach(element => {
		params = params.concat(element.name).concat(" ").concat(element.type).concat(", ")
		inits = inits.concat(element.name).concat(": ").concat(element.name).concat(",\n")
	});

	return `

	func Hydrate${object_name}(${params}) *${object_name} {
		return &${object_name}{
			${inits}
		}
	}`
}

function createGetter(struct: Struct, field: Field) {
	const recv_name = first_lower(struct.name)
	return `

func (${recv_name} *${struct.name}) ${capitalize(field.name)}() ${field.type} {		
	return ${recv_name}.${field.name}
}`
}

function createIsZero(struct: Struct) {
	const recv_name = first_lower(struct.name)
	return `

func (${recv_name} *${struct.name}) IsZero() bool {
	return ${recv_name} == nil || *${recv_name} == ${struct.name}{}
}`
}

function capitalize(s: string) {
	return s.charAt(0).toUpperCase() + s.slice(1)
}

function lower_case(s: string) {
	return s.charAt(0).toLowerCase() + s.slice(1)
}

function first_lower(s: string) {
	return s.charAt(0).toLowerCase()
}

let insertText = (value: string) => {
	var editor = vscode.window.activeTextEditor;

	if (!editor) {
		vscode.window.showErrorMessage("Can't insert text, no file is open")
	}

	var snippet = new vscode.SnippetString(value)
	//editor.insertSnippet(snippet, editor.selection.end)
	editor?.insertSnippet(snippet, editor.document.positionAt(editor.document.getText().length))
}

interface Func {
	name: string;
	signature: string;
}

interface Struct {
	name: string;
	fields: Map<string, Field>;
	methods: Map<string, Method>;
}

interface Field {
	name: string;
	type: string;
}

interface Method {
	name: string;
	signature: string;
}

function getStructs(file_text: string): Map<string, Struct> {
	const regex = /type +([^ ]+) +struct {(.+?(?=}))}/gs;

	// get all structs
	var all_matched = file_text.matchAll(regex)

	var struct_dictionary = new Map<string, Struct>();

	for (const iterator of all_matched) {

		// split matched string into a list of lines
		var struct_contents_lines = iterator[2].split("\n")

		// create struct field dictionary
		var field_dict = new Map<string, Field>();

		struct_contents_lines.forEach(line => {

			if (line != "") {
				// trip whitespace
				line = line.trim()

				// get fields
				// 4 cases for fields
				// 1) Single variable per line
				// 2) Multiple variable declaration in one line
				// 3) Embedded types
				// 4) Field name is capitalized and so public -  no need for getter

				// first check for multiple variables with searching for comma
				if (line.includes(",")) {
					// split on commas and whitespace
					var split_line = line.split(/\s+/);

					// there doesn't have to be space after commas
					// the last value in this array will always be the type though
					var type = split_line[split_line.length - 1]

					// iterate over split_line up to penultimate value, split on commas, and add all to dictionary 
					for (let split_line_index = 0; split_line_index < split_line.length - 1; split_line_index++) {
						var tmp = split_line[split_line_index].split(",")
						tmp.forEach(split_by_comma_elem => {
							if (split_by_comma_elem != "") {
								// check if field is private
								if (isPrivate(split_by_comma_elem)) {
									field_dict.set(split_by_comma_elem, { name: split_by_comma_elem, type: type });
								}
							}
						});
					}
				}
				// now check for single variable with splitting on whitespace
				else if (line.split(/\s+/).length == 2) {
					var split_line = line.split(/\s+/)
					// check if private
					if (isPrivate(split_line[0])) {
						field_dict.set(split_line[0], { name: split_line[0], type: split_line[1] });
					}
				}
				// else it must be embedded type
				else {
					// don't think we do anything for this as its embedded type should provide everything
				}
			}

		});

		struct_dictionary.set(iterator[1], {
			name: iterator[1],
			fields: field_dict,
			methods: new Map<string, Method>(),
		});
	}

	return struct_dictionary
}

function getMethods(structs: Map<string, Struct>, file_text: string): Map<string, Struct> {
	const pattern = /func +\(\w +[*]?(\w+)\) +(\w+)\(.*\)/g;

	// get all methods
	var matches = file_text.matchAll(pattern)
	for (const match of matches) {
		var struct = match[1]
		var method: Method = { name: match[2], signature: match[0] }
		const s = structs.get(struct)
		s?.methods.set(method.name, method);
	}

	return structs
}

function getFuncs(file_text: string): Map<string, Func> {
	const pattern = /func +(\w+)\(.*\)/g;

	var funcs = new Map<string, Func>()

	// get all functions
	var matches = file_text.matchAll(pattern)
	for (const match of matches) {
		var func: Func = { name: match[1], signature: match[0] };
		funcs.set(func.name, func);
	}

	return funcs
}

function isPrivate(word: string) {
	return word.charAt(0) !== word.charAt(0).toUpperCase()
}


// This method is called when your extension is deactivated
export function deactivate() { }
