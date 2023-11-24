# vscode-go-gen

VS Code extension to generate go code

## Usage

Position your cursor in the struct definition and then

`Ctrl` + `Shift` + `P` and type `GoG` and you will see a list of available commands

- GoG: generate full Domain object
- GoG: generate Constructor
- GoG: generate Hydrate
- GoG: generate IsZero
- GoG: generate Getters

If you select a range of fields, only those fields will be used in the generation, where applicable.
If no selection and the cursor is on a field, then only that field will be used.

Any existing method matching the generation will be ignored
